"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useDeepgram, MicDeniedError } from "@/hooks/useDeepgram";
import { createClient } from "@/lib/supabase/client";

export type IntakeState =
  | "idle"
  | "instructions"
  | "listening"
  | "processing"
  | "confirmed"
  | "complete";

export interface ConfirmedAnswer {
  questionIndex: number;
  extractedAnswer: string;
  structured: Record<string, unknown>;
}

interface MatchResults {
  narrative: string;
  results: Array<{
    id: string;
    title: string;
    matchReason: string;
    topics: string[];
    link: string;
  }>;
}

interface UseVoiceIntakeReturn {
  state: IntakeState;
  currentQuestionIndex: number;
  confirmedAnswers: ConfirmedAnswer[];
  currentTranscript: string;
  interimTranscript: string;
  isListening: boolean;
  micError: boolean;
  sessionId: string | null;
  matchResults: MatchResults | null;
  inputMode: 'voice' | 'text';
  begin: () => void;
  startQuestion: () => Promise<void>;
  skipQuestion: () => void;
  confirmAnswer: () => void;
  retryMic: () => Promise<void>;
  switchToTextMode: () => void;
  submitTextAnswer: (text: string) => void;
}

const QUESTIONS = [
  {
    text: "Do you identify with any of these founder communities — veteran, woman, rural founder, immigrant, or LGBTQ+? You can name one, a few, or skip it if none apply.",
    extractionHint:
      "Extract which founder communities the person identifies with. Valid values: Veteran, Woman, Rural, Immigrant, LGBTQ+. Return { communities: string[] }. Return empty array if none.",
  },
  {
    text: "Where in Utah are you based or operating? You can name a city, a county, or describe the region — like Salt Lake, St. George, Cache Valley, or rural southern Utah.",
    extractionHint:
      "Extract the Utah location. Map city names to county names (Salt Lake City → Salt Lake, St. George → Washington, Provo → Utah, Ogden → Weber, Logan → Cache, Cedar City → Iron, Moab → Grand). Return { counties: string[] }.",
  },
  {
    text: "Tell me about your business — what you do and where you are in the journey. Are you still in the idea phase, just getting started, or already running something?",
    extractionHint:
      "Extract business industry (one phrase), stage (one of: pre-idea, idea, early, growth, scaling), and a brief description (1-2 sentences). Return { industry: string, stage: string, description: string }.",
  },
  {
    text: "What's the most pressing thing you need help with right now? For example — finding funding or loans, figuring out how to get started, growing or scaling, marketing and sales, or connecting with other entrepreneurs and mentors.",
    extractionHint:
      "Extract primary need (one phrase) and relevant topics. Valid topics: Funding, Start a Business, Growing a Business, Marketing, Networking. Return { primaryNeed: string, topics: string[] }.",
  },
];

export function useVoiceIntake(): UseVoiceIntakeReturn {
  const router = useRouter();
  const { user } = useAnonymousAuth();
  const [state, setState] = useState<IntakeState>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [confirmedAnswers, setConfirmedAnswers] = useState<ConfirmedAnswer[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);
  const [micError, setMicError] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const processingRef = useRef(false);

  // Refs so event handlers always read latest values without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  currentQuestionIndexRef.current = currentQuestionIndex;
  const confirmedAnswersRef = useRef(confirmedAnswers);
  confirmedAnswersRef.current = confirmedAnswers;
  const sessionIdRef = useRef(user?.id ?? null);
  sessionIdRef.current = user?.id ?? null;
  const inputModeRef = useRef<'voice' | 'text'>('voice');
  inputModeRef.current = inputMode;

  const sessionId = user?.id ?? null;

  // Forward ref so handleSilence can call processAnswer without stale deps
  const triggerProcessRef = useRef<(() => void) | null>(null);

  const handleSilence = useCallback(() => {
    triggerProcessRef.current?.();
  }, []);

  const {
    transcript,
    interimTranscript,
    isConnected,
    startListening,
    stopListening,
    resetTranscript,
    requestPermission,
  } = useDeepgram(handleSilence);

  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  const processAnswer = useCallback(
    async (questionIndex: number, rawTranscript: string, allAnswers: ConfirmedAnswer[]) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const question = QUESTIONS[questionIndex];
      const currentSessionId = sessionIdRef.current;

      try {
        const res = await fetch("/api/process-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            questionIndex,
            questionText: question.text,
            extractionHint: question.extractionHint,
            rawTranscript,
          }),
        });

        const data = await res.json();
        const newAnswer: ConfirmedAnswer = {
          questionIndex,
          extractedAnswer: data.extractedAnswer ?? rawTranscript,
          structured: data.structured ?? {},
        };

        const updatedAnswers = [...allAnswers, newAnswer];
        setConfirmedAnswers(updatedAnswers);

        if (questionIndex === 3) {
          setState("complete");

          const profile = {
            communities:
              (updatedAnswers[0]?.structured?.communities as string[]) ?? [],
            counties:
              (updatedAnswers[1]?.structured?.counties as string[]) ?? [],
            industry:
              (updatedAnswers[2]?.structured?.industry as string) ?? "",
            stage: (updatedAnswers[2]?.structured?.stage as string) ?? "",
            description:
              (updatedAnswers[2]?.structured?.description as string) ??
              updatedAnswers[2]?.extractedAnswer ??
              "",
            primaryNeed:
              (updatedAnswers[3]?.structured?.primaryNeed as string) ?? "",
            topics:
              (updatedAnswers[3]?.structured?.topics as string[]) ?? [],
          };

          const matchRes = await fetch("/api/match-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSessionId, profile }),
          });
          const matchData = await matchRes.json();
          setMatchResults(matchData);
          sessionStorage.setItem("nexis-results", JSON.stringify(matchData));

          setTimeout(() => router.push("/results"), 600);
        } else {
          setState("confirmed");
          // Auto-advance: show confirmed for 1200ms then start next question
          setTimeout(async () => {
            const nextIndex = questionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            resetTranscript();
            setState("listening");
            if (inputModeRef.current === 'voice') {
              try {
                await startListeningRef.current();
              } catch (err) {
                if (err instanceof MicDeniedError) {
                  setMicError(true);
                  setState("idle");
                }
              }
            }
          }, 1200);
        }
      } finally {
        processingRef.current = false;
      }
    },
    [router, resetTranscript]
  );

  // Always keep triggerProcessRef up to date
  const processAnswerRef = useRef(processAnswer);
  processAnswerRef.current = processAnswer;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  triggerProcessRef.current = () => {
    if (stateRef.current !== "listening") return;
    const t = transcriptRef.current.trim();
    if (t.length < 10) return;

    stopListeningRef.current();
    setState("processing");
    processAnswerRef.current(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  };

  const begin = useCallback(async () => {
    const permState = await requestPermission();
    if (permState === 'denied') {
      setMicError(true);
      return;
    }
    setState("instructions");
  }, [requestPermission]);

  const startQuestion = useCallback(async () => {
    if (currentQuestionIndexRef.current === 0 && sessionIdRef.current) {
      const supabase = createClient();
      await supabase.from("intake_sessions").upsert(
        {
          id: sessionIdRef.current,
          status: "in_progress",
          started_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    resetTranscript();
    setState("listening");
    try {
      await startListening();
    } catch (err) {
      if (err instanceof MicDeniedError) {
        setMicError(true);
        setState("idle");
      }
    }
  }, [resetTranscript, startListening]);

  const skipQuestion = useCallback(() => {
    stopListening();
    const idx = currentQuestionIndexRef.current;
    const emptyAnswer: ConfirmedAnswer = {
      questionIndex: idx,
      extractedAnswer: "",
      structured: {},
    };
    const updated = [...confirmedAnswersRef.current, emptyAnswer];
    setConfirmedAnswers(updated);

    if (idx === 3) {
      setState("complete");
    } else {
      setCurrentQuestionIndex(idx + 1);
      resetTranscript();
      if (inputModeRef.current === 'text') {
        setState("listening");
      } else {
        setState("instructions");
      }
    }
  }, [stopListening, resetTranscript]);

  const switchToTextMode = useCallback(() => {
    setInputMode('text');
    setMicError(false);
    resetTranscript();
    setState('listening');
  }, [resetTranscript]);

  const submitTextAnswer = useCallback((text: string) => {
    const t = text.trim();
    if (!t) return;
    setState("processing");
    processAnswer(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  }, [processAnswer]);

  const confirmAnswer = useCallback(() => {
    if (stateRef.current !== "listening") return;
    const t = transcriptRef.current.trim();
    if (!t) return;

    stopListening();
    setState("processing");
    processAnswer(
      currentQuestionIndexRef.current,
      t,
      confirmedAnswersRef.current
    );
  }, [processAnswer, stopListening]);

  const retryMic = useCallback(async () => {
    setInputMode('voice');
    setMicError(false);
    resetTranscript();
    setState("listening");
    try {
      await startListening();
    } catch (err) {
      if (err instanceof MicDeniedError) {
        setMicError(true);
        setState("idle");
      }
    }
  }, [resetTranscript, startListening]);

  return {
    state,
    currentQuestionIndex,
    confirmedAnswers,
    currentTranscript: transcript,
    interimTranscript,
    isListening: isConnected,
    micError,
    sessionId,
    matchResults,
    inputMode,
    begin,
    startQuestion,
    skipQuestion,
    confirmAnswer,
    retryMic,
    switchToTextMode,
    submitTextAnswer,
  };
}
