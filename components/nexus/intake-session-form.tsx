"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  nexusNextStepResponseSchema,
  type ActionExecuted,
  type BlueprintContext,
  type CompiledBlueprintResult,
  type MissingFieldHint,
  type NextStep,
  type NexusNextStepResponse,
} from "@/lib/nexus/schemas";
import { buildOmniPlaceholder } from "@/lib/nexus/intent-guidance";
import { IntentGuidance } from "@/components/nexus/intent-guidance";
import { shouldApplyIntakeResponse } from "@/lib/nexus/intake-session-client";
import { stripInternalCapturedKeys } from "@/lib/nexus/meta-blueprint-shared";
import {
  formatCapturedValue,
  formatFieldLabel,
} from "@/lib/nexus/display-utils";
import { type JsonValue } from "@/lib/nexus/target-schema";
import styles from "./intake-form.module.css";
import { useSpeechInput } from "./use-speech-input";

type CapturedData = Record<string, unknown>;

function MicrophoneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </svg>
  );
}

async function requestNextStep(
  sessionId: string,
  userInput?: string,
): Promise<NexusNextStepResponse> {
  const response = await fetch("/api/nexus/next-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      userInput !== undefined && userInput.length > 0
        ? { sessionId, userInput }
        : { sessionId },
    ),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorBody?.error ?? "Failed to fetch the next intake step.");
  }

  const payload = await response.json();
  return nexusNextStepResponseSchema.parse(payload);
}

function mergeCapturedData(
  current: CapturedData,
  extracted: CapturedData,
): CapturedData {
  return { ...current, ...extracted };
}

function isValidNumberInput(value: string): boolean {
  if (value.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Number(value));
}

function supportsOmniInput(question: NextStep): boolean {
  return question.componentType === "text";
}

function PageShell({
  children,
  embedded = false,
}: {
  children: React.ReactNode;
  embedded?: boolean;
}) {
  return (
    <main className={embedded ? styles.embeddedShell : styles.shell}>
      <div className={embedded ? styles.embeddedContainer : styles.container}>
        {children}
      </div>
    </main>
  );
}

function QuestionInput(props: {
  question: NextStep;
  userInput: string;
  loading: boolean;
  isListening: boolean;
  isSpeechSupported: boolean;
  omniPlaceholder?: string;
  onInputChange: (value: string) => void;
  onSelectOption: (value: string) => void;
  onToggleSpeech: () => void;
}) {
  const {
    question,
    userInput,
    loading,
    isListening,
    isSpeechSupported,
    omniPlaceholder,
    onInputChange,
    onSelectOption,
    onToggleSpeech,
  } = props;

  if (question.componentType === "select" && question.options?.length) {
    return (
      <fieldset className={styles.optionGrid} disabled={loading}>
        <legend className={styles.srOnly}>{question.questionPrompt}</legend>
        {question.options.map((option) => {
          const isSelected = userInput === option;
          const optionId = `${question.fieldKey}-${option.replace(/\s+/g, "-").toLowerCase()}`;

          return (
            <label
              key={option}
              htmlFor={optionId}
              className={[
                styles.optionLabel,
                isSelected ? styles.optionLabelSelected : "",
                loading ? styles.optionLabelDisabled : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                id={optionId}
                type="radio"
                name={question.fieldKey}
                value={option}
                checked={isSelected}
                disabled={loading}
                onChange={() => onSelectOption(option)}
                className={styles.optionInput}
              />
              {option}
            </label>
          );
        })}
      </fieldset>
    );
  }

  if (question.componentType === "date") {
    return (
      <input
        type="date"
        value={userInput}
        disabled={loading}
        onChange={(event) => {
          const value = event.target.value;
          onInputChange(value);
          if (value) {
            onSelectOption(value);
          }
        }}
        className={styles.dateInput}
      />
    );
  }

  if (supportsOmniInput(question)) {
    const helperText = isListening
      ? "Listening… tap the microphone again when you are done."
      : "One message can fill multiple fields at once.";

    return (
      <div className={styles.omniComposer}>
        <div
          className={[
            styles.omniInputShell,
            isListening ? styles.omniInputShellActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <textarea
            key={omniPlaceholder}
            value={userInput}
            disabled={loading}
            placeholder={omniPlaceholder ?? "Type or paste your answer…"}
            rows={5}
            onChange={(event) => onInputChange(event.target.value)}
            className={[styles.omniTextArea, styles.omniTextAreaAnimated]
              .filter(Boolean)
              .join(" ")}
          />
          <div className={styles.omniToolbar}>
            <p className={styles.omniToolbarHint}>{helperText}</p>
            {isSpeechSupported ? (
              <button
                type="button"
                disabled={loading}
                onClick={onToggleSpeech}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                aria-pressed={isListening}
                className={[
                  styles.omniMicButton,
                  isListening ? styles.omniMicButtonActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MicrophoneIcon size={22} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode={question.componentType === "number" ? "decimal" : "text"}
      value={userInput}
      disabled={loading}
      placeholder={
        question.componentType === "number"
          ? "Enter a number"
          : "Type your answer"
      }
      onChange={(event) => onInputChange(event.target.value)}
      className={styles.textInput}
    />
  );
}

function FormIdentity({
  blueprintContext,
  creatorCopilot,
}: {
  blueprintContext: BlueprintContext | null;
  creatorCopilot: boolean;
}) {
  if (blueprintContext) {
    return (
      <div className={styles.formIdentity}>
        <p className={styles.eyebrow}>
          {creatorCopilot ? "Creator Co-Pilot" : "Intake form"}
        </p>
        <h1 className={styles.formTitle}>{blueprintContext.label}</h1>
        {blueprintContext.description ? (
          <p className={styles.formDescription}>{blueprintContext.description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.formIdentity}>
      <p className={styles.eyebrow}>
        {creatorCopilot ? "Creator Co-Pilot" : "Intake"}
      </p>
    </div>
  );
}

function getPriorityBadgeClass(priority: ActionExecuted["priority"]) {
  switch (priority) {
    case "HIGH":
      return styles.priorityHigh;
    case "MEDIUM":
      return styles.priorityMedium;
    case "LOW":
      return styles.priorityLow;
    default:
      return styles.priorityMedium;
  }
}

function getDestinationLabel(destination: ActionExecuted["destination"]) {
  switch (destination) {
    case "SLACK_ALERTS":
      return "Slack Alerts";
    case "EMAIL_DISPATCH":
      return "Email Dispatch";
    case "CRM_DATABASE":
      return "CRM Database";
    default:
      return destination;
  }
}

function formatPriority(priority: ActionExecuted["priority"]) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function CreatorCompilationSummary({
  compiledBlueprint,
}: {
  compiledBlueprint: CompiledBlueprintResult;
}) {
  return (
    <div className={styles.successCard}>
      <div className={styles.successHeader}>
        <div className={styles.successIcon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            width="28"
            height="28"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className={styles.successTitle}>Blueprint compiled</h1>
          <p className={styles.successSubtitle}>
            Your co-pilot session is complete. A production-ready form is live and
            ready to share.
          </p>
        </div>
      </div>

      <div className={styles.summaryItem}>
        <p className={styles.summaryLabel}>Form name</p>
        <p className={styles.summaryValue}>{compiledBlueprint.label}</p>
      </div>

      <div className={styles.restartSection}>
        <a href={compiledBlueprint.formUrl} className={styles.analyticsLink}>
          Open live form
        </a>
        <a
          href={compiledBlueprint.analyticsUrl}
          className={styles.creatorAnalyticsLink}
        >
          Open analytics dashboard
        </a>
      </div>
    </div>
  );
}

function AmendmentComposer(props: {
  userInput: string;
  loading: boolean;
  isListening: boolean;
  isSpeechSupported: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onToggleSpeech: () => void;
}) {
  const {
    userInput,
    loading,
    isListening,
    isSpeechSupported,
    error,
    onInputChange,
    onSubmit,
    onToggleSpeech,
  } = props;

  return (
    <section className={styles.amendmentSection}>
      <p className={styles.amendmentLabel}>
        Notice a mistake? Just type or speak to correct any field.
      </p>
      <div
        className={[
          styles.omniInputShell,
          isListening ? styles.omniInputShellActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <textarea
          value={userInput}
          disabled={loading}
          placeholder={'e.g., "Change the server ID to YBX"'}
          rows={3}
          onChange={(event) => onInputChange(event.target.value)}
          className={styles.amendmentTextArea}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className={styles.omniToolbar}>
          <p className={styles.omniToolbarHint}>
            {isListening
              ? "Listening… tap the microphone again when you are done."
              : "Corrections update your saved answers and automations."}
          </p>
          <div className={styles.amendmentActions}>
            {isSpeechSupported ? (
              <button
                type="button"
                disabled={loading}
                onClick={onToggleSpeech}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                aria-pressed={isListening}
                className={[
                  styles.omniMicButton,
                  isListening ? styles.omniMicButtonActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MicrophoneIcon size={22} />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.amendmentSubmitButton}
              disabled={loading || !userInput.trim() || isListening}
              onClick={onSubmit}
            >
              {loading ? "Updating..." : "Apply correction"}
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className={styles.amendmentError} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CompletionSummary({
  capturedData,
  actionsExecuted,
  blueprintId,
  blueprintContext,
  recentlyAmendedKeys,
  amendmentFlash,
  amending,
  amendmentInput,
  amendmentError,
  isListening,
  isSpeechSupported,
  onAmendmentInputChange,
  onSubmitAmendment,
  onToggleSpeech,
  onStartNewSubmission,
  restarting,
  sessionError,
}: {
  capturedData: CapturedData;
  actionsExecuted: ActionExecuted[];
  blueprintId: string | null;
  blueprintContext: BlueprintContext | null;
  recentlyAmendedKeys: string[];
  amendmentFlash: string | null;
  amending: boolean;
  amendmentInput: string;
  amendmentError: string | null;
  isListening: boolean;
  isSpeechSupported: boolean;
  onAmendmentInputChange: (value: string) => void;
  onSubmitAmendment: () => void;
  onToggleSpeech: () => void;
  onStartNewSubmission: () => void;
  restarting: boolean;
  sessionError?: string | null;
}) {
  const entries = Object.entries(
    stripInternalCapturedKeys(capturedData as Record<string, JsonValue>),
  );

  return (
    <div className={styles.successCardWrapper}>
      {amending ? (
        <div className={styles.amendmentOverlay} aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          Updating...
        </div>
      ) : null}
      <div
        className={[
          styles.successCard,
          amending ? styles.successCardUpdating : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
      {blueprintContext ? (
        <FormIdentity blueprintContext={blueprintContext} creatorCopilot={false} />
      ) : null}
      <div className={styles.successHeader}>
        <div className={styles.successIcon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            width="28"
            height="28"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className={styles.successTitle}>All set</h1>
          <p className={styles.successSubtitle}>
            Your responses are saved. You can still correct anything below.
          </p>
        </div>
      </div>

      {amendmentFlash ? (
        <p className={styles.amendmentFlash}>{amendmentFlash}</p>
      ) : null}

      <div className={styles.summaryList}>
        {entries.length === 0 ? (
          <p className={styles.successSubtitle}>
            No additional fields were required.
          </p>
        ) : (
          entries.map(([fieldKey, value]) => (
            <div
              key={fieldKey}
              className={[
                styles.summaryItem,
                recentlyAmendedKeys.includes(fieldKey)
                  ? styles.summaryItemAmended
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <p className={styles.summaryLabel}>{formatFieldLabel(fieldKey)}</p>
              <p className={styles.summaryValue}>{formatCapturedValue(value)}</p>
            </div>
          ))
        )}
      </div>

      {actionsExecuted.length > 0 ? (
        <section className={styles.automationSection}>
          <h2 className={styles.automationTitle}>
            System Automations Triggered Autonomously
          </h2>
          <div className={styles.automationFeed}>
            {actionsExecuted.map((action, index) => (
              <article
                key={`${action.destination}-${index}`}
                className={styles.automationItem}
              >
                <div className={styles.automationHeader}>
                  <span className={styles.destinationBadge}>
                    {getDestinationLabel(action.destination)}
                  </span>
                  <span
                    className={`${styles.priorityBadge} ${getPriorityBadgeClass(action.priority)}`}
                  >
                    {formatPriority(action.priority)}
                  </span>
                </div>
                <p className={styles.automationReasoning}>{action.reasoning}</p>
                <pre className={styles.payloadBox}>
                  {JSON.stringify(action.payload, null, 2)}
                </pre>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.restartSection}>
        {blueprintId ? (
          <a
            href={`/admin/blueprints/${blueprintId}/analytics`}
            className={styles.analyticsLink}
          >
            Open analytics for this form
          </a>
        ) : null}
        <button
          type="button"
          className={styles.restartButton}
          disabled={restarting}
          onClick={onStartNewSubmission}
        >
          {restarting ? "Creating new session..." : "Start new submission"}
        </button>
        <p className={styles.restartHint}>
          Each intake link is single-use once completed. Start a fresh session to
          fill this form again.
        </p>
      </div>
      {sessionError ? (
        <p className={styles.inlineAlert} role="alert">
          {sessionError}
        </p>
      ) : null}

      <AmendmentComposer
        userInput={amendmentInput}
        loading={amending}
        isListening={isListening}
        isSpeechSupported={isSpeechSupported}
        error={amendmentError}
        onInputChange={onAmendmentInputChange}
        onSubmit={onSubmitAmendment}
        onToggleSpeech={onToggleSpeech}
      />
      </div>
    </div>
  );
}

function EmbeddedCompilationNotice() {
  return (
    <div className={styles.compactSuccess}>
      <div className={styles.compactSuccessIcon} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          width="24"
          height="24"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className={styles.compactSuccessTitle}>Blueprint compiled</p>
        <p className={styles.compactSuccessText}>
          Your form is ready. Open the deployment links in the panel on the left
          to share it or view analytics.
        </p>
      </div>
    </div>
  );
}

export type IntakeSessionFormProps = {
  sessionId?: string;
  embedded?: boolean;
  creatorCopilot?: boolean;
  onCompiledBlueprint?: (result: CompiledBlueprintResult) => void;
};

export function IntakeSessionForm({
  sessionId: sessionIdProp,
  embedded = false,
  creatorCopilot = false,
  onCompiledBlueprint,
}: IntakeSessionFormProps = {}) {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = sessionIdProp ?? params.sessionId;

  const [currentQuestion, setCurrentQuestion] = useState<NextStep | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [capturedData, setCapturedData] = useState<CapturedData>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [extractionFlash, setExtractionFlash] = useState<string | null>(null);
  const [actionsExecuted, setActionsExecuted] = useState<ActionExecuted[]>([]);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [blueprintContext, setBlueprintContext] =
    useState<BlueprintContext | null>(null);
  const [compiledBlueprint, setCompiledBlueprint] =
    useState<CompiledBlueprintResult | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [missingFieldHints, setMissingFieldHints] = useState<MissingFieldHint[]>(
    [],
  );
  const [capturedHintTokens, setCapturedHintTokens] = useState<MissingFieldHint[]>(
    [],
  );
  const [amending, setAmending] = useState(false);
  const [amendmentInput, setAmendmentInput] = useState("");
  const [amendmentError, setAmendmentError] = useState<string | null>(null);
  const [amendmentFlash, setAmendmentFlash] = useState<string | null>(null);
  const [recentlyAmendedKeys, setRecentlyAmendedKeys] = useState<string[]>([]);
  const [boundSessionId, setBoundSessionId] = useState(sessionId);
  const captureAnimationRef = useRef<number | null>(null);
  const amendmentHighlightRef = useRef<number | null>(null);
  const sessionGenerationRef = useRef(0);

  // Soft navigation across `/form/[sessionId]` reuses this component. Reset
  // session-scoped UI during render so completion/amendment state cannot bind
  // to the newly routed session id (see React "adjusting state when a prop changes").
  if (sessionId !== boundSessionId) {
    setBoundSessionId(sessionId);
    sessionGenerationRef.current += 1;
    setCurrentQuestion(null);
    setUserInput("");
    setCapturedData({});
    setIsCompleted(false);
    setError(null);
    setSessionError(sessionId ? null : "Session ID is missing.");
    setExtractionFlash(null);
    setActionsExecuted([]);
    setBlueprintId(null);
    setBlueprintContext(null);
    setCompiledBlueprint(null);
    setRestarting(false);
    setMissingFieldHints([]);
    setCapturedHintTokens([]);
    setAmending(false);
    setAmendmentInput("");
    setAmendmentError(null);
    setAmendmentFlash(null);
    setRecentlyAmendedKeys([]);
    setLoading(Boolean(sessionId));
  }

  useEffect(() => {
    return () => {
      if (captureAnimationRef.current) {
        window.clearTimeout(captureAnimationRef.current);
      }
      if (amendmentHighlightRef.current) {
        window.clearTimeout(amendmentHighlightRef.current);
      }
    };
  }, []);

  const applyResponse = useCallback((response: NexusNextStepResponse) => {
    const isAmendmentResponse =
      response.isCompleted && Object.keys(response.extractedData).length > 0;

    if (response.validationError) {
      if (response.isCompleted) {
        setAmendmentError(response.validationError);
      } else {
        setError(response.validationError);
      }
      return;
    }

    setError(null);
    setAmendmentError(null);

    if (response.isCompleted && response.capturedData) {
      setCapturedData(response.capturedData as CapturedData);
    } else {
      setCapturedData((current) =>
        mergeCapturedData(current, response.extractedData),
      );
    }
    setIsCompleted(response.isCompleted);
    setCurrentQuestion(response.nextStep ?? null);

    if (isAmendmentResponse) {
      setAmendmentInput("");
      setAmendmentFlash("Correction applied.");
      const amendedKeys = Object.keys(response.extractedData);
      setRecentlyAmendedKeys(amendedKeys);
      if (amendmentHighlightRef.current) {
        window.clearTimeout(amendmentHighlightRef.current);
      }
      amendmentHighlightRef.current = window.setTimeout(() => {
        setRecentlyAmendedKeys([]);
        amendmentHighlightRef.current = null;
      }, 2200);
      window.setTimeout(() => setAmendmentFlash(null), 3200);
    } else {
      setUserInput("");
    }

    setActionsExecuted(response.actionsExecuted ?? []);
    setBlueprintId(response.blueprintId ?? null);

    if (response.blueprintContext) {
      setBlueprintContext(response.blueprintContext);
    }

    if (response.compiledBlueprint) {
      setCompiledBlueprint(response.compiledBlueprint);
      onCompiledBlueprint?.(response.compiledBlueprint);
    }

    setMissingFieldHints((previousHints) => {
      const extractedKeys = new Set([
        ...Object.keys(response.extractedData),
        ...(response.skippedFields ?? []),
        ...(response.agentSkippedFields ?? []),
      ]);
      if (!response.validationError && extractedKeys.size > 0) {
        const captured = previousHints.filter((hint) =>
          extractedKeys.has(hint.key),
        );

        if (captured.length > 0) {
          setCapturedHintTokens(captured);
          if (captureAnimationRef.current) {
            window.clearTimeout(captureAnimationRef.current);
          }
          captureAnimationRef.current = window.setTimeout(() => {
            setCapturedHintTokens([]);
            captureAnimationRef.current = null;
          }, 1500);
        }
      }

      return response.missingFieldHints ?? previousHints;
    });

    const skippedCount = response.skippedFields?.length ?? 0;
    const agentSkippedCount = response.agentSkippedFields?.length ?? 0;
    const extractedCount = Object.keys(response.extractedData).length;

    if (agentSkippedCount > 0) {
      setExtractionFlash(
        agentSkippedCount === 1
          ? "1 question was contextually skipped to keep the flow relevant."
          : `${agentSkippedCount} questions were contextually skipped to keep the flow relevant.`,
      );
    } else if (skippedCount > 0) {
      setExtractionFlash(
        skippedCount === 1
          ? "1 field marked as not provided. Moving to the next question…"
          : `${skippedCount} fields marked as not provided. Moving to the next question…`,
      );
    } else if (extractedCount > 1) {
      setExtractionFlash(
        `${extractedCount} fields captured from your response. Moving to the next open field…`,
      );
    } else if (extractedCount === 1) {
      setExtractionFlash("1 field captured from your response.");
    } else {
      setExtractionFlash(null);
    }
  }, [onCompiledBlueprint]);

  async function handleSubmit(
    event?: React.FormEvent,
    overrideInput?: string,
  ) {
    event?.preventDefault();

    if (!sessionId) {
      return;
    }

    if (isCompleted) {
      void handleAmendment(overrideInput);
      return;
    }

    if (loading) {
      return;
    }

    const submittedInput = overrideInput ?? userInput;

    if (!submittedInput.trim()) {
      setError("Please provide an answer before continuing.");
      return;
    }

    if (
      currentQuestion?.componentType === "number" &&
      !isValidNumberInput(submittedInput)
    ) {
      setError("Please enter a valid number.");
      return;
    }

    setError(null);
    setExtractionFlash(null);
    setLoading(true);
    setSessionError(null);

    const requestGeneration = sessionGenerationRef.current;

    try {
      const response = await requestNextStep(sessionId, submittedInput);
      if (
        !shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        return;
      }
      applyResponse(response);
    } catch (submitError) {
      if (
        !shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        return;
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit your answer.",
      );
    } finally {
      if (
        shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        setLoading(false);
      }
    }
  }

  async function handleAmendment(overrideInput?: string) {
    if (!sessionId || amending) {
      return;
    }

    const submittedInput = (overrideInput ?? amendmentInput).trim();
    if (!submittedInput) {
      setAmendmentError("Describe what you'd like to correct.");
      return;
    }

    setAmending(true);
    setAmendmentError(null);
    setAmendmentFlash(null);

    const requestGeneration = sessionGenerationRef.current;

    try {
      const response = await requestNextStep(sessionId, submittedInput);
      if (
        !shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        return;
      }
      applyResponse(response);
    } catch (amendError) {
      if (
        !shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        return;
      }
      setAmendmentError(
        amendError instanceof Error
          ? amendError.message
          : "Failed to apply your correction.",
      );
    } finally {
      if (
        shouldApplyIntakeResponse(
          requestGeneration,
          sessionGenerationRef.current,
        )
      ) {
        setAmending(false);
      }
    }
  }

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const handleAmendmentRef = useRef(handleAmendment);
  handleAmendmentRef.current = handleAmendment;
  const isCompletedRef = useRef(isCompleted);
  isCompletedRef.current = isCompleted;

  const { isListening, isSupported, toggleListening, stopListening } =
    useSpeechInput({
      onInterimTranscript: (text) => {
        if (isCompletedRef.current) {
          setAmendmentInput(text);
          setAmendmentError(null);
        } else {
          setUserInput(text);
          setError(null);
        }
      },
      onFinalTranscript: (text) => {
        if (isCompletedRef.current) {
          setAmendmentInput(text);
          setAmendmentError(null);
          void handleAmendmentRef.current(text);
        } else {
          setUserInput(text);
          setError(null);
          void handleSubmitRef.current(undefined, text);
        }
      },
      onError: (message) => {
        if (isCompletedRef.current) {
          setAmendmentError(message);
        } else {
          setError(message);
        }
      },
    });

  useEffect(() => {
    if (loading || amending) {
      stopListening();
    }
  }, [loading, amending, stopListening]);

  useEffect(() => {
    if (!extractionFlash) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExtractionFlash(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [extractionFlash]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const requestGeneration = sessionGenerationRef.current;
    let cancelled = false;

    async function loadInitialQuestion() {
      try {
        const response = await requestNextStep(sessionId);
        if (
          cancelled ||
          !shouldApplyIntakeResponse(
            requestGeneration,
            sessionGenerationRef.current,
          )
        ) {
          return;
        }
        applyResponse(response);
      } catch (fetchError) {
        if (
          cancelled ||
          !shouldApplyIntakeResponse(
            requestGeneration,
            sessionGenerationRef.current,
          )
        ) {
          return;
        }
        setSessionError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load the intake session.",
        );
      } finally {
        if (
          !cancelled &&
          shouldApplyIntakeResponse(
            requestGeneration,
            sessionGenerationRef.current,
          )
        ) {
          setLoading(false);
        }
      }
    }

    void loadInitialQuestion();

    return () => {
      cancelled = true;
    };
  }, [sessionId, applyResponse]);

  function handleSelectOption(value: string) {
    if (loading) {
      return;
    }

    setUserInput(value);
    setError(null);
    void handleSubmit(undefined, value);
  }

  async function handleStartNewSubmission() {
    if (!sessionId || restarting) {
      return;
    }

    setRestarting(true);
    setSessionError(null);

    try {
      const response = await fetch("/api/nexus/restart-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to create a new session.");
      }

      const payload = (await response.json()) as { sessionId: string };
      router.push(`/form/${payload.sessionId}`);
    } catch (restartError) {
      setSessionError(
        restartError instanceof Error
          ? restartError.message
          : "Failed to create a new session.",
      );
      setRestarting(false);
    }
  }

  if (!sessionId) {
    return (
      <PageShell embedded={embedded}>
        <div className={styles.statusCard} role="alert">
          Invalid session URL.
        </div>
      </PageShell>
    );
  }

  if (loading && !currentQuestion && !isCompleted) {
    return (
      <PageShell embedded={embedded}>
        <div className={styles.loadingCard}>
          <span className={styles.spinner} aria-hidden="true" />
          {creatorCopilot
            ? "Starting your co-pilot session..."
            : "Loading your intake session..."}
        </div>
      </PageShell>
    );
  }

  if (sessionError && !currentQuestion && !isCompleted) {
    return (
      <PageShell embedded={embedded}>
        <div className={`${styles.statusCard} ${styles.statusCardError}`} role="alert">
          {sessionError}
        </div>
      </PageShell>
    );
  }

  if (isCompleted) {
    if (creatorCopilot && embedded && compiledBlueprint) {
      return (
        <PageShell embedded={embedded}>
          <EmbeddedCompilationNotice />
        </PageShell>
      );
    }

    return (
      <PageShell embedded={embedded}>
        {compiledBlueprint ? (
          <CreatorCompilationSummary compiledBlueprint={compiledBlueprint} />
        ) : (
          <CompletionSummary
            capturedData={capturedData}
            actionsExecuted={actionsExecuted}
            blueprintId={blueprintId}
            blueprintContext={blueprintContext}
            recentlyAmendedKeys={recentlyAmendedKeys}
            amendmentFlash={amendmentFlash}
            amending={amending}
            amendmentInput={amendmentInput}
            amendmentError={amendmentError}
            isListening={isListening}
            isSpeechSupported={isSupported}
            onAmendmentInputChange={(value) => {
              setAmendmentInput(value);
              setAmendmentError(null);
            }}
            onSubmitAmendment={() => void handleAmendment()}
            onToggleSpeech={toggleListening}
            onStartNewSubmission={() => void handleStartNewSubmission()}
            restarting={restarting}
            sessionError={sessionError}
          />
        )}
      </PageShell>
    );
  }

  const visibleCapturedData = stripInternalCapturedKeys(
    capturedData as Record<string, JsonValue>,
  );
  const answeredCount = Object.keys(visibleCapturedData).length;
  const isAutoSubmitQuestion =
    currentQuestion?.componentType === "select" ||
    currentQuestion?.componentType === "date";
  const isProcessingResponse = loading && Boolean(currentQuestion);
  const isOmniQuestion =
    Boolean(currentQuestion) && supportsOmniInput(currentQuestion!);
  const omniPlaceholder = buildOmniPlaceholder(missingFieldHints);

  return (
    <PageShell embedded={embedded}>
      <form
        className={[
          styles.card,
          isProcessingResponse ? styles.cardProcessing : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <FormIdentity
          blueprintContext={blueprintContext}
          creatorCopilot={creatorCopilot}
        />
        <div className={styles.questionHeader}>
          {answeredCount > 0 ? (
            <p className={styles.progress}>{answeredCount} answered</p>
          ) : null}
        </div>

        <h2 className={styles.question} aria-live="polite">
          {currentQuestion?.questionPrompt ?? "Preparing your next question..."}
        </h2>

        {currentQuestion ? (
          <div className={styles.inputSection}>
            {isOmniQuestion ? (
              <IntentGuidance
                pendingHints={missingFieldHints}
                capturedHints={capturedHintTokens}
              />
            ) : null}
            <QuestionInput
              question={currentQuestion}
              userInput={userInput}
              loading={loading}
              isListening={isListening}
              isSpeechSupported={isSupported}
              omniPlaceholder={isOmniQuestion ? omniPlaceholder : undefined}
              onInputChange={(value) => {
                setUserInput(value);
                setError(null);
              }}
              onSelectOption={handleSelectOption}
              onToggleSpeech={toggleListening}
            />
            {error ? (
              <div
                key={error}
                className={styles.validationError}
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        {extractionFlash ? (
          <p className={styles.extractionFlash}>{extractionFlash}</p>
        ) : null}

        {isProcessingResponse ? (
          <div className={styles.processingBanner}>
            <span className={styles.spinner} aria-hidden="true" />
            Analyzing your response and extracting all matching fields…
          </div>
        ) : null}

        {isAutoSubmitQuestion ? (
          <p className={styles.hint}>
            {currentQuestion?.componentType === "date"
              ? "Choose a date to continue."
              : "Tap an option to continue."}
          </p>
        ) : (
          <div className={styles.actions}>
            <button
              type="submit"
              disabled={loading || !currentQuestion || isListening}
              className={styles.button}
            >
              {loading ? (
                <>
                  <span
                    className={`${styles.spinner} ${styles.spinnerLight}`}
                    aria-hidden="true"
                  />
                  <span className={styles.buttonLoadingText}>Working...</span>
                </>
              ) : (
                "Next"
              )}
            </button>
          </div>
        )}
      </form>
    </PageShell>
  );
}
