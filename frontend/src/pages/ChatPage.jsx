import React from 'react'
import { useChatStore } from '../store/useChatStore'
import ProfileHeader from '../components/ProfileHeader'
import ActiveTabSwitch from '../components/ActiveTabSwitch'
import ChatsList from '../components/ChatsList'
import ContactList from '../components/ContactList'
import ChatContainer from '../components/ChatContainer'
import NoConversationPlaceholder from '../components/NoConversationPlaceholder'
import VideoCall from '../components/VideoCall' // 1. Import Video Component
import { PhoneOff, Video } from 'lucide-react' // 2. Import Icons

function ChatPage() {
  // 3. Destructure new video states
  const {
    activeTab,
    selectedUser,
    isCalling,
    isIncoming,
    callData,
    answerCall,
    acceptIncomingCall,
    endCall
  } = useChatStore();

  return (
    // Added 'relative' so the popup can position itself absolutely inside this container
    <div className='h-[100dvh] w-full flex overflow-hidden relative'>

      {/* LEFT SIDE */}
      <div className={`${selectedUser ? "hidden md:flex" : "flex"} w-full md:w-96 bg-base-200 flex-col border-r border-base-300`}>
        <ProfileHeader />
        <ActiveTabSwitch />

        <div className='flex-1 overflow-y-auto p-4 space-y-2'>
          {activeTab === 'chats' ? <ChatsList /> : <ContactList />}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className={`${!selectedUser ? "hidden md:flex" : "flex"} flex-1 flex-col bg-base-100`}>
        {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
      </div>

      {/* ======================================================= */}
      {/* INCOMING CALL POPUP (The Ringer)                     */}
      {/* ======================================================= */}
      {isIncoming && !isCalling && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-base-300 p-4 rounded-xl shadow-2xl z-50 border border-primary flex items-center gap-4 animate-bounce">

          {/* Avatar / Caller Initials */}
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-12 ring ring-primary ring-offset-base-100 ring-offset-2">
              <span className="text-xl font-bold uppercase">
                {callData?.name ? callData.name.charAt(0) : "?"}
              </span>
            </div>
          </div>

          {/* Caller Text */}
          <div>
            <p className="font-bold text-lg">{callData?.name || "Unknown User"}</p>
            <p className="text-xs text-base-content/70">Incoming Video Call...</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-4">
            {/* Accept Button */}
            <button
              onClick={acceptIncomingCall}
              className="btn btn-circle btn-success text-white shadow-lg"
              title="Accept Call"
            >
              <Video size={20} />
            </button>

            {/* Reject Button */}
            <button
              onClick={() => endCall(callData?.from)}
              className="btn btn-circle btn-error text-white shadow-lg"
              title="Decline Call"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* VIDEO CALL SCREEN (Overlay)                          */}
      {/* ======================================================= */}
      {isCalling && (
        <VideoCall />
      )}

    </div>
  )
}

export default ChatPage