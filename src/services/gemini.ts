import { GoogleGenAI, Type } from "@google/genai";
import { Filters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function parseQuery(prompt: string, currentFilters: Filters): Promise<{
  searchQuery: string;
  newFilters: Filters;
  explanation: string;
}> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Current Filters: ${JSON.stringify(currentFilters)}
      User Prompt: "${prompt}"
      
      Extract search terms and structured filters from the user prompt.
      If the user is asking to "add" or "modify" filters, merge them with current filters.
      If the user is asking to "reset" or "clear", start fresh.
      
      Common filters:
      - yearStart, yearEnd (integers)
      - authors (array of strings)
      - publicationTypes (e.g., "Review", "Clinical Trial", "Journal Article")
      - excludeKeywords (array of strings)
      - includeKeywords (array of strings)
      - onlyOA (boolean)
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          searchQuery: { type: Type.STRING, description: "The main keywords for API search" },
          newFilters: {
            type: Type.OBJECT,
            properties: {
              yearStart: { type: Type.INTEGER },
              yearEnd: { type: Type.INTEGER },
              authors: { type: Type.ARRAY, items: { type: Type.STRING } },
              publicationTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
              excludeKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              includeKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              onlyOA: { type: Type.BOOLEAN },
              sortBy: { type: Type.STRING, description: "One of: 'year', 'citationCount', 'title'" },
            }
          },
          explanation: { type: Type.STRING, description: "A one-sentence summary of what was applied" }
        },
        required: ["searchQuery", "newFilters", "explanation"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function summarizePaper(paper: any): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this academic paper in 2-3 concise sentences for a researcher:
    Title: ${paper.title}
    Abstract: ${paper.abstract}`,
  });
  return response.text || "No summary available.";
}
