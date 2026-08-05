/**
 * Bots, ported from gadha_engine.py's policy_move / PIMCPlayer.
 *
 * Each bot owns its own Rng instance (mirrors the Python CLI, where the game's
 * dealing RNG and each bot's decision RNG are separate streams) rather than
 * sharing the game's RNG -- keeps GameState itself free of any embedded
 * randomness source, which matters for the server-authoritative design this
 * is meant to support later.
 */
import { Card, cardName, costOf, dangerOf, suitOf, trickRank, valueOf } from "./cards";
import { legalMoves, step, topOfTrick } from "./engine";
import { Rng } from "./rng";
import { GameState } from "./types";

export interface BotInfo {
  mode: string;
  samples?: number;
  options?: number;
  scores?: Record<string, number>;
  immediate?: Record<string, number>;
}

export function randomMove(state: GameState, me: number, rng: Rng): Card {
  const options = legalMoves(state, me);
  return options[rng.randrange(options.length)];
}

/** Never pay if avoidable; otherwise shed the most dangerous card to hold. */
export function policyMove(state: GameState, me: number): Card {
  const options = legalMoves(state, me);
  if (options.length === 1) return options[0];

  if (state.phase === 1) {
    const table = state.table;
    let best = options[0];
    let bestCost = costOf(table, best);
    let bestDanger = dangerOf(best);
    for (const c of options.slice(1)) {
      const cost = costOf(table, c);
      const danger = dangerOf(c);
      if (cost < bestCost || (cost === bestCost && -danger < -bestDanger)) {
        best = c;
        bestCost = cost;
        bestDanger = danger;
      }
    }
    return best;
  }

  const maxBy = (cards: Card[]) =>
    cards.reduce((a, b) => (trickRank(b) > trickRank(a) ? b : a));
  const minBy = (cards: Card[]) =>
    cards.reduce((a, b) => (trickRank(b) < trickRank(a) ? b : a));

  if (state.led === null) {
    // Leading a suit you hold only one card of makes that card trivially
    // "highest of the led suit" -- if anyone downstream is void and cuts
    // before a real holder gets to follow with something higher, YOU eat
    // the pickup. Prefer leading from a suit you hold more than one card
    // of, so a genuine higher holder is more likely to exist and take that
    // risk instead. Only lead a singleton suit when forced to.
    const suitCounts = new Map<number, number>();
    options.forEach((c) => suitCounts.set(suitOf(c), (suitCounts.get(suitOf(c)) ?? 0) + 1));
    let best = options[0];
    let bestSingleton = suitCounts.get(suitOf(best)) === 1;
    let bestRank = trickRank(best);
    for (const c of options.slice(1)) {
      const singleton = suitCounts.get(suitOf(c)) === 1;
      const rank = trickRank(c);
      if (
        (!singleton && bestSingleton) ||
        (singleton === bestSingleton && rank < bestRank)
      ) {
        best = c;
        bestSingleton = singleton;
        bestRank = rank;
      }
    }
    return best;
  }
  const following = suitOf(options[0]) === state.led;
  if (!following) return maxBy(options); // cutting is free: dump the worst card

  const top = topOfTrick(state);
  const ceiling = top ? trickRank(top.card) : -1;
  const under = options.filter((c) => trickRank(c) < ceiling);
  if (under.length) return maxBy(under); // duck as high as is safe
  if (state.idx === state.order.length - 1) return maxBy(options); // nobody left to cut
  return minBy(options);
}

function playout(state: GameState, rng: Rng): GameState {
  let s = state;
  while (!s.finished) {
    const p = s.turn;
    if (p === null || p === undefined) break;
    const card = policyMove(s, p);
    s = step(s, card, rng).state;
  }
  return s;
}

function scoreFor(state: GameState, me: number): number {
  if (state.gadha === me) return 0.0;
  let base = 1.0;
  const idx = state.outOrder.indexOf(me);
  if (idx !== -1) base += 0.3 * (1.0 - idx / Math.max(1, state.n - 1));
  return base;
}

function unseenFrom(state: GameState, me: number): Card[] {
  const seen = new Set<Card>();
  state.hands[me].forEach((c) => seen.add(c));
  state.table.forEach((c) => seen.add(c));
  state.discarded.forEach((c) => seen.add(c));
  state.trick.forEach(([, c]) => seen.add(c));
  for (let p = 0; p < state.n; p++) {
    if (p !== me) state.known[p].forEach((c) => seen.add(c));
  }
  const out: Card[] = [];
  for (let c = 0; c < 52; c++) if (!seen.has(c)) out.push(c);
  return out;
}

/** A copy of `state` with opponents' unknown cards dealt plausibly, or null
 *  if the public knowledge is inconsistent with a valid deal (should not
 *  normally happen; guarded defensively as in the Python version). */
function sampleFor(state: GameState, me: number, rng: Rng): GameState | null {
  const unseen = unseenFrom(state, me);
  const needs: number[] = Array(state.n).fill(0);
  let totalNeed = 0;
  for (let p = 0; p < state.n; p++) {
    if (p === me) continue;
    const need = state.hands[p].length - state.known[p].length;
    if (need < 0) return null;
    needs[p] = need;
    totalNeed += need;
  }
  if (totalNeed > unseen.length) return null;

  const pool = [...unseen];
  rng.shuffle(pool);
  const clone = structuredClone(state);
  let cursor = 0;
  for (let p = 0; p < state.n; p++) {
    if (p === me) continue;
    clone.hands[p] = [...state.known[p], ...pool.slice(cursor, cursor + needs[p])];
    cursor += needs[p];
  }
  return clone;
}

/** Perfect-Information Monte Carlo: sample plausible opponent hands, play
 *  each candidate card out to the end many times, and keep the one that
 *  scores best on average. */
export function pimcMove(
  state: GameState,
  me: number,
  samples: number,
  rng: Rng
): { card: Card; info: BotInfo } {
  const options = legalMoves(state, me);
  if (options.length === 1) return { card: options[0], info: { mode: "forced" } };

  const immediate = new Map<Card, number>();
  options.forEach((c) => immediate.set(c, state.phase === 1 ? costOf(state.table, c) : 0));

  const totals = new Map<Card, number>(options.map((c) => [c, 0]));
  const counts = new Map<Card, number>(options.map((c) => [c, 0]));
  let drawn = 0;

  for (let i = 0; i < samples; i++) {
    const sample = sampleFor(state, me, rng);
    if (!sample) continue;
    drawn++;
    for (const card of options) {
      let trial: GameState;
      try {
        trial = step(sample, card, rng).state;
      } catch {
        continue;
      }
      const finalState = playout(trial, rng);
      totals.set(card, totals.get(card)! + scoreFor(finalState, me));
      counts.set(card, counts.get(card)! + 1);
    }
  }

  if (!drawn) return { card: policyMove(state, me), info: { mode: "fallback" } };

  const keyFor = (c: Card): [number, number, number] => {
    const cnt = counts.get(c)!;
    const avg = cnt ? totals.get(c)! / cnt : -1;
    return [avg, -immediate.get(c)!, valueOf(c)];
  };
  let best = options[0];
  let bestKey = keyFor(best);
  for (const c of options.slice(1)) {
    const k = keyFor(c);
    if (
      k[0] > bestKey[0] ||
      (k[0] === bestKey[0] && k[1] > bestKey[1]) ||
      (k[0] === bestKey[0] && k[1] === bestKey[1] && k[2] > bestKey[2])
    ) {
      best = c;
      bestKey = k;
    }
  }

  const scores: Record<string, number> = {};
  options.forEach((c) => {
    if (counts.get(c)) scores[cardName(c)] = Math.round((totals.get(c)! / counts.get(c)!) * 1000) / 1000;
  });
  const immediateOut: Record<string, number> = {};
  options.forEach((c) => (immediateOut[cardName(c)] = immediate.get(c)!));

  return {
    card: best,
    info: { mode: "pimc", samples: drawn, options: options.length, scores, immediate: immediateOut },
  };
}

// Sample counts are calibrated to browser reality: this runs synchronously on
// the main thread (no worker), so a single decision blocking the UI thread
// for multiple seconds would read as a freeze. Measured on this machine:
// samples=40 ~230ms, samples=100 ~580ms per decision -- both land inside the
// existing artificial "thinking" delay already used for bot turns, so
// neither adds perceptible extra lag on top of it.
export const LEVELS = {
  easy: { kind: "random", samples: 0 },
  medium: { kind: "greedy", samples: 0 },
  hard: { kind: "pimc", samples: 40 },
  brutal: { kind: "pimc", samples: 100 },
} as const;

export type Level = keyof typeof LEVELS;

export function chooseBotMove(
  state: GameState,
  me: number,
  level: Level,
  rng: Rng
): { card: Card; info: BotInfo } {
  const cfg = LEVELS[level];
  if (cfg.kind === "random") return { card: randomMove(state, me, rng), info: { mode: "random" } };
  if (cfg.kind === "greedy") return { card: policyMove(state, me), info: { mode: "greedy" } };
  return pimcMove(state, me, cfg.samples, rng);
}
