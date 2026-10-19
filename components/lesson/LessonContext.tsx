"use client";

import { createContext, useContext } from "react";

export const LessonContext = createContext<{ slug: string }>({ slug: "" });

export function useLessonSlug(): string {
  return useContext(LessonContext).slug;
}
