import type { Metadata } from "next";
import { FloorCheck } from "@/components/check/FloorCheck";

export const metadata: Metadata = {
  title: "Floor Check",
  description: "A diagnostic quiz that finds exactly which foundations to fix first.",
};

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">CUSTOMER SERVICE</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Floor Check</h1>
      <p className="mt-2 text-ink-2">
        Ten questions on the four Keystones, with no calculator and no looking things up. Every
        wrong answer points to a specific misconception and the lesson that fixes it. Retake it
        every two weeks and watch your floor rise.
      </p>
      <div className="mt-6">
        <FloorCheck />
      </div>
    </div>
  );
}
