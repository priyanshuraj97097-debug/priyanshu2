import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionEvent = {
  resultIndex: number;
  results: { isFinal: boolean; 0: { transcript: string }; length: number }[] & { length: number };
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Real browser speech recognition. Audio never leaves the browser — only the
 * resulting text is placed in the composer.
 */
export function useSpeechInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback((onError: (message: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onError("Voice input isn't supported in this browser.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    let recognition: Recognition;
    try {
      recognition = new Ctor();
    } catch {
      onError("Voice input isn't available right now.");
      return;
    }
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result?.isFinal) text += result[0].transcript;
      }
      if (text.trim()) onTextRef.current(text.trim());
    };
    recognition.onerror = (e) => {
      const map: Record<string, string> = {
        "not-allowed": "Microphone permission was denied.",
        "service-not-allowed": "Microphone permission was denied.",
        "audio-capture": "No microphone was found.",
        network: "Connection interrupted. Please try again.",
      };
      if (e.error !== "aborted" && e.error !== "no-speech") {
        onError(map[e.error] ?? "Voice input failed. Please try again.");
      }
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      onError("Voice input failed to start.");
    }
  }, []);

  return { listening, supported, start, stop };
}
