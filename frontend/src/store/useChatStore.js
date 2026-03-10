import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
    // =================================================================
    // EXISTING CHAT & GROUP STATE
    // =================================================================
    allContacts: [],
    chats: [],
    messages: [],
    activeTab: 'chats',
    selectedUser: null,
    isUserLoading: false,
    isMessagesLoading: false,
    isCreatingGroup: false,
    isGroupsLoading: false,
    groups: [],
    isRightPanelOpen: false,

    // =================================================================
    // NEW: VIDEO CALL STATE
    // =================================================================
    isCalling: false,       // Are we in a call (outgoing or ongoing)?
    isIncoming: false,      // Is someone calling us?
    callData: null,         // Data of the incoming caller { from, signal, name }
    isMicOn: true,
    isCameraOn: true,

    // =================================================================
    // ACTIONS
    // =================================================================

    

    setActiveTab: (tab) => {
        set({ activeTab: tab });
    },

    setSelectedUser: (selectedUser) => {
        // If we select a user, close the right panel to keep UI clean
        set({ selectedUser, isRightPanelOpen: false });
    },

    getAllContacts: async () => {
        set({ isUserLoading: true })
        try {
            const res = await axiosInstance.get('/messages/contacts')
            set({ allContacts: res.data })
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch contacts");
        } finally {
            set({ isUserLoading: false })
        }
    },

    getMyChatPartners: async () => {
        set({ isUserLoading: true })
        try {
            const res = await axiosInstance.get('/messages/chats')
            set({ chats: res.data })
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch chat partners");
        } finally {
            set({ isUserLoading: false })
        }
    },


    getMessagesByUserId: async (userId) => {
        set({ isMessagesLoading: true })
        try {
            const res = await axiosInstance.get(`/messages/${userId}`)
            set({ messages: res.data })
        } catch (error) {
            console.log("Error in getMessagesByUserId", error)
            toast.error(error.response?.data?.message || "Failed to fetch messages");
        } finally {
            set({ isMessagesLoading: false })
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser } = get();
        const { authUser } = useAuthStore.getState();
        const tempId = `temp-${Date.now()}`;
        
        const optimisticMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: messageData.text,
            image: messageData.image,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
        };
        
        // 1. Safely add the optimistic message to the LATEST state
        set((state) => ({ messages: [...state.messages, optimisticMessage] }));
        
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            
            set((state) => {
                // 2. Check if the WebSocket already sneaked in and added the real message
                const alreadyExists = state.messages.some(msg => msg._id === res.data._id);

                if (alreadyExists) {
                    // Socket beat us to it! Just clean up the temporary optimistic message.
                    return {
                        messages: state.messages.filter(msg => msg._id !== tempId)
                    };
                } else {
                    // HTTP finished first! Swap the temporary message with the real one.
                    return {
                        messages: state.messages.map((msg) =>
                            msg._id === tempId ? res.data : msg
                        )
                    };
                }
            });
            
        } catch (error) {
            set((state) => ({
                messages: state.messages.filter((msg) => msg._id !== tempId)
            }));
            console.log("Error in sendMessage : ", error);
            toast.error(error.response?.data?.message || "Failed to send message");
        }
    },

    
    deleteMessage: async (messageId) => {
        try {
        await axiosInstance.delete(`/messages/${messageId}`);
        
        // Remove from local state immediately
        set({
            messages: get().messages.filter((message) => message._id !== messageId),
        });
        toast.success("Message deleted");
        } catch (error) {
        toast.error(error.response.data.error);
        }
    },
    // =================================================================
    // VIDEO CALL ACTIONS
    // =================================================================

    initiateCall: (targetUserId, signalData) => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return toast.error("No connection available");

        const { authUser } = useAuthStore.getState();

        socket.emit("call-user", {
            userToCall: targetUserId,
            signalData: signalData,
            from: authUser._id,
            name: authUser.fullName // Optional: Send name for display
        });

        set({ isCalling: true, isIncoming: false });
    },

    answerCall: (callerId, signalData) => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.emit("answer-call", {
            signal: signalData,
            to: callerId
        });

        set({ isCalling: true, isIncoming: true });
    },

    acceptIncomingCall: () => {
        set({ isCalling: true, isIncoming: true });
    },

    endCall: (userId) => {
        // Reset UI state
        set({
            isCalling: false,
            isIncoming: false,
            callData: null,
            isMicOn: true,
            isCameraOn: true
        });
        
        // Notify the other user that the call has ended
        const socket = useAuthStore.getState().socket;
        if (socket && userId) {
            socket.emit("end-call", { to: userId });
        }
    },

    toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),
    toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),

    // =================================================================
    // GROUP ACTIONS
    // =================================================================

    toggleAdmin: async (groupId, userId) => {
        try {
            await axiosInstance.put("/groups/toggle-admin", { groupId, userId });
            toast.success("Admin role updated");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update admin");
        }
    },

    removeFromGroup: async (groupId, userId) => {
        try {
            await axiosInstance.put("/groups/remove-member", { groupId, userId });
            toast.success("Member removed");
        } catch (error) {
            toast.error("Failed to remove member");
        }
    },

    leaveGroup: async (groupId) => {
        try {
            const res = await axiosInstance.put("/groups/leave", { groupId });
            toast.success(res.data.message);

            const { groups } = get();
            set({
                groups: groups.filter(g => g._id !== groupId),
                selectedUser: null,
                isRightPanelOpen: false
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to leave group");
        }
    },

    createGroup: async (groupData) => {
        set({ isCreatingGroup: true })
        try {
            const res = await axiosInstance.post("/groups/create", groupData);
            toast.success("Group created successfully!");
            set({ groups: [...get().groups, res.data] });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create group");
        } finally {
            set({ isCreatingGroup: false });
        }
    },

    getGroups: async () => {
        set({ isGroupsLoading: true });
        try {
            const res = await axiosInstance.get("/groups");
            set({ groups: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch groups");
        } finally {
            set({ isGroupsLoading: false });
        }
    },

    toggleRightPanel: () => {
        set({ isRightPanelOpen: !get().isRightPanelOpen });
    },

    closeRightPanel: () => {
        set({ isRightPanelOpen: false });
    },

    addMembersToGroup: async (groupId, newMembers) => {
        try {
            await axiosInstance.put("/groups/add-members", { groupId, newMembers });
            toast.success("Members added successfully");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to add members");
        }
    },

    // =================================================================
    // SOCKET LISTENERS
    // =================================================================

    subscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // --- 1. NEW GROUP LISTENER (Sidebar) ---
        socket.on("newGroup", (newGroup) => {
            set({ groups: [...get().groups, newGroup] });
            toast.success(`You were added to group: ${newGroup.name}`);
        });

        // --- 2. MESSAGE LISTENER (Chat Area) ---
        socket.on('newMessage', (newMessage) => {
            const { chats, selectedUser } = get();
            
            // ... (your existing chat list update logic here) ...

            // B. Update Messages (If chat is open)
            if (!selectedUser) return;

            const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
            const isMessageForCurrentGroup = newMessage.groupId && newMessage.groupId === selectedUser._id;

            // Notice we also check if you are testing by chatting with yourself!
            const isChattingWithMyself = selectedUser._id === useAuthStore.getState().authUser._id;

            if (isMessageSentFromSelectedUser || isMessageForCurrentGroup || isChattingWithMyself) {
                set((state) => {
                    // Prevent duplicate if HTTP already added it!
                    const isAlreadyAdded = state.messages.some((msg) => msg._id === newMessage._id);
                    if (isAlreadyAdded) return state; // Do nothing if it's already there

                    return { messages: [...state.messages, newMessage] };
                });
            }
        });

        // --- 3. GROUP UPDATED LISTENER ---
        socket.on("groupUpdated", (updatedGroup) => {
            const { groups, selectedUser } = get();

            // If removed
            if (updatedGroup.wasRemoved) {
                set({ groups: groups.filter(g => g._id !== updatedGroup._id) });
                if (selectedUser?._id === updatedGroup._id) {
                    set({ selectedUser: null });
                    toast.error(`You were removed from ${updatedGroup.name}`);
                }
                return;
            }

            // Update sidebar list
            const updatedGroups = groups.map(g =>
                g._id === updatedGroup._id ? updatedGroup : g
            );
            set({ groups: updatedGroups });

            // Update active view
            if (selectedUser && selectedUser._id === updatedGroup._id) {
                set({ selectedUser: updatedGroup });
            }
        });

        // --- 4. VIDEO CALL LISTENER ---
        socket.on("call-user", (data) => {
            // data = { from, signal, name }
            console.log("Incoming Call detected:", data);
            set({ isIncoming: true, callData: data });
        });

        // --- 5. CALL ENDED LISTENER ---
        socket.on("call-ended", () => {
            set({
                isCalling: false,
                isIncoming: false,
                callData: null,
                isMicOn: true,
                isCameraOn: true
            });
            toast.dismiss(); // Dismiss any lingering toasts
            toast("Call ended", { icon: "📞" });
        });

        // --- 6. MESSAGE DELETED LISTENER ---  
        socket.on("messageDeleted", (messageId) => {
            set({
                messages: get().messages.filter((message) => message._id !== messageId),
            });
        });
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off('newMessage');
        socket.off('newGroup');
        socket.off('groupUpdated');
        socket.off('call-user'); // Clean up video listener
        socket.off('call-ended');
        socket.off("messageDeleted");
    },

}));