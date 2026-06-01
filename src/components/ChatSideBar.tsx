"use client";
import React from 'react';
import Link from 'next/link';
import { MessageCircle, PlusCircle, Home, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button'; 
import SubscriptionButton from './SubscriptionButton';

// We need to define what a "chat" looks like based on your Drizzle schema
type Chat = {
  id: number;
  pdfName: string;
  pdfUrl: string;
  createdAt: Date;
  userId: string;
  fileKey: string;
};

type Props = {
  chats: Chat[];
  chatId: number; // The currently active chat
  isPro: boolean;
};

const ChatSideBar = ({ chats, chatId, isPro }: Props) => {
  return (
    <div className="w-full h-screen p-4 text-gray-200 bg-gray-900 flex flex-col">
      
      {/* New Chat Button */}
      <Link href="/">
        <Button className="w-full border-dashed border-white border flex justify-center items-center p-4 rounded-lg cursor-pointer hover:bg-gray-800 transition">
          <PlusCircle className="w-5 h-5 mr-2" />
          <p className="font-semibold text-sm">New Chat</p>
        </Button>
      </Link>

      {/* Chat List */}
      <div className="flex flex-col gap-2 mt-4 overflow-y-auto flex-1 pb-4">
        {chats.map((chat) => (
          <Link key={chat.id} href={`/chat/${chat.id}`}>
            <div
              className={cn(
                "rounded-lg p-3 text-slate-300 flex items-center transition hover:bg-gray-800 hover:text-white cursor-pointer",
                {
                  "bg-blue-600 text-white hover:bg-blue-600": chat.id === chatId,
                }
              )}
            >
              <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
              <p className="w-full overflow-hidden text-sm truncate whitespace-nowrap text-ellipsis">
                {chat.pdfName}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Upgrade to Pro Button */}
      <div className="pt-4 border-t border-gray-700 flex flex-col gap-3">
        <SubscriptionButton isPro={isPro} />
        
        {/* Home Button */}
        <Link href="/">
          <div className="flex items-center text-slate-300 hover:text-white transition cursor-pointer p-2 rounded-lg hover:bg-gray-800">
            <Home className="w-5 h-5 mr-2" />
            <span className="font-semibold text-sm">Home</span>
          </div>
        </Link>
      </div>

    </div>
  );
};

export default ChatSideBar;