import { LogOut, Trash2, Shield, MoreVertical, ShieldCheck, X, Calendar, Search, UserPlus } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useState, useEffect } from "react";

const GroupInfo = () => {
    // 1. Using Zustand Store instead of props
    const { selectedUser, closeRightPanel, toggleAdmin, removeFromGroup, leaveGroup, allContacts, addMembersToGroup, getAllContacts } = useChatStore();
    const { onlineUsers, authUser } = useAuthStore();
    const [searchTerm, setSearchTerm] = useState("");

    if (!selectedUser) return null;

    useEffect(() => {
        getAllContacts();
    }, [getAllContacts]);

    const isGroup = !!selectedUser.members;

    // 2. Helper to check if a user is an admin (checks the populated array)
    const isAdmin = (userId) => {
        if (!selectedUser.admin) return false;
        return selectedUser.admin.some(admin => admin._id === userId);
    };

    // Check if the current logged-in user is an admin
    const amIAdmin = isGroup && isAdmin(authUser._id);

    // Filter users to show only those NOT in the current group
    const availableUsers = allContacts.filter(u =>
        u._id !== authUser._id &&
        !selectedUser.members?.some(m => m._id === u._id) &&
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );



    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    // Handle Leave Group with a confirmation
    const handleLeaveGroup = () => {
        if (window.confirm("Are you sure you want to leave this group?")) {
            leaveGroup(selectedUser._id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 w-full bg-base-100 transition-all duration-700 lg:static lg:w-96 lg:border-l lg:border-base-300 h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-base-300 flex items-center justify-between sticky top-0 bg-base-100 z-10">
                <h3 className="font-semibold text-lg">{isGroup ? "Group Info" : "Contact Info"}</h3>
                <button onClick={closeRightPanel} className="btn btn-ghost btn-sm btn-circle ">
                    <X className="size-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Profile Image & Name */}
                <div className="flex flex-col items-center gap-3 p-6 border-b border-base-300">
                    <div className="avatar">
                        <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                            <img
                                src={isGroup ? (selectedUser.groupImage || "/avatar.png") : (selectedUser.profilePic || "/avatar.png")}
                                alt="Profile"
                                className="object-cover w-full h-full"
                            />
                        </div>
                    </div>

                    <div className="text-center">
                        <h2 className="text-xl font-bold">{isGroup ? selectedUser.name : selectedUser.fullName}</h2>
                        {isGroup && (
                            <p className="text-sm text-base-content/60 mt-1">
                                {selectedUser.members.length} members
                            </p>
                        )}
                    </div>
                </div>

                {/* Add Member Search (Only for Admins) */}
                {isGroup && amIAdmin && (
                    <div className="p-4 border-b border-base-300 bg-base-200/30">
                        <label className="text-xs font-bold text-base-content/50 uppercase mb-2 block">Add Member</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 size-4 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="input input-sm input-bordered w-full pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Search Results Dropdown */}
                        {searchTerm && (
                            <div className="mt-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg bg-base-100 shadow-xl">
                                {availableUsers.length > 0 ? (
                                    availableUsers.map(user => (
                                        <button
                                            key={user._id}
                                            onClick={() => {
                                                addMembersToGroup(selectedUser._id, [user._id]);
                                                setSearchTerm("");
                                            }}
                                            className="flex items-center gap-3 w-full p-2 hover:bg-base-200 transition-colors border-b border-base-300 last:border-0"
                                        >
                                            <img src={user.profilePic || "/avatar.png"} className="size-8 rounded-full object-cover" />
                                            <span className="text-sm font-medium flex-1 truncate">{user.fullName}</span>
                                            <UserPlus className="size-4 text-primary" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-3 text-xs text-center opacity-50">No new users found</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Date Info */}
                <div className="p-4 border-b border-base-300 flex gap-3 items-center text-sm text-base-content/70">
                    <Calendar className="size-5" />
                    <span>{isGroup ? "Created" : "Joined"}: {formatDate(selectedUser.createdAt)}</span>
                </div>

                {/* Members List */}
                {isGroup && (
                    <div className="p-4">
                        <h3 className="text-sm font-bold text-base-content/50 mb-4 uppercase tracking-wider">
                            Members
                        </h3>

                        <div className="flex flex-col gap-2">
                            {selectedUser.members.map((member) => {
                                const isMemberAdmin = isAdmin(member._id);
                                const isOnline = onlineUsers.includes(member._id);

                                return (
                                    <div key={member._id} className="flex items-center justify-between p-2 hover:bg-base-200 rounded-lg transition-colors group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`avatar ${isOnline ? "online" : "offline"}`}>
                                                <div className="w-10 rounded-full overflow-hidden">
                                                    <img src={member.profilePic || "/avatar.png"} alt={member.fullName} className="object-cover w-full h-full" />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate text-sm">{member.fullName}</span>
                                                    {isMemberAdmin && <ShieldCheck className="w-4 h-4 text-primary" />}
                                                </div>
                                                <div className="text-xs text-base-content/60">{isOnline ? "Online" : "Offline"}</div>
                                            </div>
                                        </div>

                                        {amIAdmin && member._id !== authUser._id && (
                                            <div className="dropdown dropdown-left dropdown-end">
                                                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs">
                                                    <MoreVertical className="w-4 h-4 text-base-content/50" />
                                                </div>
                                                <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-base-300 rounded-box w-48 border border-base-content/10">
                                                    <li>
                                                        <button onClick={() => toggleAdmin(selectedUser._id, member._id)}>
                                                            <Shield className="w-4 h-4" />
                                                            {isMemberAdmin ? "Remove Admin" : "Make Admin"}
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button
                                                            onClick={() => removeFromGroup(selectedUser._id, member._id)}
                                                            className="text-error"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Remove Member
                                                        </button>
                                                    </li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Leave Group Footer */}
            {isGroup && (
                <div className="p-4 border-t border-base-300 bg-base-100">
                    <button
                        onClick={handleLeaveGroup}
                        className="btn btn-error btn-outline w-full flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Leave Group
                    </button>
                </div>
            )}
        </div>
    );
};

export default GroupInfo;