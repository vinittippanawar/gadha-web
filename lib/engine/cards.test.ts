import { describe, expect, it } from "vitest";
import {
  additionValue,
  cardName,
  costOf,
  dangerOf,
  matchingCards,
  parseCard,
  trickRank,
} from "./cards";

const T = (...names: string[]) => names.map((n) => parseCard(n)!);
const N = (cards: number[]) => cards.map(cardName);

// Every case below reproduces a scenario already verified against the
// Python engine (gadha_engine.py) during development, so this file is a
// parity check, not just a fresh spec.
describe("card values", () => {
  it("A=1, 10=10, face cards take no part in addition", () => {
    expect(additionValue(parseCard("AS")!)).toBe(1);
    expect(additionValue(parseCard("TS")!)).toBe(10);
    expect(additionValue(parseCard("KH")!)).toBeNull();
    expect(additionValue(parseCard("QD")!)).toBeNull();
    expect(additionValue(parseCard("JC")!)).toBeNull();
  });

  it("trick rank: 2..10 low to high, then J,Q,K,A", () => {
    expect(trickRank(parseCard("AS")!)).toBeGreaterThan(trickRank(parseCard("KS")!));
    expect(trickRank(parseCard("KS")!)).toBeGreaterThan(trickRank(parseCard("TS")!));
    expect(trickRank(parseCard("3S")!)).toBeGreaterThan(trickRank(parseCard("2S")!));
  });
});

describe("matching (same-number + sum, verified against Python)", () => {
  it("table A,2 -> play 3: catches A,2, cost 3", () => {
    const table = T("AS", "2H");
    const caught = matchingCards(table, parseCard("3D")!);
    expect(N(caught).sort()).toEqual(["2H", "AS"]);
    expect(costOf(table, parseCard("3D")!)).toBe(3);
  });

  it("table K,K -> play K: catches both kings, cost 3", () => {
    const table = T("KS", "KH");
    const caught = matchingCards(table, parseCard("KD")!);
    expect(N(caught).sort()).toEqual(["KH", "KS"]);
    expect(costOf(table, parseCard("KD")!)).toBe(3);
  });

  it("table 5,6,3,K,J -> play 10: no match, stays on table", () => {
    const table = T("5S", "6H", "3D", "KC", "JS");
    expect(matchingCards(table, parseCard("TD")!)).toEqual([]);
    expect(costOf(table, parseCard("TD")!)).toBe(0);
  });

  it("a numbered card catches its own rank AND a sum, together", () => {
    const table = T("7S", "3D", "4H");
    const caught = matchingCards(table, parseCard("7C")!);
    expect(N(caught).sort()).toEqual(["3D", "4H", "7S"]);
    expect(costOf(table, parseCard("7C")!)).toBe(4);
  });

  it("Ace catches other aces but is safe from sums", () => {
    expect(N(matchingCards(T("AS", "AD", "5H"), parseCard("AC")!)).sort()).toEqual(["AD", "AS"]);
    expect(costOf(T("5S", "6H"), parseCard("AC")!)).toBe(0);
  });

  it("King catches only kings, ignores non-king pairs", () => {
    expect(N(matchingCards(T("KS", "5H", "6D"), parseCard("KC")!))).toEqual(["KS"]);
  });

  it("ten is the most exposed card: 5 pairs sum to it", () => {
    expect(dangerOf(parseCard("TS")!)).toBe(5);
    expect(dangerOf(parseCard("AS")!)).toBe(0);
    expect(dangerOf(parseCard("KS")!)).toBe(0);
  });
});
