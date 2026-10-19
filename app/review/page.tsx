import type { Metadata } from "next";
import { ReviewQueue } from "@/components/review/ReviewQueue";

export const metadata: Metadata = {
  title: "Review",
  description: "Spaced-repetition review of every lesson's flashcards.",
};

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium tracking-widest text-muted">RETURNS DESK</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Review</h1>
      <p className="mt-2 text-ink-2">
        Ideas come back here just before you&apos;d forget them. Ten minutes a day keeps every
        Keystone sharp. The schedule uses FSRS, the same algorithm modern flashcard apps use.
      </p>
      <div className="mt-6">
        <ReviewQueue />
      </div>
    </div>
  );
}
