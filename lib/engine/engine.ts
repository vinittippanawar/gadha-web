/**
 * Gadha rules engine, ported from the verified Python version
 * (gadha_engine.py). `step` is a pure reducer: (state, card, rng) -> new
 * state + event. It never mutates its input, which is what a future
 * multiplayer server needs -- the same reducer can run server-side and just
 * broadcast the resulting state instead of updating local React state.
 */
import {
  ACE_SPADES,
  Card,
  cardName,
  costOf,
  matchingCards,
  sortHand,
  suitOf,
  trickRank,
} from "./cards";
import { Rng } from "./rng";
import { GameConfig, GameState, StepEvent, TrickResult } from "./types";

export function createGame(config: GameConfig, rng: Rng): GameState {
  const n = config.nplayers ?? 6;
  if (n < 2 || n > 8) throw new Error("Gadha needs 2 to 8 players");
  const handSize = config.handSize ?? 5;
  const dealt = n * handSize;
  if (dealt > 52) throw new Error("not enough cards for that many players");

  const deck = Array.from({ length: 52 }, (_, i) => i);
  rng.shuffle(deck);
  // The Ace of Spades leads first, so make sure it was actually dealt.
  const pos = deck.indexOf(ACE_SPADES);
  if (pos >= dealt) {
    const swap = rng.randrange(dealt);
    [deck[pos], deck[swap]] = [deck[swap], deck[pos]];
  }
  const hands: Card[][] = [];
  for (let i = 0; i < n; i++) hands.push(deck.slice(i * handSize, (i + 1) * handSize));
  const table = deck.slice(dealt);

  let opener = hands.findIndex((h) => h.includes(ACE_SPADES));
  if (opener === -1) opener = 0;

  return {
    n,
    handSize,
    maxTurns: config.maxTurns ?? 6000,
    pickerLeads: config.pickerLeads ?? false,
    carryGadha: config.carryGadha ?? null,
    hands,
    table,
    discarded: [],
    phase: 1,
    playsMade: Array(n).fill(0),
    turnsTaken: 0,
    finished: false,
    gadha: null,
    timedOut: false,
    outOrder: [],
    known: Array.from({ length: n }, () => []),
    opener,
    turn: opener,
    alive: Array(n).fill(true),
    trick: [],
    led: null,
    order: [],
    idx: 0,
    leader: null,
    leftoverCount: 0,
    leftoverTo: null,
    phase2Signatures: [],
    reshuffles: 0,
  };
}

export function legalMoves(state: GameState, player?: number): Card[] {
  const p = player ?? state.turn;
  if (state.finished || p === null || p === undefined) return [];
  const hand = state.hands[p];
  if (!hand.length) return [];
  if (state.phase === 1) {
    // Only your original 5 dealt cards are playable -- anything you caught
    // is committed to your hand for phase 2 and can never be replayed here.
    // `known[p]` already tracks exactly the cards publicly added via a
    // catch, so excluding them leaves precisely the not-yet-played
    // originals.
    const knownSet = new Set(state.known[p]);
    return sortHand(hand.filter((c) => !knownSet.has(c)));
  }
  if (state.led === null) return sortHand(hand);
  const follow = hand.filter((c) => suitOf(c) === state.led);
  return sortHand(follow.length ? follow : hand);
}

/** Phase 1 only: exact pickup cost per legal card (table is public knowledge). */
export function costs(state: GameState, player?: number): Map<Card, number> {
  const p = player ?? state.turn;
  const map = new Map<Card, number>();
  if (state.phase !== 1 || p === null || p === undefined) return map;
  for (const c of legalMoves(state, p)) map.set(c, costOf(state.table, c));
  return map;
}

export function topOfTrick(state: GameState): { player: number; card: Card } | null {
  let best: { player: number; card: Card } | null = null;
  for (const [p, c] of state.trick) {
    if (state.led !== null && suitOf(c) === state.led) {
      if (!best || trickRank(c) > trickRank(best.card)) best = { player: p, card: c };
    }
  }
  return best;
}

export function step(
  prev: GameState,
  card: Card,
  rng: Rng
): { state: GameState; event: StepEvent } {
  if (prev.finished) throw new Error("game already finished");
  if (!legalMoves(prev).includes(card)) {
    throw new Error(`${cardName(card)} is not a legal play`);
  }

  const state = structuredClone(prev);
  state.turnsTaken += 1;
  if (state.turnsTaken > state.maxTurns) {
    applyTimeout(state);
    return { state, event: { kind: "timeout" } };
  }
  return state.phase === 1 ? step1(state, card, rng) : step2(state, card, rng);
}

function addKnown(state: GameState, player: number, cards: Card[]): void {
  const set = new Set(state.known[player]);
  cards.forEach((c) => set.add(c));
  state.known[player] = Array.from(set);
}

function removeKnown(state: GameState, player: number, card: Card): void {
  if (state.known[player].includes(card)) {
    state.known[player] = state.known[player].filter((c) => c !== card);
  }
}

function step1(state: GameState, card: Card, rng: Rng): { state: GameState; event: StepEvent } {
  const p = state.turn as number;
  state.hands[p] = state.hands[p].filter((c) => c !== card);
  removeKnown(state, p, card);

  const caught = matchingCards(state.table, card);
  let picked = 0;
  if (caught.length) {
    const taken = new Set(caught);
    state.table = state.table.filter((c) => !taken.has(c));
    const gained = [...caught, card];
    state.hands[p] = [...state.hands[p], ...gained];
    addKnown(state, p, gained);
    picked = caught.length + 1;
  } else {
    state.table = [...state.table, card];
  }
  state.playsMade[p] += 1;

  const event: StepEvent = { kind: "phase1", player: p, card, caught: [...caught], picked };

  if (state.playsMade.every((n) => n >= state.handSize)) {
    beginPhase2(state, rng);
    event.phaseEnd = true;
  } else {
    for (let k = 1; k <= state.n; k++) {
      const cand = (p + k) % state.n;
      if (state.playsMade[cand] < state.handSize) {
        state.turn = cand;
        break;
      }
    }
  }
  return { state, event };
}

function beginPhase2(state: GameState, rng: Rng): void {
  distributeLeftovers(state, rng);
  state.phase = 2;
  state.alive = state.hands.map((h) => h.length > 0);
  for (let p = 0; p < state.n; p++) {
    if (!state.alive[p]) state.outOrder.push(p);
  }

  const holders = [];
  for (let p = 0; p < state.n; p++) if (state.hands[p].includes(ACE_SPADES)) holders.push(p);
  if (holders.length) {
    state.leader = holders[0];
  } else {
    state.leader = null;
    for (let k = 0; k < state.n; k++) {
      const cand = (state.opener + k) % state.n;
      if (state.alive[cand]) {
        state.leader = cand;
        break;
      }
    }
  }

  if (settle(state)) return;
  startTrick(state);
}

/** Hand out whatever is still on the table when phase 1 ends. */
function distributeLeftovers(state: GameState, rng: Rng): void {
  const leftover = [...state.table];
  state.table = [];
  state.leftoverCount = leftover.length;
  state.leftoverTo = null;
  if (!leftover.length) return;

  if (state.carryGadha !== null) {
    const p = state.carryGadha;
    state.hands[p] = [...state.hands[p], ...leftover];
    addKnown(state, p, leftover); // everyone watches this happen: public
    state.leftoverTo = p;
  } else {
    // First game of the series: split equally, some get one extra.
    rng.shuffle(leftover);
    const start = rng.randrange(state.n);
    leftover.forEach((c, i) => {
      const p = (start + i) % state.n;
      state.hands[p] = [...state.hands[p], c];
    });
  }
}

function startTrick(state: GameState): void {
  const order: number[] = [];
  for (let k = 0; k < state.n; k++) {
    const cand = (state.leader as number + k) % state.n;
    if (state.alive[cand]) order.push(cand);
  }
  state.order = order;
  state.idx = 0;
  state.trick = [];
  state.led = null;
  state.turn = order.length ? order[0] : null;
}

function step2(
  state: GameState,
  card: Card,
  rng: Rng
): { state: GameState; event: StepEvent } {
  const p = state.turn as number;
  state.hands[p] = state.hands[p].filter((c) => c !== card);
  removeKnown(state, p, card);
  if (state.led === null) state.led = suitOf(card);
  const cut = suitOf(card) !== state.led;
  state.trick = [...state.trick, [p, card]];
  state.idx += 1;

  let resolved: TrickResult | null = null;
  if (cut || state.idx >= state.order.length) {
    resolved = resolveTrick(state, cut, rng);
  } else {
    state.turn = state.order[state.idx];
  }
  return { state, event: { kind: "phase2", player: p, card, cut, resolved } };
}

export function phase2Signature(state: GameState): string {
  const parts = [`leader:${state.leader}`];
  for (let p = 0; p < state.n; p++) {
    if (state.alive[p]) parts.push(`${p}:${[...state.hands[p]].sort((a, b) => a - b).join(",")}`);
  }
  return parts.join("|");
}

/** Confirmed fix for the cutter-leads cycle: reshuffle the full 52-card deck
 *  and deal 5 fresh cards to every player still alive, ignoring what they
 *  currently hold. Measured in the Python engine: eliminates the turn-cap
 *  fallback entirely (0/400 timeouts, down from 99/400) and cuts mean game
 *  length from ~1,574 turns to ~123. */
function reshuffleRemaining(state: GameState, rng: Rng): void {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  rng.shuffle(deck);
  let cursor = 0;
  for (let p = 0; p < state.n; p++) {
    if (state.alive[p]) {
      state.hands[p] = deck.slice(cursor, cursor + state.handSize);
      cursor += state.handSize;
      state.known[p] = []; // freshly secret again, nothing caught
    }
  }
  state.phase2Signatures = [];
  state.reshuffles += 1;
}

function resolveTrick(state: GameState, pickup: boolean, rng: Rng): TrickResult {
  const top = topOfTrick(state);
  if (!top) throw new Error("resolveTrick called with no led-suit card in trick");
  const cards = state.trick.map(([, c]) => c);

  if (pickup) {
    state.hands[top.player] = [...state.hands[top.player], ...cards];
    addKnown(state, top.player, cards);
  } else {
    state.discarded = [...state.discarded, ...cards];
  }

  const exited: number[] = [];
  for (let p = 0; p < state.n; p++) {
    if (state.alive[p] && state.hands[p].length === 0) {
      state.alive[p] = false;
      state.outOrder.push(p);
      exited.push(p);
    }
  }

  const result: TrickResult = {
    pickup,
    taker: pickup ? top.player : null,
    winner: top.player,
    cards,
    topCard: top.card,
    exited,
    reshuffled: false,
  };

  // Confirmed rule: the CUTTER leads next, not whoever picked up the trick.
  if (pickup && !state.pickerLeads) {
    state.leader = state.trick[state.trick.length - 1][0];
  } else {
    state.leader = top.player;
  }

  if (settle(state)) return result;
  if (!state.alive[state.leader as number]) {
    for (let k = 1; k <= state.n; k++) {
      const cand = (state.leader as number + k) % state.n;
      if (state.alive[cand]) {
        state.leader = cand;
        break;
      }
    }
  }

  // Cutter-leads can put two players in a genuine cycle: the exact same
  // (leader, every alive hand) configuration recurs, which -- since the
  // bots play deterministically from state -- proves it will recur forever
  // without intervention. Confirmed fix: reshuffle and resume with whoever's
  // turn it already was.
  const sig = phase2Signature(state);
  if (state.phase2Signatures.includes(sig)) {
    reshuffleRemaining(state, rng);
    result.reshuffled = true;
  } else {
    state.phase2Signatures = [...state.phase2Signatures, sig];
  }

  startTrick(state);
  return result;
}

function settle(state: GameState): boolean {
  const remaining: number[] = [];
  for (let p = 0; p < state.n; p++) if (state.alive[p]) remaining.push(p);
  if (remaining.length <= 1) {
    state.finished = true;
    state.phase = 0;
    state.gadha = remaining.length ? remaining[0] : null;
    state.turn = null;
    return true;
  }
  return false;
}

function applyTimeout(state: GameState): void {
  state.finished = true;
  state.timedOut = true;
  state.phase = 0;
  let best: number | null = null;
  for (let p = 0; p < state.n; p++) {
    if (state.alive[p] && (best === null || state.hands[p].length > state.hands[best].length)) {
      best = p;
    }
  }
  state.gadha = best;
}
