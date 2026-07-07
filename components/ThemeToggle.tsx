"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(t);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("fikirsepeti:theme", next);
    } catch {
      /* yoksay */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-80"
      style={{ border: "1px solid var(--line-strong)", color: "var(--text-2)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ready ? theme : "init"}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 0.85, 0.25, 1] }}
          className="grid place-items-center"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Sun() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </svg>
  );
}

function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 14.3A8 8 0 0 1 9.7 4a0.7 0.7 0 0 0-0.9-0.9 9 9 0 1 0 12.1 12.1 0.7 0.7 0 0 0-0.9-0.9z" />
    </svg>
  );
}
