import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiEmbeddings extends Embeddings {
  private client: any;
  private modelName: string;
  private dimensions: number;

  constructor(fields?: EmbeddingsParams & { apiKey?: string; modelName?: string; dimensions?: number }) {
    super(fields ?? {});
    const apiKey = fields?.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment variables or constructor fields");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = fields?.modelName || "gemini-embedding-001";
    this.dimensions = fields?.dimensions || 1536;
    this.client = genAI.getGenerativeModel({ model: this.modelName });
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const batchSize = 100;
    const results: number[][] = [];
    
    console.log(`[GeminiEmbeddings] Starting embedDocuments for ${documents.length} chunks`);
    for (let i = 0; i < documents.length; i += batchSize) {
      const chunk = documents.slice(i, i + batchSize);
      console.log(`[GeminiEmbeddings] Batch ${i} to ${i + chunk.length}`);
      
      try {
        const response = await this.client.batchEmbedContents({
          requests: chunk.map((text) => ({
            content: { role: "user", parts: [{ text }] },
            outputDimensionality: this.dimensions,
          })),
        });
        
        if (response && response.embeddings) {
          console.log(`[GeminiEmbeddings] Received ${response.embeddings.length} embeddings`);
          results.push(...response.embeddings.map((e: any) => e.values));
        } else {
          console.error(`[GeminiEmbeddings] WARNING: response.embeddings is undefined! Response:`, JSON.stringify(response).substring(0, 500));
        }
      } catch (err) {
        console.error(`[GeminiEmbeddings] API Error:`, err);
        throw err;
      }
    }
    console.log(`[GeminiEmbeddings] Returning ${results.length} vectors to LangChain`);
    return results;
  }

  async embedQuery(document: string): Promise<number[]> {
    const response = await this.client.embedContent({
      content: { role: "user", parts: [{ text: document }] },
      outputDimensionality: this.dimensions,
    });
    return response.embedding.values;
  }
}
