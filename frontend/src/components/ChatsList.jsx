import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useAuthStore } from "../store/useAuthStore";

function ChatsList() {
  const { 
    chats, 
    getMyChatPartners, 
    isUserLoading, 
    selectedUser, 
    setSelectedUser,
    // Add Group Data
    groups,
    getGroups,
    isGroupsLoading
  } = useChatStore();

  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
    getGroups(); // <--- Fetch groups on load
  }, [getMyChatPartners, getGroups]);

  // Show skeleton if EITHER users or groups are loading
  if (isUserLoading || isGroupsLoading) {
    return <UsersLoadingSkeleton />;
  }

  // Show "No Chats" only if BOTH lists are empty
  if (chats.length === 0 && groups.length === 0) return <NoChatsFound />;

  return (
    <div className="flex-1 overflow-y-auto">
      
      {/* --- GROUPS SECTION --- */}
      {groups.length > 0 && (
        <div className="mb-6">
          <div className="px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 mt-2">
            Groups
          </div>
          {groups.map((group) => (
            <div
              key={group._id}
              onClick={() => setSelectedUser(group)}
              className={`
                w-full p-3 flex items-center gap-3 transition-colors cursor-pointer justify-start
                ${selectedUser?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : "hover:bg-base-300"}
              `}
            >
              {/* Group Avatar (First Letter) */}
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {group.name.charAt(0).toUpperCase()}
              </div>

              <div className="text-left min-w-0">
                <div className="font-medium truncate">{group.name}</div>
                <div className="text-sm text-zinc-400">
                  {group.members.length} members
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- DIRECT MESSAGES SECTION --- */}
      {chats.length > 0 && (
        <div className="mb-4">
           {/* Only show header if we also have groups (to separate them) */}
           {groups.length > 0 && (
             <div className="px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
               Direct Messages
             </div>
           )}
           
           {chats.map((chat) => (
            <div
              key={chat._id}
              onClick={() => setSelectedUser(chat)}
              className={`
                w-full p-3 flex items-center gap-3 rounded-lg transition-colors cursor-pointer justify-start
                ${selectedUser?._id === chat._id ? "bg-base-300 ring-1 ring-base-300" : "hover:bg-base-300"}
              `}
            >
              <div className="relative">
                <img
                  src={chat.profilePic || "/avatar.png"}
                  alt={chat.fullName}
                  className="size-12 object-cover rounded-full"
                />
                {onlineUsers.includes(chat._id) && (
                  <span
                    className="absolute bottom-0 right-0 size-3 bg-green-500 
                      rounded-full ring-2 ring-zinc-900"
                  />
                )}
              </div>

              <div className="text-left min-w-0">
                <div className="font-medium truncate">{chat.fullName}</div>
                <div className="text-sm text-zinc-400">
                  {onlineUsers.includes(chat._id) ? "Online" : "Offline"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChatsList;