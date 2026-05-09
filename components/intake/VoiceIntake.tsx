"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { UseVoiceIntakeReturn } from "@/hooks/useVoiceIntake";
import { INTAKE_QUESTIONS } from "@/lib/intake/filterConstants";
import { InstructionSlide } from "./InstructionSlide";
import { QuestionDisplay } from "./QuestionDisplay";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { MicIndicator } from "./MicIndicator";
import { ConfirmedAnswer } from "./ConfirmedAnswer";
import { ResourceCard } from "@/components/results/ResourceCard";

export function VoiceIntake({
  state,
  currentQuestionIndex,
  confirmedAnswers,
  currentTranscript,
  interimTranscript,
  isListening,
  micError,
  matchResults,
  inputMode,
  begin,
  startQuestion,
  skipQuestion,
  confirmAnswer,
  retryMic,
  switchToTextMode,
  submitTextAnswer,
}: UseVoiceIntakeReturn) {
  const [textInput, setTextInput] = useState("");

  const handleBegin = () => {
    startQuestion().catch(console.error);
  };

  const currentQuestion = INTAKE_QUESTIONS[currentQuestionIndex];

  return (
    <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
      {/* Mic permission denied */}
      {micError && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "1.25rem",
              color: "white",
              margin: 0,
            }}
          >
            Microphone access is required.
          </p>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.875rem",
              color: "#666666",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            To enable your mic, click the camera icon in your browser&apos;s
            address bar and allow access, then try again. Or type your answers
            below.
          </p>
          <button
            onClick={() => retryMic().catch(console.error)}
            style={{
              padding: "10px 32px",
              border: "1px solid white",
              background: "transparent",
              color: "white",
              fontSize: "0.875rem",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            Try again
          </button>
          <button
            onClick={switchToTextMode}
            style={{
              background: "none",
              border: "none",
              color: "#666666",
              fontSize: "0.8rem",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            type instead
          </button>
        </div>
      )}

      {/* Confirmed answers stack — hidden once results render */}
      {!micError && confirmedAnswers.length > 0 && state !== "complete" && (
        <div style={{ marginBottom: "32px" }}>
          {confirmedAnswers.map((a) => (
            <ConfirmedAnswer
              key={a.questionIndex}
              answer={a.extractedAnswer}
              questionIndex={a.questionIndex}
            />
          ))}
        </div>
      )}

      {/* Idle */}
      {!micError && state === "idle" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "3rem",
              color: "white",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Resource Finder
          </p>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.9375rem",
              color: "#666666",
              margin: "0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Utah business resources, matched to your story.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              onClick={begin}
              style={{
                padding: "12px 40px",
                border: "1px solid white",
                background: "transparent",
                color: "white",
                fontSize: "1rem",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              Find your resources →
            </button>
            <button
              onClick={switchToTextMode}
              style={{
                background: "none",
                border: "none",
                color: "#666666",
                fontSize: "0.8rem",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              type instead
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!micError && state === "instructions" && (
        <InstructionSlide onBegin={handleBegin} />
      )}

      {/* Listening */}
      {!micError && state === "listening" && currentQuestion && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <QuestionDisplay question={currentQuestion.text} />

          {inputMode === "voice" ? (
            <>
              <TranscriptDisplay
                finalTranscript={currentTranscript}
                interimTranscript={interimTranscript}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  marginTop: "24px",
                }}
              >
                <MicIndicator isListening={isListening} />
                <div
                  style={{ display: "flex", gap: "24px", alignItems: "center" }}
                >
                  {currentTranscript && (
                    <button
                      onClick={confirmAnswer}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#888",
                        fontSize: "0.8rem",
                        fontFamily: "ui-sans-serif, system-ui, -apple-system",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      confirm
                    </button>
                  )}
                  <button
                    onClick={skipQuestion}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#666",
                      fontSize: "0.8rem",
                      fontFamily: "ui-sans-serif, system-ui, -apple-system",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    skip
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.25rem",
                  textAlign: "center",
                  lineHeight: 1.7,
                  color: "white",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #444444",
                  outline: "none",
                  width: "100%",
                  resize: "none",
                  padding: "8px 0",
                }}
              />
              <div
                style={{ display: "flex", gap: "24px", alignItems: "center" }}
              >
                {textInput.trim() && (
                  <button
                    onClick={() => {
                      submitTextAnswer(textInput);
                      setTextInput("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#888",
                      fontSize: "0.8rem",
                      fontFamily: "ui-sans-serif, system-ui, -apple-system",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    confirm
                  </button>
                )}
                <button
                  onClick={() => {
                    setTextInput("");
                    skipQuestion();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    fontSize: "0.8rem",
                    fontFamily: "ui-sans-serif, system-ui, -apple-system",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing */}
      {!micError && state === "processing" && currentQuestion && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <QuestionDisplay question={currentQuestion.text} />
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              color: "#666666",
              fontSize: "1.125rem",
              margin: "16px 0",
            }}
          >
            Processing...
          </p>
        </div>
      )}

      {/* Confirmed */}
      {!micError && state === "confirmed" && (
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              color: "#666666",
              fontSize: "1rem",
              margin: "0 0 8px",
            }}
          >
            Got it
          </p>
        </div>
      )}

      {/* Complete — loading results */}
      {!micError && state === "complete" && !matchResults && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "28px",
            width: "100%",
          }}
        >
          {/* Orbiting accent ring above the text */}
          <div style={{ position: "relative", width: "56px", height: "56px" }}>
            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                border: "1px solid #2a5e49",
                borderTopColor: "transparent",
                borderRadius: "50%",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "10px",
                height: "10px",
                marginTop: "-5px",
                marginLeft: "-5px",
                borderRadius: "50%",
                backgroundColor: "#2a5e49",
              }}
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.6, 1, 0.6] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>

          <motion.p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "1.25rem",
              color: "white",
              textAlign: "center",
              margin: 0,
            }}
            animate={{ opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            Finding your matches
          </motion.p>

          {/* Three dots that pulse in sequence */}
          <div style={{ display: "flex", gap: "10px" }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "#2a5e49",
                  display: "block",
                }}
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Complete — inline results */}
      {!micError && state === "complete" && matchResults && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            width: "100%",
          }}
        >
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "1rem",
              color: "#888",
              margin: "0 0 4px",
            }}
          >
            {matchResults.narrative}
          </p>
          {matchResults.results.map((result) => (
            <ResourceCard
              key={result.id}
              title={result.title}
              matchReason={result.matchReason}
              topics={result.topics}
              link={result.link}
              resourceEmail={result.resourceEmail}
              draftEmail={result.draftEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
}
