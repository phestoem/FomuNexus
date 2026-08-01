"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shouldSubmitSpeechOnEnd } from "@/lib/nexus/speech-input-end";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from "@/lib/nexus/speech-recognition";

type UseSpeechInputOptions = {
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechInput(options: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const optionsRef = useRef(options);
  // Set when a non-aborted recognition error fires before `onend`.
  const recognitionFailedRef = useRef(false);

  optionsRef.current = options;

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      optionsRef.current.onError?.(
        "Voice input is not supported in this browser.",
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";
    recognitionFailedRef.current = false;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = transcriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      transcriptRef.current = finalTranscript;
      const combinedTranscript = `${finalTranscript}${interimTranscript}`.trim();
      optionsRef.current.onInterimTranscript(combinedTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        recognitionFailedRef.current = true;
        optionsRef.current.onError?.(
          event.error === "not-allowed"
            ? "Microphone permission was denied."
            : "Voice capture failed. Please try again.",
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      const recognitionFailed = recognitionFailedRef.current;
      recognitionFailedRef.current = false;

      const finalTranscript = transcriptRef.current.trim();
      if (
        shouldSubmitSpeechOnEnd({
          recognitionFailed,
          transcript: finalTranscript,
        })
      ) {
        optionsRef.current.onFinalTranscript(finalTranscript);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionFailedRef.current = true;
      optionsRef.current.onError?.("Unable to start voice capture.");
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }

    startListening();
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    toggleListening,
    stopListening,
  };
}
