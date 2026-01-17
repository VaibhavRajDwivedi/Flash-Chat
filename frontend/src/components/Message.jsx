import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { Trash2, MoreVertical } from "lucide-react";

const Message = ({ message }) => {
    // Access global state for authentication and chat actions
    const { authUser } = useAuthStore();
    const { selectedUser, deleteMessage } = useChatStore();

    // Check if the message belongs to the currently logged-in user
    const isOwnMessage = message.senderId === authUser._id;

    // Dropdown state
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this message?")) {
            deleteMessage(message._id);
        }
        setIsMenuOpen(false);
    };

    // --- System Message Handling ---
    if (message.isSystemMessage) {
        return (
            <div className="flex justify-center my-6 w-full">
                <div className="bg-zinc-800/50 text-zinc-400 px-4 py-1.5 rounded-full text-[11px] font-medium border border-zinc-700/50 tracking-wide uppercase italic">
                    {message.text}
                </div>
            </div>
        );
    }

    // --- Sender Profile Logic ---
    let senderProfilePic = isOwnMessage ? authUser.profilePic : selectedUser.profilePic;
    let senderName = null;

    if (selectedUser?.members) {
        // In Group Chats: Search the members array to find the specific sender's details
        const sender = selectedUser.members.find(m => m._id === message.senderId);
        if (sender) {
            senderProfilePic = sender.profilePic;
            senderName = sender.fullName;
        } else if (isOwnMessage) {
            senderProfilePic = authUser.profilePic;
            senderName = "You";
        } else {
            senderProfilePic = "/avatar.png"; // Fallback if sender data is missing
            senderName = "User";
        }
    }

    // --- Local State for Read More/Less ---
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LENGTH = 300;
    const isLongMessage = message.text && message.text.length > MAX_LENGTH;

    return (
        <div className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}>

            {/* Avatar Display: Only shown in Group Chats */}
            {selectedUser?.members && (
                <div className="chat-image avatar">
                    <div className="size-10 rounded-full border">
                        <img
                            alt="avatar"
                            src={senderProfilePic || "/avatar.png"}
                        />
                    </div>
                </div>
            )}

            {/* Sender Name: Only shown in Group Chats for incoming messages */}
            {selectedUser?.members && !isOwnMessage && (
                <div className="chat-header mb-1">
                    <span className="text-xs opacity-50 font-bold">{senderName}</span>
                </div>
            )}

            {/* Message Bubble Container */}
            <div
                className={`chat-bubble group relative !overflow-visible rounded-xl before:hidden break-all max-w-[200px] md:max-w-lg lg:max-w-2xl ${isOwnMessage ? "bg-indigo-600 text-white" : "bg-zinc-800 text-white"
                    }`}
            >
                {/* Image Attachment Rendering */}
                {message.image && (
                    <img
                        src={message.image}
                        alt="Shared"
                        className="rounded-lg h-48 object-cover mb-2"
                    />
                )}

                {/* Text Content with Read More/Less logic */}
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

                {/* Message Timestamp */}
                <p className="text-[10px] mt-1 opacity-70 block text-right">
                    {new Date(message.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </p>

                {/* Message Options Menu (Three Dots) - Only for own messages */}
                {isOwnMessage && (
                    <div className="absolute top-2 right-2" ref={menuRef}>
                        {/* Trigger Button - Visible on hover or when menu is open */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className={`p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                } text-white`}
                            title="Message options"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                    onClick={handleDelete}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-zinc-800 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;