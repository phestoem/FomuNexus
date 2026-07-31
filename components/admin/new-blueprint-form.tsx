"use client";

import { useEffect, useRef, useState } from "react";
import { IntakeSessionForm } from "@/components/nexus/intake-session-form";
import type { CompiledBlueprintResult } from "@/lib/nexus/schemas";
import styles from "./new-blueprint-form.module.css";

type StartCopilotResponse = {
  sessionId: string;
  blueprintId: string;
};

export function NewBlueprintForm() {
  const [title, setTitle] = useState("");
  const [roughIdea, setRoughIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null);
  const [compiledBlueprint, setCompiledBlueprint] =
    useState<CompiledBlueprintResult | null>(null);
  const [copied, setCopied] = useState(false);
  const deploymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (compiledBlueprint && deploymentRef.current) {
      deploymentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [compiledBlueprint]);

  async function handleStartCopilot(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim() || !roughIdea.trim()) {
      setError("Please provide both a working title and your rough idea.");
      return;
    }

    setLoading(true);
    setError(null);
    setCompiledBlueprint(null);
    setCopied(false);

    try {
      const response = await fetch("/api/nexus/start-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          roughIdea: roughIdea.trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          errorBody?.error ?? "Failed to start the creator co-pilot.",
        );
      }

      const payload = (await response.json()) as StartCopilotResponse;
      setCopilotSessionId(payload.sessionId);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start the creator co-pilot.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyUrl() {
    if (!compiledBlueprint?.formUrl) {
      return;
    }

    await navigator.clipboard.writeText(compiledBlueprint.formUrl);
    setCopied(true);
  }

  function handleReset() {
    setCopilotSessionId(null);
    setCompiledBlueprint(null);
    setCopied(false);
    setError(null);
  }

  const copilotActive = Boolean(copilotSessionId);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.setupPanel}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Creator Dashboard</p>
            <h1 className={styles.title}>Blueprint Co-Pilot</h1>
            <p className={styles.subtitle}>
              Share a rough idea and let the agnostic engine interview you. It
              will refine your goals, suggest structure, and compile a live form
              when you are ready.
            </p>
          </header>

          {copilotActive ? (
            <div className={styles.sessionSummary}>
              <div className={styles.sessionSummaryHeader}>
                <p className={styles.sessionSummaryEyebrow}>Session inputs</p>
                <button
                  type="button"
                  className={styles.sessionSummaryReset}
                  onClick={handleReset}
                >
                  Start over
                </button>
              </div>
              <div className={styles.sessionSummaryItem}>
                <p className={styles.sessionSummaryLabel}>Working title</p>
                <p className={styles.sessionSummaryValue}>{title}</p>
              </div>
              <div className={styles.sessionSummaryItem}>
                <p className={styles.sessionSummaryLabel}>Rough idea</p>
                <p className={styles.sessionSummaryValueMultiline}>{roughIdea}</p>
              </div>
            </div>
          ) : (
            <form
              className={styles.card}
              onSubmit={(event) => void handleStartCopilot(event)}
            >
              <div className={styles.field}>
                <label className={styles.label} htmlFor="form-title">
                  Working title
                </label>
                <input
                  id="form-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Post-move workspace satisfaction pulse"
                  className={styles.input}
                  disabled={loading}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="rough-idea">
                  Rough idea
                </label>
                <textarea
                  id="rough-idea"
                  value={roughIdea}
                  onChange={(event) => setRoughIdea(event.target.value)}
                  placeholder="I want to understand how employees feel about the new office layout, collaboration spaces, and commute impact."
                  className={styles.textarea}
                  disabled={loading}
                />
              </div>

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.button}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className={styles.spinner} aria-hidden="true" />
                      Starting...
                    </>
                  ) : (
                    "Start Co-Pilot"
                  )}
                </button>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}
            </form>
          )}

          {compiledBlueprint ? (
            <div ref={deploymentRef} className={styles.deploymentCard}>
              <h2 className={styles.deploymentTitle}>Deployment ready</h2>
              <p className={styles.deploymentText}>
                <strong>{compiledBlueprint.label}</strong> is live with a fresh
                test session.
              </p>
              <div className={styles.urlBox}>
                <a
                  href={compiledBlueprint.formUrl}
                  className={styles.urlLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {compiledBlueprint.formUrl}
                </a>
                <div className={styles.deploymentActions}>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => void handleCopyUrl()}
                  >
                    {copied ? "Copied" : "Copy form link"}
                  </button>
                  <a
                    href={compiledBlueprint.analyticsUrl}
                    className={styles.analyticsButton}
                  >
                    Open analytics
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.copilotPanel}>
          <div className={styles.copilotPanelHeader}>
            <p className={styles.copilotEyebrow}>Live Co-Pilot Session</p>
            <h2 className={styles.copilotTitle}>
              {copilotSessionId
                ? "Refine your blueprint"
                : "Your interactive interview appears here"}
            </h2>
          </div>

          {copilotSessionId ? (
            <div className={styles.copilotFormWrap}>
              <IntakeSessionForm
                key={copilotSessionId}
                sessionId={copilotSessionId}
                embedded
                creatorCopilot
                onCompiledBlueprint={setCompiledBlueprint}
              />
            </div>
          ) : (
            <div className={styles.copilotPlaceholder}>
              <p>
                Start Co-Pilot to launch a temporary meta-session. The engine
                will ask smart follow-ups, apply contextual framing, and compile
                your production blueprint when the interview completes.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
