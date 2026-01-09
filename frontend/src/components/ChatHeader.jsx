import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { ArrowLeft, Video } from "lucide-react";

function ChatHeader() {
  const { selectedUser, setSelectedUser, toggleRightPanel, initiateCall, isCalling } = useChatStore();
  const { onlineUsers } = useAuthStore();


  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedUser, setSelectedUser]);

  if (!selectedUser) return null;

  const isGroup = selectedUser?.members ? true : false;
  const displayName = isGroup ? selectedUser.name : selectedUser.fullName;

  const displayImage = isGroup
    ? (selectedUser.groupImage || "/avatar.png")
    : (selectedUser.profilePic || "/avatar.png");

  const isUserOnline = onlineUsers.includes(selectedUser._id);
  const statusText = isGroup
    ? `${selectedUser.members.length} Members`
    : (isUserOnline ? "Online" : "Offline");

  const handleStartCall = () => {
    if (!isGroup) {
      initiateCall(selectedUser._id);
    }
  };

  return (
    <div className="flex justify-between items-center bg-slate-800/50 border-b border-slate-700/50 max-h-[84px] px-6 flex-1 py-3">
      {/* LEFT SIDE (User Info) */}
      <div className="flex items-center gap-3 flex-1 overflow-hidden">

        {/* Back Button */}
        <button
          className="p-2 rounded-full hover:bg-base-300 mr-2 transition-colors"
          onClick={() => setSelectedUser(null)}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Clickable Info Area */}
        <div
          onClick={toggleRightPanel}
          className="flex items-center gap-3 cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-all flex-1"
        >
          <div className={`avatar ${!isGroup && isUserOnline ? "online" : ""}`}>
            <div className="w-12 h-12 rounded-full relative overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20">
              <img
                src={displayImage}
                alt={displayName}
                className="object-cover w-full h-full"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <h3 className="text-slate-200 font-medium truncate">{displayName}</h3>
            <p className="text-slate-400 text-sm truncate">{statusText}</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (Actions) */}
      <div className="flex items-center gap-2 ml-4">
        {/* Only show Call button for 1-on-1 chats */}
        {!isGroup && (
          <button
            onClick={handleStartCall}
            disabled={isCalling}
            className="p-2.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors text-slate-400"
            title="Start Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
        )}
      </div>

    </div>
  );
}

export default ChatHeader;