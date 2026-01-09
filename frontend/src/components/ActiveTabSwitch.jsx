import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Plus } from "lucide-react";
import CreateGroupModal from "./CreateGroupModal";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-2 m-2 gap-2">
        {/* Tab Switcher */}
        <div className="tabs tabs-boxed bg-transparent p-1 flex-1">
          <button
            onClick={() => setActiveTab("chats")}
            className={`tab flex-1 transition-all ${
              activeTab === "chats"
                ? "bg-cyan-500/20 text-cyan-500 font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`tab flex-1 transition-all ${
              activeTab === "contacts"
                ? "bg-cyan-500/20 text-cyan-500 font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Contacts
          </button>
        </div>

        {/* Create Group Button (+) */}
        <button
          onClick={() => setShowCreateGroup(true)}
          className="btn btn-circle btn-sm btn-ghost text-slate-400 hover:text-cyan-500 hover:bg-cyan-500/10"
          title="Create New Group"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {/* Render the Modal if state is true */}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </>
  );
}

export default ActiveTabSwitch;