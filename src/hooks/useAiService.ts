// src/hooks/useAIService.ts
import { useState, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });

const systemPrompt = `
You are a pure Hinglish AI,
 the world's best funniest comedian, a blunder master 
 like Samay Raina, with commentary skills like Sagar Shah.
  Generate well-structured, humorous, and engaging chess commentary 
  in Samay's dark humor style. Keep comments short, witty, sarcastic, 
  with dirty indirect real-world references and jokes. Include the move 
  and evaluation score. Add some Hinglish slang (e.g., "bhai",
   "abe", "fatafat") and exaggerated expressions (e.g., "Arre wah!", 
   "Kya bakwas hai!","crazy"). 
   End with an English translation of the commentary.
   do not use asterisks or any other formatting in the response. 
`;

const useAIService = () => {
  const [commentary, setCommentary] = useState<string | null>(null);
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [errorCommentary, setErrorCommentary] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const generateComment = async (lastUserMove: string | null, evaluationScore: string | null,muted: boolean) => {
    if (!model || !lastUserMove) {
      setErrorCommentary('Bhai, no move? AI ko kya roast karna hai?');
      return;
    }

    setLoadingCommentary(true);
    setErrorCommentary(null);

    const prompt = `${systemPrompt}\n\nThe last move played by the user was ${lastUserMove}. The current evaluation score is ${evaluationScore}. Provide a short, dark humor commentary in Samay Raina's style with Hinglish slang and an English translation.`;

    try {
      const response = await model.generateContent(prompt).then(res => res.response);
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && !muted) {
        setCommentary(text);
        speak(text);
      } else {
        const fallback = "Abe, ye move itna kharab tha, AI bhi chup ho gaya!";
        setCommentary(fallback);
        speak(fallback);
      }
    } catch (error: unknown) {
      console.error('Error generating commentary:', error);
      setErrorCommentary('AI ko samajh nahi aaya ye move, bhai!');
      const fallback = "Ye kya bakwas move tha? AI bhi faint ho gaya!";
      setCommentary(fallback);
      speak(fallback);
    } finally {
      setLoadingCommentary(false);
    }
  };

  const speak = useCallback((text: string) => {
    // console.log("Speaking text:", text);
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported. Upgrade your browser, bhai!');
      return;
    }

    const getVoices = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        resolve(voices);
        return;
      }
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };
    });

    getVoices().then((voices) => {
      const utterance = new SpeechSynthesisUtterance(text);
      let voice = voices.find(v => v.lang === 'hi-IN');
      if (!voice) {
        voice = voices.find(v => v.lang.includes('en-') && v.name.includes('Google')) || voices[0];
        console.warn('No Hindi voice found, using:', voice?.name);
      }
      utterance.voice = voice || null;
      utterance.lang = voice?.lang || 'en-US';
      utterance.rate = 1.0; // Slightly increased the rate
      utterance.pitch = 1.0;
      utterance.volume = 1;

      setIsSpeaking(true);
      window.speechSynthesis.cancel();

      // Add a slight delay before speaking
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100); // Adjust the delay (in milliseconds) as needed

      utterance.onend = () => {
        console.log('Speech ended');
        setIsSpeaking(false);
      };
      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        setIsSpeaking(false);
        setErrorCommentary('Voice nahi chali, bhai. Browser ka mood kharab hai!');
      };
    });
  }, []);
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return { commentary, loadingCommentary, errorCommentary, generateComment, isSpeaking ,stopSpeaking};
};

export default useAIService;