import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
    // Manages core chat and group collections.
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

    // Tracks WebRTC connection lifecycle.
    isCalling: false,       // Tracks active session status.
    isIncoming: false,      // Tracks incoming ring state.
    callData: null,         // Caches incoming caller metadata.
    isMicOn: true,
    isCameraOn: true,

    // Global state mutators.

    

    setActiveTab: (tab) => {
        set({ activeTab: tab });
    },

    setSelectedUser: (selectedUser) => {
        // Defers panel closure maximizing readability.
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
        
        // Appends tentative message representation.
        set((state) => ({ messages: [...state.messages, optimisticMessage] }));
        
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
            
            set((state) => {
                // Validates socket race conditions.
                const alreadyExists = state.messages.some(msg => msg._id === res.data._id);

                if (alreadyExists) {
                    // Resolves optimistic payload duplication.
                    return {
                        messages: state.messages.filter(msg => msg._id !== tempId)
                    };
                } else {
                    // Commits confirmed message payload.
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
        
        // Purges local cache immediately.
        set({
            messages: get().messages.filter((message) => message._id !== messageId),
        });
        toast.success("Message deleted");
        } catch (error) {
        toast.error(error.response.data.error);
        }
    },
    // WebRTC signaling mutators.

    initiateCall: (targetUserId, signalData) => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return toast.error("No connection available");

        const { authUser } = useAuthStore.getState();

        socket.emit("call-user", {
            userToCall: targetUserId,
            signalData: signalData,
            from: authUser._id,
            name: authUser.fullName // Provides friendly caller attribution.
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
        // Clears session metadata.
        set({
            isCalling: false,
            isIncoming: false,
            callData: null,
            isMicOn: true,
            isCameraOn: true
        });
        
        // Dispatches teardown notification.
        const socket = useAuthStore.getState().socket;
        if (socket && userId) {
            socket.emit("end-call", { to: userId });
        }
    },

    toggleMic: () => set((state) => ({ isMicOn: !state.isMicOn })),
    toggleCamera: () => set((state) => ({ isCameraOn: !state.isCameraOn })),

    // Group management mutators.

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

    // Real-time event subscriptions.

    subscribeToMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        // Subscribes to collective invitations.
        socket.on("newGroup", (newGroup) => {
            set({ groups: [...get().groups, newGroup] });
            toast.success(`You were added to group: ${newGroup.name}`);
        });

        // Subscribes to inbound payloads.
        socket.on('newMessage', (newMessage) => {
            const { chats, selectedUser } = get();
            
            // Syncs contextual chat lists.

            // Renders active conversation payloads.
            if (!selectedUser) return;

            const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
            const isMessageForCurrentGroup = newMessage.groupId && newMessage.groupId === selectedUser._id;

            // Handles reflexive testing loops.
            const isChattingWithMyself = selectedUser._id === useAuthStore.getState().authUser._id;

            if (isMessageSentFromSelectedUser || isMessageForCurrentGroup || isChattingWithMyself) {
                set((state) => {
                    // Resolves socket versus HTTP race conditions.
                    const isAlreadyAdded = state.messages.some((msg) => msg._id === newMessage._id);
                    if (isAlreadyAdded) return state; // Bypasses redundant insertions.

                    return { messages: [...state.messages, newMessage] };
                });
            }
        });

        // Subscribes to roster mutations.
        socket.on("groupUpdated", (updatedGroup) => {
            const { groups, selectedUser } = get();

            // Handles eviction cases.
            if (updatedGroup.wasRemoved) {
                set({ groups: groups.filter(g => g._id !== updatedGroup._id) });
                if (selectedUser?._id === updatedGroup._id) {
                    set({ selectedUser: null });
                    toast.error(`You were removed from ${updatedGroup.name}`);
                }
                return;
            }

            // Refreshes collective directory.
            const updatedGroups = groups.map(g =>
                g._id === updatedGroup._id ? updatedGroup : g
            );
            set({ groups: updatedGroups });

            // Syncs currently focused entity.
            if (selectedUser && selectedUser._id === updatedGroup._id) {
                set({ selectedUser: updatedGroup });
            }
        });

        // Subscribes to incoming ring events.
        socket.on("call-user", (data) => {
            // Expects origin signature and metadata.
            console.log("Incoming Call detected:", data);
            set({ isIncoming: true, callData: data });
        });

        // Subscribes to teardown events.
        socket.on("call-ended", () => {
            set({
                isCalling: false,
                isIncoming: false,
                callData: null,
                isMicOn: true,
                isCameraOn: true
            });
            toast.dismiss(); // Purges transient notifications.
            toast("Call ended", { icon: "📞" });
        });

        // Subscribes to payload removals.
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
        socket.off('call-user'); // Detaches ring subscription.
        socket.off('call-ended');
        socket.off("messageDeleted");
    },

}));