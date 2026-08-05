/**
 * Card primitives, ported 1:1 from the verified Python engine (gadha_engine.py).
 *
 * A card is an int 0..51: suit = floor(card / 13), rank = card % 13.
 * RANK_CHARS index: 0=A, 1=2, ... 8=9, 9=10, 10=J, 11=Q, 12=K.
 */

export type Card = number;

export const SUIT_CHARS = ["S", "H", "D", "C"] as const;
export const SUIT_GLYPH = ["♠", "♥", "♦", "♣"] as const;
export const RANK_CHARS = "A23456789TJQK";
export const HAND_SIZE = 5;
export const ACE_SPADES: Card = 0;

export function suitOf(card: Card): number {
  return Math.floor(card / 13);
}

export function rankOf(card: Card): number {
  return card % 13;
}

export function isFace(card: Card): boolean {
  return rankOf(card) >= 10; // J, Q, K
}

/** Phase 1 arithmetic value, or null for J/Q/K which take no part in addition. */
export function additionValue(card: Card): number | null {
  const r = rankOf(card);
  return r >= 10 ? null : r + 1;
}

export function valueOf(card: Card): number {
  const v = additionValue(card);
  return v === null ? 0 : v;
}

// How many distinct pairs of 1..10 add to each value. Nothing adds to 1, so an
// Ace is always free to play; a ten is the most exposed card (5 pairs).
const PAIR_SUMS: Record<number, number> = {};
for (let a = 1; a <= 10; a++) {
  for (let b = a; b <= 10; b++) {
    PAIR_SUMS[a + b] = (PAIR_SUMS[a + b] ?? 0) + 1;
  }
}

export function dangerOf(card: Card): number {
  const v = additionValue(card);
  return v === null ? 0 : (PAIR_SUMS[v] ?? 0);
}

/** Phase 2 trick strength: 2 lowest .. 10, then J, Q, K, A highest. */
export function trickRank(card: Card): number {
  const r = rankOf(card);
  return r === 0 ? 13 : r;
}

export function cardName(card: Card): string {
  return RANK_CHARS[rankOf(card)] + SUIT_CHARS[suitOf(card)];
}

export function show(cards: Card[]): string {
  return cards.length ? cards.map(cardName).join(" ") : "-";
}

export function parseCard(text: string): Card | null {
  let t = text.trim().toUpperCase();
  if (t.startsWith("10")) t = "T" + t.slice(2);
  if (t.length !== 2) return null;
  const r = t[0];
  const s = t[1];
  const rankIdx = RANK_CHARS.indexOf(r);
  const suitIdx = (SUIT_CHARS as readonly string[]).indexOf(s);
  if (rankIdx === -1 || suitIdx === -1) return null;
  return suitIdx * 13 + rankIdx;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const sa = suitOf(a), sb = suitOf(b);
    if (sa !== sb) return sa - sb;
    return trickRank(a) - trickRank(b);
  });
}

/**
 * Table cards caught by playing `played`: the union of
 *   1. every card on the table of the same rank, and
 *   2. every pair of (other) table cards whose addition value sums to
 *      `played`'s addition value (J/Q/K never trigger or join a sum).
 */
export function matchingCards(table: Card[], played: Card): Card[] {
  const caught: Card[] = [];
  const seen = new Set<number>();

  const r = rankOf(played);
  table.forEach((c, i) => {
    if (rankOf(c) === r && !seen.has(i)) {
      seen.add(i);
      caught.push(c);
    }
  });

  const target = additionValue(played);
  if (target !== null) {
    for (let a = 0; a < table.length; a++) {
      const va = additionValue(table[a]);
      if (va === null) continue;
      for (let b = a + 1; b < table.length; b++) {
        const vb = additionValue(table[b]);
        if (vb === null) continue;
        if (va + vb === target) {
          if (!seen.has(a)) { seen.add(a); caught.push(table[a]); }
          if (!seen.has(b)) { seen.add(b); caught.push(table[b]); }
        }
      }
    }
  }
  return caught;
}

/** Cards you end up holding if you play `played`. 0 means safe. */
export function costOf(table: Card[], played: Card): number {
  const caught = matchingCards(table, played);
  return caught.length ? caught.length + 1 : 0;
}
