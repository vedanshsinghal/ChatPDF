// /api/create-chat/route.ts
import { NextResponse } from "next/server";

// Use pdf-parse's internal library file directly to bypass the buggy index.js debug block
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import { GeminiEmbeddings } from "@/lib/gemini-embeddings";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

import { eq } from "drizzle-orm";

import { checkSubscription } from "@/lib/subscription";

export async function POST(req: Request) {
    try {
        const { userId } = await auth(); 
        if (!userId) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const isPro = await checkSubscription();
        const _chats = await db.select().from(chats).where(eq(chats.userId, userId));
        
        if (!isPro && _chats.length >= 30) {
            return NextResponse.json({ error: "Free tier limit reached. Please upgrade to Pro." }, { status: 403 });
        }
        
        const body = await req.json();
        const { fileName, fileUrl } = body;

        // Fetch the PDF and convert to a Node.js Buffer (not Blob!)
        console.log(`Downloading PDF from Supabase URL: ${fileUrl}`);
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`Downloaded Buffer size: ${buffer.length} bytes`);

        console.log("Reading the PDF text...");
        
        // pdf-parse v1.1.1 works directly with Buffer — no workers, no pdfjs-dist issues
        const pdfData = await pdfParse(buffer);
        console.log(`pdf-parse extracted ${pdfData.text.length} characters and ${pdfData.numpages} pages`);
        
        if (!pdfData.text || pdfData.text.trim().length === 0) {
            console.error("CRITICAL: Extracted text is empty! This could be a scanned PDF (images only) or an invalid download.");
        }

        // Create a LangChain Document from the extracted text
        const docs = [
            new Document({
                pageContent: pdfData.text,
                metadata: { source: fileName, totalPages: pdfData.numpages },
            }),
        ];

        console.log("Chopping the text into chunks...");
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200, 
        });

        const chunkedDocs = await textSplitter.splitDocuments(docs);
        console.log(`Chopped the PDF into ${chunkedDocs.length} chunks.`);

        console.log("Connecting to Pinecone...");
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY!,
        });    
        const pineconeIndex = pinecone.Index({ name: "chat-pdf" }); 

        console.log("Generating Gemini Embeddings...");
        const embeddings = new GeminiEmbeddings({
            apiKey: process.env.GEMINI_API_KEY!,
            modelName: "gemini-embedding-001",
            dimensions: 1536,
        });

        // 1. Get raw vectors from Gemini
        const texts = chunkedDocs.map((doc) => doc.pageContent);
        const vectors = await embeddings.embedDocuments(texts);
        
        console.log(`Uploading ${vectors.length} vectors to Pinecone...`);
        
        // 2. Format them for Pinecone v7 SDK
        // (LangChain's PineconeStore breaks here because it doesn't support Pinecone v7's new format)
        const pineconeRecords = vectors.map((values, i) => {
            const metadata = {
                ...chunkedDocs[i].metadata,
                text: chunkedDocs[i].pageContent,
                fileKey: fileUrl, // <--- Added this to allow RAG isolation
            };
            
            // Pinecone does not allow nested objects in metadata. 
            // LangChain's text splitter adds a nested `loc` object (line numbers), so we must delete it.
            if ((metadata as any).loc) {
                delete (metadata as any).loc;
            }
            
            return {
                id: `${fileName}-chunk-${i}-${Date.now()}`,
                values: values,
                metadata: metadata
            };
        });

        // 3. Upload to Pinecone directly
        await pineconeIndex.upsert({ records: pineconeRecords });

        console.log("Successfully uploaded vectors to Pinecone!");
        
        const chat_id = await db.insert(chats).values({
            fileKey: fileUrl, 
            pdfName: fileName,
            pdfUrl: fileUrl,
            userId: userId,
        }).returning({
            insertedId: chats.id
        });

        return NextResponse.json({ chat_id: chat_id[0].insertedId }, { status: 200 });

    } catch (error) {
        console.error("Error in create-chat:", error);
        return NextResponse.json({ error: "internal server error" }, { status: 500 });
    }
}