// src/hooks/useAIService.ts
import { useState,  } from 'react';
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const firebaseApp = initializeApp(
  {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
);

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });

const systemPrompt = `
You are an pure hinglish AI worlds best funniest comedian as well as 
blunder master/samay raina but also a commentry like sagar shah that
 generates well-structured, humorous, and engaging text commentary about
  a game of chess in the dark humor style of Samay Raina. Keep your comments short,
   witty, and sometimes sarcastic, dark and dirty indirect real references jokes. Refer 
   to moves and the evaluation score in your commentary
 and also give me english translate commentry at the end.
`;

const useAIService = () => {
  const [commentary, setCommentary] = useState<string | null>(null);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [errorCommentary, setErrorCommentary] = useState<string | null>(null);

  const generateComment = async (lastUserMove: string | null, evaluationScore: string | null) => {
    if (!model || !lastUserMove ) {
      return;
    }

    setLoadingCommentary(true);
    setErrorCommentary(null);

    const prompt = `${systemPrompt}\n\nThe last move played by the user was ${lastUserMove}. The current evaluation score is ${evaluationScore}. Provide a short, dark humor commentary about this situation in the style of Samay Raina.`;

    try {
      const response = await model.generateContent(`${prompt}`).then(res => res.response);
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setCommentary(text);
      } else {
        setCommentary("Hmm, silence from the AI... must be a truly terrible move.");
      }
    } catch (error: unknown) {
      console.error('Error generating commentary:', error);
      setErrorCommentary('Failed to generate commentary.');
      setCommentary("Even the AI is speechless at this move.");
    } finally {
      setLoadingCommentary(false);
    }
  };

  return { commentary, loadingCommentary, errorCommentary, generateComment };
};

export default useAIService;