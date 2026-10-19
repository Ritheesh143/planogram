import { describe, expect, it } from "vitest";
import { isDue, newCard, Rating, review } from "@/lib/srs";

describe("spaced repetition", () => {
  it("new cards are due immediately", () => {
    const now = new Date("2026-10-19T09:00:00Z");
    expect(isDue(newCard(now), now)).toBe(true);
  });

  it("a good answer pushes the card into the future, a lapse brings it back sooner", () => {
    const now = new Date("2026-10-19T09:00:00Z");
    let card = newCard(now);
    card = review(card, Rating.Good, now);
    card = review(card, Rating.Good, new Date(card.due));
    const goodDue = new Date(card.due).getTime();
    expect(goodDue).toBeGreaterThan(now.getTime() + 24 * 3600 * 1000);
    const again = review(card, Rating.Again, new Date(card.due));
    expect(new Date(again.due).getTime() - new Date(card.due).getTime()).toBeLessThan(goodDue - now.getTime());
    expect(again.lapses).toBe(1);
  });

  it("survives a JSON round trip", () => {
    const card = review(newCard(new Date("2026-10-19T09:00:00Z")), Rating.Easy, new Date("2026-10-19T09:00:00Z"));
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });
});
