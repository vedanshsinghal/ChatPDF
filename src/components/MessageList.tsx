import React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Props = {
  isLoading: boolean;
  messages: any[]; // Using 'any' to bypass strict TS changes in SDK v6
}

const MessageList = ({ messages, isLoading }: Props) => {
  if (!messages) return <></>

  return (
    <div className="flex flex-col gap-2 px-4">
      {messages.map((message) => {
        // SDK v6 stores text in .parts array or .content string depending on setup
        const textContent = message.content || message.parts?.map((p: any) => p.text).join('');
        
        return (
          <div
            key={message.id}
            className={cn("flex", {
              "justify-end pl-10": message.role === "user",
              "justify-start pr-10": message.role === "assistant" || message.role === "system", 
            })}
          >
            <div
              className={cn(
                "rounded-lg px-3 text-sm py-1 shadow-md ring-1 ring-gray-900/10",
                {
                  "bg-blue-600 text-white": message.role === "user",
                }
              )}
            >
              <p>{textContent}</p>
            </div>
          </div>
        )
      })}
      
      {isLoading && (
         <div className="flex justify-center mt-4 mb-4">
           <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
         </div>
      )}
    </div>
  )
}

export default MessageList