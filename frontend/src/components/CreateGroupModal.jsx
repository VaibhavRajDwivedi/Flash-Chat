import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { X, Search } from "lucide-react";

const CreateGroupModal = ({ onClose }) => {
  // 1. USE EXISTING STORE VARIABLES
  // We use 'allContacts' instead of 'users'
  // We use 'getAllContacts' instead of 'getUsers'
  const { 
    allContacts, 
    getAllContacts, 
    createGroup, 
    isCreatingGroup 
  } = useChatStore();
  
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // 2. Fetch Contacts when Modal Opens
  useEffect(() => {
    // This fetches the data from /messages/contacts
    getAllContacts();
  }, [getAllContacts]);

  // 3. Filter Logic (Using allContacts)
  // Safety check (allContacts || []) prevents crashes if it's null
  const filteredUsers = (allContacts || []).filter((contact) => 
    contact.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleUser = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName || selectedUsers.length < 2) return;
    
    // Send the data to your fixed store function
    await createGroup({ name: groupName, members: selectedUsers });
    onClose(); 
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-base-200 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-base-300 flex flex-col gap-4 h-[500px]">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">New Group</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="size-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Group Name (e.g. Project Alpha)"
            className="input input-bordered w-full"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="size-4 text-gray-500" />
             </div>
             <input
                type="text"
                placeholder="Search contacts..."
                className="input input-sm input-bordered w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto border border-base-300 rounded-xl p-2 bg-base-100">
            {filteredUsers.length === 0 ? (
                <div className="text-center p-4 text-gray-500">No contacts found</div>
            ) : (
                filteredUsers.map((user) => (
                    <div
                        key={user._id}
                        onClick={() => handleToggleUser(user._id)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedUsers.includes(user._id) ? "bg-primary/10 border border-primary" : "hover:bg-base-200"
                        }`}
                    >
                        <div className="avatar placeholder">
                          <div className="bg-neutral text-neutral-content rounded-full w-8">
                              <span className="text-xs">{user.fullName[0]}</span>
                          </div>
                        </div>
                        <span className="flex-1 font-medium text-sm">{user.fullName}</span>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          readOnly 
                          className="checkbox checkbox-primary checkbox-sm pointer-events-none"
                        />
                    </div>
                ))
            )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={isCreatingGroup || !groupName || selectedUsers.length < 2}
            >
                {isCreatingGroup ? "Creating..." : "Create"}
            </button>
        </div>

      </div>
    </div>
  );
};

export default CreateGroupModal;