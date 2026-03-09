import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const quizSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: "Type of question: 'mcq', 'truefalse', 'short', or 'matching'",
          },
          question: {
            type: Type.STRING,
            description: "The main question text or context",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Options for multiple choice questions",
          },
          answer: {
            type: Type.STRING,
            description: "The correct answer (index as string for MCQ, or text for short answer)",
          },
          statements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Statements for true/false questions",
          },
          answers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Answers for true/false ('D' for True, 'S' for False) or indices for matching",
          },
          placeholder: {
            type: Type.STRING,
            description: "Placeholder text for short answer input",
          },
          left: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Left side items for matching questions",
          },
          right: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Right side items for matching questions",
          },
        },
        required: ["type", "question"],
      },
    },
  },
  required: ["questions"],
};

export async function* digitizePdfStream(fileBase64: string, mimeType: string) {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContentStream({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Extract all questions from this PDF and convert them into the specified JSON format. 
            Follow these rules:
            1. For MCQ: type='mcq', options is array of strings, answer is the index (0-based) of the correct option as a string.
            2. For True/False: type='truefalse', statements is array of strings, answers is array of 'D' (True) or 'S' (False).
            3. For Short Answer: type='short', placeholder is a hint, answer is the correct text.
            4. For Matching: type='matching', left and right are arrays of strings, answers is an array of indices mapping left items to right items.
            
            IMPORTANT: If the questions contain mathematical formulas, you MUST use LaTeX format. 
            Wrap inline math with $...$ and block math with $$...$$.
            
            Ensure the output is valid JSON according to the schema. Output ONLY the JSON.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
    },
  });

  for await (const chunk of response) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
