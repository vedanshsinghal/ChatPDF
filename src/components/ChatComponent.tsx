"use client"
import React, { useEffect, useState } from 'react'
import { useChat } from '@ai-sdk/react' 
import { DefaultChatTransport } from 'ai'
import { Send } from 'lucide-react'
import MessageList from './MessageList'

import { type UIMessage as Message } from 'ai'

type Props = {
  chatId: number;
  initialMessages?: Message[];
}

const ChatComponent = ({ chatId, initialMessages }: Props) => {
  // 1. Manually manage the input state
  const [input, setInput] = useState("");

  console.log("[ChatComponent] Mounted with initialMessages:", initialMessages);

  // 2. Setup useChat with the new DefaultChatTransport architecture
  const { messages, setMessages, sendMessage, status } = useChat({
    id: chatId.toString(),
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // This is how we send custom data (like chatId) to the backend in v6!
      prepareSendMessagesRequest: ({ messages }) => {
        return {
          body: {
            messages,
            chatId, 
          }
        };
      }
    }),
  });

  console.log("[ChatComponent] useChat messages state:", messages);

  // Force sync initialMessages if the SDK ignores them on mount
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      console.log("[ChatComponent] Forcefully setting messages from initialMessages");
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Auto-scroll logic
  useEffect(() => {
    const messageContainer = document.getElementById("message-container");
    if (messageContainer) {
      messageContainer.scrollTo({
        top: messageContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // Our custom submit handler using the new sendMessage function
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput(""); // Clear the input after sending
    }
  };

  return (
    <div className="relative max-h-screen overflow-y-auto" id="message-container">
      {/* Header */}
      <div className="sticky top-0 inset-x-0 p-2 bg-white h-fit z-10">
        <h3 className="text-xl font-bold">Chat</h3>
      </div>

      {/* Message List */}
      <MessageList 
        messages={messages} 
        isLoading={status === 'submitted' || status === 'streaming'} 
      />

      {/* Input Form */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 inset-x-0 px-2 py-4 bg-white flex"
      >
        <div className="flex w-full">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask any question..."
            className="w-full border rounded-md px-3 py-2"
            disabled={status !== "ready"}
          />
          <button 
            type="submit" 
            className="bg-blue-600 ml-2 px-3 py-2 rounded-md disabled:opacity-50"
            disabled={status !== "ready" || !input.trim()}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatComponent