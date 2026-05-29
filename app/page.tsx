import Link from "next/link";
import { AppNav } from "@/components/ui/app-nav";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <AppNav />
      <main className={styles.main}>
        <p className={styles.eyebrow}>Dynamic intake platform</p>
        <h1 className={styles.title}>Fomu Nexus</h1>
        <p className={styles.lead}>
          AI-driven forms that adapt as people respond. Creators use the co-pilot
          to design blueprints; respondents get a conversational intake that
          extracts multiple fields at once.
        </p>

        <div className={styles.cards}>
          <Link href="/admin/blueprints" className={styles.card}>
            <h2 className={styles.cardTitle}>All forms</h2>
            <p className={styles.cardText}>
              Browse every blueprint you have created, open analytics, and copy
              shareable intake links.
            </p>
            <span className={styles.cardAction}>View forms →</span>
          </Link>
          <Link href="/admin/new" className={styles.card}>
            <h2 className={styles.cardTitle}>Create a form</h2>
            <p className={styles.cardText}>
              Launch the Creator Co-Pilot to refine your idea and compile a
              production-ready intake blueprint.
            </p>
            <span className={styles.cardAction}>Open co-pilot →</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
