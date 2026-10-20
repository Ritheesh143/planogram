"use client";

import { useEffect, useRef, useState } from "react";
import { buildAskPrompt, CLAUDE_NEW_URL } from "@/lib/askClaude";
import { sectionsFor, type LessonKind } from "./sections";

/** Section headers fire this so their "Ask Claude" link can preselect the section. */
export const ASK_EVENT = "planogram:ask-claude";

type Props = {
  kind: LessonKind;
  title: string;
  summary: string;
  keyIdeas: { front: string; back: string }[];
};

type Status = "idle" | "copied" | "failed";

export function AskClaude({ kind, title, summary, keyIdeas }: Props) {
  const sections = sectionsFor(kind);
  const [section, setSection] = useState<string>(sections[0].id);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [prompt, setPrompt] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(false);

  // Follow the section the learner is reading until they pick one themselves.
  useEffect(() => {
    const onScroll = () => {
      if (pinned.current) return;
      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = s.id;
      }
      setSection(current);
    };
    const onAsk = (e: Event) => {
      pinned.current = true;
      setSection((e as CustomEvent<string>).detail);
      panel.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      box.current?.focus({ preventScroll: true });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(ASK_EVENT, onAsk);
    };
  }, [sections]);

  const ask = () => {
    const text = buildAskPrompt({
      title,
      summary,
      keyIdeas,
      section: sections.find((s) => s.id === section)?.title,
      question,
      url: window.location.origin + window.location.pathname,
    });
    setPrompt(text);
    // Start the copy before opening the tab, while this page still has focus.
    const copy = navigator.clipboard?.writeText(text) ?? Promise.reject(new Error("no clipboard"));
    window.open(CLAUDE_NEW_URL, "_blank", "noopener");
    copy.then(
      () => setStatus("copied"),
      () => setStatus("failed"),
    );
  };

  return (
    <div
      ref={panel}
      id="ask-claude"
      className="no-print mt-4 rounded-xl border border-line bg-surface-1 p-4"
    >
      <div className="text-sm font-medium">Ask Claude about this {kind === "model" ? "model" : "lesson"}</div>
      <p className="mt-1 text-xs text-muted">
        Builds a prompt with this page&apos;s key ideas and your question, copies it, and opens claude.ai. Paste it there.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="ask-section" className="text-xs text-ink-2">
          Section
        </label>
        <select
          id="ask-section"
          value={section}
          onChange={(e) => {
            pinned.current = true;
            setSection(e.target.value);
          }}
          className="rounded-lg border border-line bg-page px-2 py-1.5 text-sm"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor="ask-question" className="sr-only">
        Your question
      </label>
      <textarea
        id="ask-question"
        ref={box}
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What's confusing you? e.g. Why does the answer change when the base rate changes?"
        className="mt-3 w-full rounded-lg border border-line bg-page p-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Copy prompt and open Claude
        </button>
        <span role="status" className="text-xs text-ink-2">
          {status === "copied" && "Copied. Paste it into the new Claude chat."}
          {status === "failed" && "Couldn't copy automatically. Select the prompt below and copy it."}
        </span>
      </div>
      {status === "failed" && (
        <textarea
          readOnly
          aria-label="Prompt to copy"
          value={prompt}
          rows={8}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-lg border border-line bg-page p-2 font-mono text-xs"
        />
      )}
    </div>
  );
}
