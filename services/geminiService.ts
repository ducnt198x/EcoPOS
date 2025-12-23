import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeRevenueData = async (data: any): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Unable to analyze data.";
  }

  try {
    const prompt = `
      Analyze the following restaurant revenue data JSON and provide 3 brief, high-impact insights and 1 actionable recommendation to improve sales.
      Keep the tone professional but concise.
      
      Data: ${JSON.stringify(data)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this time.";
  }
};

export const generateItemDescription = async (itemName: string, category: string): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Delicious and fresh.";
    }

    try {
        const prompt = `Write a short, appetizing, 1-sentence description for a restaurant menu item named "${itemName}" in the category "${category}". Keep it under 20 words.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "";
    }
}
