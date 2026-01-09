import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore"
import { useAuthStore } from "../store/useAuthStore";
import ChatHeader from "./ChatHeader";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import Message from "./Message";
import { useRef } from "react";
import GroupInfo from "./GroupInfo";

function ChatContainer() {
  const { selectedUser, getMessagesByUserId, messages, isMessagesLoading, subscribeToMessages, unsubscribeFromMessages, isRightPanelOpen } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    return unsubscribeFromMessages;
  }, [selectedUser, getMessagesByUserId, subscribeToMessages, unsubscribeFromMessages])

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    // Changed Fragment <> to a Flex Container to hold Chat + SidePanel
    <div className="flex flex-1 h-full overflow-hidden">

      {/* Wrapped existing Chat logic in a Left Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader />

        {/*bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat*/}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-950">
          {messages.length > 0 && !isMessagesLoading ? (
            <div className="w-full space-y-6">
              {messages.map((msg) => (
                <Message key={msg._id} message={msg} />
              ))}
              <div />
            </div>
          ) : isMessagesLoading ? (
            <MessagesLoadingSkeleton />
          ) : (
            <NoChatHistoryPlaceholder name={selectedUser.fullName || selectedUser.name} />
          )}
          <div ref={messageEndRef} />
        </div>

        <MessageInput />
      </div>

      {/*Render the GroupInfo Panel if state is true */}
      {isRightPanelOpen && (
        <GroupInfo />
      )}

    </div>
  )
}

export default ChatContainer