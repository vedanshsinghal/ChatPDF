// /chat/[chatId]
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
import React from 'react'
import {auth} from "@clerk/nextjs/server"
import {redirect} from "next/navigation"
import { db } from "@/lib/db";
import { chats, messages as _messages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import ChatSideBar from '@/components/ChatSideBar';
import PDFViewer from '@/components/PDFViewer';
import ChatComponent from '@/components/ChatComponent';

import { checkSubscription } from '@/lib/subscription';

type Props = {
    params:{
        chatId:string
    }
}

const ChatPage = async ({params}:Props) => {
  const {chatId}=await params
  const {userId}=await auth()
  if (!userId){
    return redirect("/sign-in")
  }
  
  const isPro = await checkSubscription();

  // 2. Fetch all chats for this specific user from NeonDB
  const _chats = await db.select().from(chats).where(eq(chats.userId, userId));
  if (!_chats) {
    return redirect("/");
  }

  // Does the URL's chatId exist in this user's list of chats?
  // parse the string URL param into an integer to check the DB
  const currentChat = _chats.find((chat) => chat.id === parseInt(chatId));
  
  if (!currentChat) {
    // If they try to access a chat that isn't theirs, kick them back to home
    return redirect("/");
  }

  // 3. Fetch past messages for this chat
  const currentMessages = await db.select().from(_messages)
    .where(eq(_messages.chatId, parseInt(chatId)))
    .orderBy(asc(_messages.createdAt));
  
  // Format them for the AI SDK (map 'system' to 'assistant')
  const formattedMessages = currentMessages.map((msg) => ({
    id: msg.id.toString(),
    role: msg.role === "system" ? "assistant" as const : "user" as const,
    content: msg.content,
    createdAt: msg.createdAt,
  }));
  console.log(`[DEBUG] Fetched ${formattedMessages.length} messages for chat ${chatId} from Neon.`);

  return (
    <div className="flex max-h-screen overflow-hidden">
      <div className="flex w-full max-h-screen overflow-hidden">
        
        {/* Left: Sidebar */}
        <div className="flex-1 max-w-xs">
          <ChatSideBar chats={_chats} chatId={parseInt(chatId)} isPro={isPro}/>
        </div>

        {/* Middle: PDF Viewer */}
        <div className="max-h-screen p-4 overflow-y-auto flex-5">
          <PDFViewer pdfUrl={currentChat.pdfUrl} />
        </div>

        {/* Right: The AI Chatbox */}
        <div className="flex-3 border-l-4 border-l-slate-200">
          <ChatComponent chatId={parseInt(chatId)} initialMessages={formattedMessages} /> 
        </div>

      </div>
    </div>
  )
}

export default ChatPage