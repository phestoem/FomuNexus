"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  formatCapturedValue,
  formatFieldLabel,
  formatSubmissionDate,
} from "@/lib/nexus/display-utils";
import { stripInternalCapturedKeys } from "@/lib/nexus/meta-blueprint-shared";
import type { JsonValue } from "@/lib/nexus/target-schema";
import styles from "./blueprint-analytics.module.css";

type SubmissionRecord = {
  sessionId: string;
  completedAt: string;
  capturedData: Record<string, unknown>;
};

type AnalyticsDataResponse = {
  blueprint: {
    id: string;
    label: string;
  };
  submissions: SubmissionRecord[];
  submissionCount: number;
  resolvedFromSessionId?: boolean;
  inputId?: string;
};

type AnalyticsAnalysisResponse = {
  analysis: string;
  blueprint: {
    id: string;
    label: string;
  };
  submissionCount: number;
};

const SAMPLE_QUERIES = [
  "What are the main themes across all responses?",
  "Summarize overall sentiment and highlight outliers.",
  "Which questions had the weakest or most varied answers?",
] as const;

function SubmissionSummary({
  data,
  index,
  completedAt,
}: {
  data: Record<string, unknown>;
  index: number;
  completedAt: string;
}) {
  const entries = Object.entries(
    stripInternalCapturedKeys(data as Record<string, JsonValue>),
  );

  return (
    <article className={styles.submissionItem}>
      <div className={styles.submissionHeader}>
        <span className={styles.submissionTitle}>Submission {index + 1}</span>
        <time dateTime={completedAt} className={styles.submissionDate}>
          {formatSubmissionDate(completedAt)}
        </time>
      </div>

      {entries.length === 0 ? (
        <p className={styles.submissionEmpty}>No captured fields in this record.</p>
      ) : (
        <dl className={styles.submissionFields}>
          {entries.map(([fieldKey, value]) => (
            <div key={fieldKey} className={styles.submissionField}>
              <dt className={styles.submissionFieldLabel}>
                {formatFieldLabel(fieldKey)}
              </dt>
              <dd className={styles.submissionFieldValue}>
                {formatCapturedValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

export function BlueprintAnalyticsDashboard() {
  const params = useParams<{ blueprintId: string }>();
  const router = useRouter();
  const blueprintId = params.blueprintId;

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [blueprintLabel, setBlueprintLabel] = useState("Form Blueprint");
  const [resolvedBlueprintId, setResolvedBlueprintId] = useState<string | null>(
    null,
  );
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [showRawPayloads, setShowRawPayloads] = useState(false);

  useEffect(() => {
    if (!blueprintId) {
      setInitialLoading(false);
      setError("Blueprint ID is missing.");
      return;
    }

    let cancelled = false;

    async function loadAnalyticsData() {
      setInitialLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/nexus/analytics?blueprintId=${encodeURIComponent(blueprintId)}`,
        );

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(errorBody?.error ?? "Failed to load analytics data.");
        }

        const payload = (await response.json()) as AnalyticsDataResponse;

        if (!cancelled) {
          setBlueprintLabel(payload.blueprint.label);
          setResolvedBlueprintId(payload.blueprint.id);
          setSubmissions(payload.submissions);

          if (payload.resolvedFromSessionId) {
            setNotice(
              "That URL used a form session ID. We resolved the parent blueprint automatically.",
            );
            router.replace(
              `/admin/blueprints/${payload.blueprint.id}/analytics`,
            );
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load analytics data.",
          );
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    void loadAnalyticsData();

    return () => {
      cancelled = true;
    };
  }, [blueprintId, router]);

  async function handleAnalyze(event: React.FormEvent) {
    event.preventDefault();

    if (!blueprintId || !query.trim()) {
      setError("Enter a question before analyzing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/nexus/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blueprintId: resolvedBlueprintId ?? blueprintId,
          query: query.trim(),
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorBody?.error ?? "Failed to analyze form responses.");
      }

      const payload = (await response.json()) as AnalyticsAnalysisResponse;
      setAnalysis(payload.analysis);
      setBlueprintLabel(payload.blueprint.label);
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Failed to analyze form responses.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSampleQuery(sample: string) {
    setQuery(sample);
    setError(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/admin/blueprints" className={styles.backLink}>
            ← Back to all forms
          </Link>
          <p className={styles.eyebrow}>Agnostic AI Analyst</p>
          <h1 className={styles.title}>{blueprintLabel}</h1>
          <p className={styles.subtitle}>
            Ask natural language questions across every completed response for this
            blueprint, regardless of schema shape.
          </p>
          <p className={styles.meta}>
            {initialLoading
              ? "Loading submissions..."
              : `${submissions.length} completed submission${submissions.length === 1 ? "" : "s"} available`}
          </p>
        </header>

        <section className={styles.card}>
          <form
            className={styles.queryForm}
            onSubmit={(event) => void handleAnalyze(event)}
          >
            <label className={styles.srOnly} htmlFor="analytics-query">
              Analysis question
            </label>
            <input
              id="analytics-query"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask anything about this form's data..."
              className={styles.queryInput}
              disabled={loading || initialLoading}
            />

            <div className={styles.sampleQueries}>
              {SAMPLE_QUERIES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className={styles.sampleQueryButton}
                  disabled={loading || initialLoading}
                  onClick={() => handleSampleQuery(sample)}
                >
                  {sample}
                </button>
              ))}
            </div>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.button}
                disabled={loading || initialLoading || !query.trim()}
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </form>

          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.notice}>{notice}</p> : null}

          {loading ? (
            <div className={styles.loadingCard}>
              <span className={styles.spinner} aria-hidden="true" />
              Aggregating responses and generating insights...
            </div>
          ) : null}

          {analysis ? (
            <div className={styles.analysisSection}>
              <h2 className={styles.sectionTitle}>Insights report</h2>
              <div className={styles.markdown}>
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.submissionsSection}>
          <div className={styles.submissionsSectionHeader}>
            <h2 className={styles.sectionTitle}>Submissions</h2>
            {submissions.length > 0 ? (
              <button
                type="button"
                className={styles.toggleRawButton}
                onClick={() => setShowRawPayloads((current) => !current)}
              >
                {showRawPayloads ? "Hide raw JSON" : "Show raw JSON"}
              </button>
            ) : null}
          </div>

          {initialLoading ? (
            <div className={styles.emptyState}>Loading submission records...</div>
          ) : submissions.length === 0 ? (
            <div className={styles.emptyState}>
              No completed submissions yet. Share your form link and complete a
              session to populate this feed.
            </div>
          ) : showRawPayloads ? (
            <div className={styles.submissionsList}>
              {submissions.map((submission, index) => (
                <article key={submission.sessionId} className={styles.submissionItem}>
                  <div className={styles.submissionHeader}>
                    <span className={styles.submissionTitle}>
                      Submission {index + 1}
                    </span>
                    <time
                      dateTime={submission.completedAt}
                      className={styles.submissionDate}
                    >
                      {formatSubmissionDate(submission.completedAt)}
                    </time>
                  </div>
                  <pre className={styles.payloadBox}>
                    {JSON.stringify(
                      stripInternalCapturedKeys(
                        submission.capturedData as Record<string, JsonValue>,
                      ),
                      null,
                      2,
                    )}
                  </pre>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.submissionsList}>
              {submissions.map((submission, index) => (
                <SubmissionSummary
                  key={submission.sessionId}
                  index={index}
                  completedAt={submission.completedAt}
                  data={submission.capturedData}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
