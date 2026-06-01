"use client"
import { Inbox } from 'lucide-react'
import React, {useState} from 'react'
import {useDropzone} from "react-dropzone"
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation"; // 1. Import the router

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // (Usually NEXT_PUBLIC_SUPABASE_ANON_KEY)
)

const FileUpload = () => {
  const router = useRouter(); // 2. Initialize the router
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps }=useDropzone({
    accept:{"application/pdf":[".pdf"]},
    maxFiles:1,
    onDrop: async (acceptedFiles)=>{
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        setUploading(true);
        
        // Create a unique file name so users don't overwrite each other's files
        const fileName = `${Date.now()}-${file.name.replace(/\s/g, "-")}`;

        // Upload the file to your 'pdfs' bucket
        const { data, error } = await supabase.storage
          .from("PDFs")
          .upload(fileName, file);

        if (error) throw error;

        // Grab the public URL so we can save it to Neon Database next
        const { data: publicUrlData } = supabase.storage
          .from("PDFs")
          .getPublicUrl(fileName);

        console.log("Success! Here is your file URL:", publicUrlData.publicUrl);
        
          try {
            const response = await fetch('/api/create-chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: fileName,
                fileUrl: publicUrlData.publicUrl // send the Supabase URL
              })
            });
            
            if (!response.ok) {
              if (response.status === 403) {
                 const errorData = await response.json();
                 alert(errorData.error);
                 return;
              }
              throw new Error("Something went wrong");
            }
    
            const data = await response.json();
            console.log("Backend responded:", data);
            
            // 3. Redirect the user to their new chat page!
            if (data.chat_id) {
              router.push(`/chat/${data.chat_id}`);
            }

        } catch (error) {
          console.error("Failed to ping backend:", error);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      } finally {
        setUploading(false);
      }
    }
  })

  return (
    <div className='p-2 bg-white rounded-xl'>
      <div {...getRootProps({className:"border-dashed border-2 rounded-xl cursor-pointer bg-gray-50 py-8 flex justify-center items-center flex-col"})}>
        <input {...getInputProps()}></input>
        
        {uploading ? (
          <p className="text-sm text-blue-500 font-semibold">
            Uploading to Supabase...
          </p>
        ) : (
          <>
            <Inbox className='w-10 h-10 text-blue-500'/>
            <p className='mt-2 text-sm text-slate-400'>Drop your PDF here</p>
          </>
        )}
      </div>
    </div>
  )
}

export default FileUpload