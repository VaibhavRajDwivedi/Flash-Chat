import React from 'react'

import { MessageSquare } from "lucide-react";

const NoConversationPlaceholder = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center p-16 bg-base-100/50 h-full">
      <div className="animate-bounce">
        <MessageSquare className="w-16 h-16 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mt-4">Welcome to Flash Chat!</h2>
      <p className="text-base-content/60 mt-2">Select a conversation to start chatting</p>
    </div>
  );
};

export default NoConversationPlaceholder