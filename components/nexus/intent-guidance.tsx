"use client";

import styles from "./intake-form.module.css";
import type { MissingFieldHint } from "@/lib/nexus/schemas";

type IntentGuidanceProps = {
  pendingHints: MissingFieldHint[];
  capturedHints: MissingFieldHint[];
};

function EmptyCircleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.5 8.1 7.1 9.7 10.7 6.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IntentGuidance({
  pendingHints,
  capturedHints,
}: IntentGuidanceProps) {
  if (pendingHints.length === 0 && capturedHints.length === 0) {
    return null;
  }

  return (
    <div className={styles.intentGuidance} aria-label="Fields you can still provide">
      <p className={styles.intentGuidanceLabel}>You can include</p>
      <ul className={styles.intentTokenRow}>
        {pendingHints.map((hint) => (
          <li key={hint.key} className={styles.intentToken}>
            <EmptyCircleIcon />
            <span>{hint.label}</span>
          </li>
        ))}
        {capturedHints.map((hint) => (
          <li
            key={`captured-${hint.key}`}
            className={`${styles.intentToken} ${styles.intentTokenCaptured}`}
          >
            <CheckCircleIcon />
            <span>{hint.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
