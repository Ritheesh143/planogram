import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { StoredCard } from "./progress";

const scheduler = fsrs({ enable_fuzz: false });

export { Rating };

export function toStored(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  };
}

export function fromStored(s: StoredCard): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

export function newCard(now: Date = new Date()): StoredCard {
  return toStored(createEmptyCard(now));
}

export function review(s: StoredCard, grade: Grade, now: Date = new Date()): StoredCard {
  return toStored(scheduler.next(fromStored(s), now, grade).card);
}

export function isDue(s: StoredCard, now: Date = new Date()): boolean {
  return new Date(s.due).getTime() <= now.getTime();
}

/** Human-readable time until the next review for each grade, for the answer buttons. */
export function previewIntervals(s: StoredCard, now: Date = new Date()): Record<Grade, string> {
  const preview = scheduler.repeat(fromStored(s), now);
  const fmt = (d: Date) => {
    const mins = Math.round((d.getTime() - now.getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };
  return {
    [Rating.Again]: fmt(preview[Rating.Again].card.due),
    [Rating.Hard]: fmt(preview[Rating.Hard].card.due),
    [Rating.Good]: fmt(preview[Rating.Good].card.due),
    [Rating.Easy]: fmt(preview[Rating.Easy].card.due),
  } as Record<Grade, string>;
}
