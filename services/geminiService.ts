
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PredictionResponse, HealthAnalysisResponse } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const identifyBreed = async (base64Image: string): Promise<PredictionResponse> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        {
          text: "Identify the animal in this image. Provide: animal type, breed name, confidence (0-100), short description, 3 similar breeds, estimated market price in USD, primary uses (e.g. companionship, guard, farm), life expectancy (e.g. 10-15 years), a structured daily diet routine, and an exercise plan. Use current market estimates for pricing.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          animalType: { type: Type.STRING },
          breedName: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          description: { type: Type.STRING },
          similarBreeds: { type: Type.ARRAY, items: { type: Type.STRING } },
          price: { type: Type.NUMBER },
          uses: { type: Type.ARRAY, items: { type: Type.STRING } },
          lifeExpectancy: { type: Type.STRING },
          dietRoutine: { type: Type.STRING },
          exercisePlan: { type: Type.STRING },
        },
        required: ["animalType", "breedName", "confidence", "description", "similarBreeds", "price", "uses", "lifeExpectancy", "dietRoutine", "exercisePlan"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("AI failed to return identification results.");
  return JSON.parse(text);
};

export const detectAnimalDiseases = async (base64Image: string, animalType: string): Promise<HealthAnalysisResponse> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        {
          text: `Perform a visual health scan for this ${animalType}. Look for skin, eye, dental issues, or injuries. Return a JSON report.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isHealthy: { type: Type.BOOLEAN },
          summary: { type: Type.STRING },
          potentialIssues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                description: { type: Type.STRING },
                recommendedAction: { type: Type.STRING }
              },
              required: ["issue", "severity", "description", "recommendedAction"]
            }
          }
        },
        required: ["isHealthy", "summary", "potentialIssues"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Health analysis failed.");
  return JSON.parse(text);
};

export const getBreedFacts = async (breedName: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Tell me 3 unique fun facts about ${breedName}.`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return {
    text: response.text,
    sources: sources.map((s: any) => s.web).filter(Boolean)
  };
};

export const generateSimilarBreedImage = async (breedName: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A realistic photo of a ${breedName}.` }] },
  });
  const parts = response.candidates?.[0]?.content.parts || [];
  for (const part of parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Failed to generate image.");
};

export const generateBreedAudio = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000, numChannels: number = 1): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}
