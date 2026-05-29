"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-nav.module.css";

const NAV_LINKS = [
  { href: "/admin/blueprints", label: "Manage forms", matchPrefix: "/admin/blueprints" },
  { href: "/admin/new", label: "Create form", matchPrefix: "/admin/new" },
] as const;

type AppNavProps = {
  variant?: "full" | "minimal";
};

export function AppNav({ variant = "full" }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/" className={styles.brand}>
        Fomu Nexus
      </Link>
      <div className={styles.links}>
        {variant === "full"
          ? NAV_LINKS.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.matchPrefix}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[styles.link, isActive ? styles.linkActive : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })
          : null}
      </div>
    </nav>
  );
}
