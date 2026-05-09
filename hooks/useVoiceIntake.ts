"use client";

import { useState, useCallback, useRef } from "react";
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
  mappedValues: string[];
  remainingIds: string[];
}

interface MatchResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
  resourceEmail: string | null;
  draftEmail: string;
  emailSubject: string;
}

interface MatchResults {
  narrative: string;
  results: MatchResult[];
}

export interface UseVoiceIntakeReturn {
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
  activeFilterIds: string[];
  begin: () => void;
  initFilterPool: (allIds: string[]) => void;
  startQuestion: () => Promise<void>;
  skipQuestion: () => void;
  confirmAnswer: () => void;
  retryMic: () => Promise<void>;
  switchToTextMode: () => void;
  submitTextAnswer: (text: string) => void;
}

export function useVoiceIntake(): UseVoiceIntakeReturn {
  const { user } = useAnonymousAuth();
  const [state, setState] = useState<IntakeState>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [confirmedAnswers, setConfirmedAnswers] = useState<ConfirmedAnswer[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);
  const [micError, setMicError] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [activeFilterIds, setActiveFilterIds] = useState<string[]>([]);
  const processingRef = useRef(false);

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
  const activeFilterIdsRef = useRef<string[]>([]);
  activeFilterIdsRef.current = activeFilterIds;

  const sessionId = user?.id ?? null;
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

  const initFilterPool = useCallback((allIds: string[]) => {
    setActiveFilterIds(allIds);
  }, []);

  const processAnswer = useCallback(
    async (questionIndex: number, rawTranscript: string, allAnswers: ConfirmedAnswer[]) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const currentSessionId = sessionIdRef.current;
      const currentFilterIds = activeFilterIdsRef.current;

      try {
        const res = await fetch("/api/process-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: currentSessionId,
            questionIndex,
            rawTranscript,
            currentIds: currentFilterIds,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[processAnswer] API error:", res.status, err);
          return;
        }

        const data = await res.json() as {
          extractedAnswer: string;
          mappedValues: string[];
          remainingIds: string[];
          isAnswered: boolean;
        };

        const newAnswer: ConfirmedAnswer = {
          questionIndex,
          extractedAnswer: data.extractedAnswer ?? rawTranscript,
          mappedValues: data.mappedValues ?? [],
          remainingIds: data.remainingIds ?? currentFilterIds,
        };

        const updatedAnswers = [...allAnswers, newAnswer];
        setConfirmedAnswers(updatedAnswers);

        // Update the filter pool after Q1-Q4
        if (questionIndex < 4) {
          setActiveFilterIds(data.remainingIds ?? currentFilterIds);
        }

        if (questionIndex === 4) {
          // Q5: free-form → embedding → top 5
          setState("complete");

          const matchRes = await fetch("/api/match-resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: currentSessionId,
              filterIds: currentFilterIds,
              freeFormAnswer: rawTranscript,
              allAnswers: confirmedAnswersRef.current.map(a => ({
                questionIndex: a.questionIndex,
                extractedAnswer: a.extractedAnswer,
              })),
            }),
          });
          const matchData = await matchRes.json() as MatchResults;
          setMatchResults(matchData);
          sessionStorage.setItem("nexis-results", JSON.stringify(matchData));
          // Stay on the page — VoiceIntake renders inline results
        } else {
          setState("confirmed");
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
    [resetTranscript]
  );

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
      mappedValues: [],
      remainingIds: activeFilterIdsRef.current,
    };
    const updated = [...confirmedAnswersRef.current, emptyAnswer];
    setConfirmedAnswers(updated);

    if (idx === 4) {
      setState("complete");
    } else {
      const nextIndex = idx + 1;
      setCurrentQuestionIndex(nextIndex);
      resetTranscript();
      setState("listening");
      if (inputModeRef.current === 'voice') {
        startListeningRef.current().catch((err: unknown) => {
          if (err instanceof MicDeniedError) {
            setMicError(true);
            setState("idle");
          }
        });
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
    activeFilterIds,
    begin,
    initFilterPool,
    startQuestion,
    skipQuestion,
    confirmAnswer,
    retryMic,
    switchToTextMode,
    submitTextAnswer,
  };
}
