// app/api/chat/route.ts
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Pinecone } from '@pinecone-database/pinecone';
import { GeminiEmbeddings } from '@/lib/gemini-embeddings';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { chats, messages as _messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// Create the Google Generative AI provider for the AI SDK
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { messages, chatId } = body;

    // Helper to extract content from AI SDK v6 UIMessages which use 'parts' instead of a flat 'content'
    const getMessageContent = (message: any): string => {
      if (typeof message.content === 'string') return message.content;
      if (Array.isArray(message.parts)) {
        return message.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
      }
      return '';
    };

    // Get the last user message (the actual question)
    const lastMessage = messages[messages.length - 1];
    const lastMessageContent = getMessageContent(lastMessage);

    // 1. Fetch the specific chat to confirm ownership and extract the file key
    const currentChats = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId));

    if (currentChats.length === 0 || currentChats[0].userId !== userId) {
      return NextResponse.json({ error: 'chat not found' }, { status: 404 });
    }
    const fileKey = currentChats[0].fileKey;

    // 2. Generate Vector Embeddings for the User's question using LangChain
    const embeddings = new GeminiEmbeddings({
      apiKey: process.env.GEMINI_API_KEY!,
      modelName: 'gemini-embedding-001',
      dimensions: 1536,
    });
    const queryEmbedding = await embeddings.embedQuery(lastMessageContent);

    // 3. Query Pinecone for the top 5 text chunks matching that embedding
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    const pineconeIndex = pinecone.Index({ name: 'chat-pdf' });

    const queryResponse = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
      filter: { fileKey: { $eq: fileKey } }
    });

    // DEBUG: Let's see what Pinecone is returning
    console.log('--- RAG DEBUG ---');
    console.log('User question:', lastMessageContent);
    console.log('Matches found:', queryResponse.matches?.length || 0);
    queryResponse.matches?.forEach((match, i) => {
      console.log(`Match ${i}: score=${match.score}, metadata keys=${Object.keys(match.metadata || {})}`);
      console.log(`  metadata.text preview:`, (match.metadata as any)?.text?.substring(0, 100) || 'EMPTY');
      console.log(`  metadata.pageContent preview:`, (match.metadata as any)?.pageContent?.substring(0, 100) || 'EMPTY');
    });

    // 4. Extract text from the matching chunks and concatenate them into a context block
    // LangChain's PineconeStore might store text as 'text' or 'pageContent' depending on version
    const context = queryResponse.matches
      ?.map((match) => {
        const meta = match.metadata as any;
        return meta?.text || meta?.pageContent || '';
      })
      .filter((text) => text.length > 0)
      .join('\n\n') || '';

    console.log('Context length:', context.length, 'chars');
    console.log('Context preview:', context.substring(0, 200) || 'COMPLETELY EMPTY');
    console.log('--- END DEBUG ---');

    // Save user message to the database
    await db.insert(_messages).values({
      chatId,
      content: lastMessageContent,
      role: 'user',
    });

    // 5. Use streamText from AI SDK — returns the format that useChat expects
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: `AI assistant is a brand new, powerful, human-like artificial intelligence.
      The characteristics of AI assistant include expert knowledge, helpfulness, cleverness, and articulateness.
      AI assistant is a well-behaved and up-to-date assistant.
      AI assistant is always friendly, kind, inspiring, and supportive.
      
      START CONTEXT BLOCK
      ${context}
      END CONTEXT BLOCK
      
      AI assistant will take into account any CONTEXT BLOCK provided above to answer the user's questions. 
      If the context does not contain the answer, AI assistant will answer truthfully based on general knowledge but will prioritize information from the context.
      AI assistant will never make up facts or links if they are not present in the context block.`,
      messages: messages.map((m: any) => ({ role: m.role, content: getMessageContent(m) })),
      onFinish: async ({ text }) => {
        // Save the AI's fully generated response to the database
        await db.insert(_messages).values({
          chatId,
          content: text,
          role: 'system',
        });
      }
    });

    // 6. Return the stream — useChat on the frontend understands this format!
    return result.toUIMessageStreamResponse();

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}