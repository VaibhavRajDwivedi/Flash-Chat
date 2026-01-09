import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';

const Message = ({ message }) => {
    const { authUser } = useAuthStore();
    const { selectedUser } = useChatStore();
    const isOwnMessage = message.senderId === authUser._id;

    // --- 1. CENTERED SYSTEM MESSAGE LOGIC ---
    if (message.isSystemMessage) {
        return (
            <div className="flex justify-center my-6 w-full">
                <div className="bg-zinc-800/50 text-zinc-400 px-4 py-1.5 rounded-full text-[11px] font-medium border border-zinc-700/50 tracking-wide uppercase italic">
                    {message.text}
                </div>
            </div>
        );
    }
    // --- END SYSTEM MESSAGE LOGIC ---


    // --- GROUP CHAT LOGIC ---
    // If we are in a group (selectedUser has members), we need to find the sender's details.
    // message.senderId is just an ID string.
    let senderProfilePic = isOwnMessage ? authUser.profilePic : selectedUser.profilePic;
    let senderName = null;

    if (selectedUser?.members) {
        // It's a group! Find the sender in the members list
        const sender = selectedUser.members.find(m => m._id === message.senderId);
        if (sender) {
            senderProfilePic = sender.profilePic;
            senderName = sender.fullName;
        } else if (isOwnMessage) {
            senderProfilePic = authUser.profilePic;
            senderName = "You";
        } else {
            senderProfilePic = "/avatar.png"; // Fallback
            senderName = "User";
        }
    }
    // --- END GROUP CHAT LOGIC ---

    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LENGTH = 300;
    const isLongMessage = message.text && message.text.length > MAX_LENGTH;


    return (
        <div className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}>
            {/* Show Avatar ONLY in Group Chat */}
            {selectedUser?.members && (
                <div className="chat-image avatar">
                    <div className="size-10 rounded-full border">
                        <img
                            alt="Tailwind CSS chat bubble component"
                            src={senderProfilePic || "/avatar.png"}
                        />
                    </div>
                </div>
            )}

            {/* Show Sender Name in Group Chat (Only for incoming messages) */}
            {selectedUser?.members && !isOwnMessage && (
                <div className="chat-header mb-1">
                    <span className="text-xs opacity-50 font-bold">{senderName}</span>
                </div>
            )}

            <div
                className={`chat-bubble rounded-xl before:hidden overflow-hidden break-all max-w-[200px] md:max-w-lg lg:max-w-2xl ${isOwnMessage
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-white"
                    }`}
            >
                {message.image && (
                    <img
                        src={message.image}
                        alt="Shared"
                        className="rounded-lg h-48 object-cover mb-2"
                    />
                )}
                {message.text && (
                    <p>
                        {isExpanded || !isLongMessage
                            ? message.text
                            : `${message.text.slice(0, MAX_LENGTH)}...`}
                        {isLongMessage && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="font-bold underline cursor-pointer ml-1 text-xs text-teal-400"
                            >
                                {isExpanded ? "Read less" : "Read more"}
                            </button>
                        )}
                    </p>
                )}
                {/* Timestamp */}
                <p className="text-[10px] mt-1 opacity-70 block text-right">
                    {new Date(message.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </p>
            </div>

        </div>
    );
};

export default Message;
