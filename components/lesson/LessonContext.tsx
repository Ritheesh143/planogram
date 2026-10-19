"use client";

import { createContext, useContext } from "react";
import type { LessonKind } from "./sections";

export const LessonContext = createContext<{ slug: string; kind: LessonKind }>({ slug: "", kind: "lesson" });

export function useLessonSlug(): string {
  return useContext(LessonContext).slug;
}

export function useLessonKind(): LessonKind {
  return useContext(LessonContext).kind;
}
