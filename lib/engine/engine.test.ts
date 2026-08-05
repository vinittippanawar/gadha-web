import { describe, expect, it } from "vitest";
import { ACE_SPADES, costOf, parseCard } from "./cards";
import { createGame, legalMoves, phase2Signature, step } from "./engine";
import { chooseBotMove, policyMove } from "./bots";
import { makeRng } from "./rng";
import { GameState } from "./types";

function playFullGame(seed: number, carryGadha: number | null = null, level: "easy" | "medium" = "medium") {
  const gameRng = makeRng(seed);
  let state = createGame({ carryGadha }, gameRng);
  const botRng = makeRng(seed * 7919 + 1);
  while (!state.finished) {
    const p = state.turn as number;
    const { card } = chooseBotMove(state, p, level, botRng);
    state = step(state, card, gameRng).state;
  }
  return state;
}

describe("opening rule: Ace of Spades holder leads, but may play any card", () => {
  it("Ace is guaranteed dealt, and any card in hand is legal first", () => {
    const rng = makeRng(2);
    const state = createGame({}, rng);
    const holder = state.turn as number;
    expect(state.hands[holder]).toContain(ACE_SPADES);
    const legal = legalMoves(state);
    expect(new Set(legal)).toEqual(new Set(state.hands[holder]));
  });

  it("playing a non-Ace as opener is accepted, Ace stays in hand", () => {
    const rng = makeRng(2);
    let state = createGame({}, rng);
    const holder = state.turn as number;
    const nonAce = state.hands[holder].find((c) => c !== ACE_SPADES)!;
    const result = step(state, nonAce, rng);
    expect(result.state.hands[holder]).toContain(ACE_SPADES);
  });
});

describe("phase 1: a caught card can never be replayed", () => {
  it("only the original 5 dealt cards are ever offered as legal", () => {
    const rng = makeRng(9);
    let state = createGame({}, rng);
    const original = state.hands.map((h) => new Set(h)); // deal, before any plays
    const botRng = makeRng(40);
    while (state.phase === 1) {
      const p = state.turn as number;
      const legal = legalMoves(state, p);
      // Everything offered must be from that player's ORIGINAL deal --
      // never a card they only hold because they caught it earlier.
      for (const c of legal) expect(original[p].has(c)).toBe(true);
      const { card } = chooseBotMove(state, p, "medium", botRng);
      state = step(state, card, rng).state;
    }
  });

  it("a card just caught cannot be immediately replayed for a second catch", () => {
    // Construct a case by hand: table has 3 and 4 (sums to 7); player plays a
    // 7, which is not on the table, so it catches [3,4] and joins the hand.
    // That 7 must NOT reappear as legal, even though the player's hand now
    // physically contains it.
    const rng = makeRng(1);
    let state = createGame({}, rng);
    // Force a deterministic small scenario instead of relying on the deal.
    state = {
      ...structuredClone(state),
      hands: state.hands.map((h, i) => (i === 0 ? [7 - 1, 20, 25, 30, 35] : h)), // card 6 = "7S" (rank index 6)
      table: [2, 3], // rank index 2 = "3", rank index 3 = "4" -> values 3 and 4
      turn: 0,
      known: state.known.map(() => []),
    };
    const before = legalMoves(state, 0);
    expect(before).toContain(6); // the 7 of spades is legal before playing it
    const result = step(state, 6, rng);
    expect(result.event.kind).toBe("phase1");
    if (result.event.kind === "phase1") {
      expect(result.event.picked).toBeGreaterThan(0); // it did catch something
    }
    const after = legalMoves(result.state, 0);
    expect(after).not.toContain(6); // caught card is now locked for phase 2
  });
});

describe("all 52 cards accounted for at every point", () => {
  function countCards(state: ReturnType<typeof createGame>): number {
    let total = state.table.length + state.discarded.length;
    state.hands.forEach((h) => (total += h.length));
    state.trick.forEach(() => (total += 1));
    return total;
  }

  it("stays at 52 through phase 1 and into phase 2", () => {
    const rng = makeRng(5);
    let state = createGame({}, rng);
    expect(countCards(state)).toBe(52);
    const botRng = makeRng(11);
    while (state.phase === 1) {
      const p = state.turn as number;
      const { card } = chooseBotMove(state, p, "medium", botRng);
      state = step(state, card, rng).state;
      expect(countCards(state)).toBe(52);
    }
  });
});

describe("cutter leads next trick (confirmed rule)", () => {
  it("after a cut, the leader is the player who cut, not the picker", () => {
    const rng = makeRng(9);
    let state = createGame({}, rng);
    const botRng = makeRng(21);
    while (state.phase === 1) {
      const p = state.turn as number;
      const { card } = chooseBotMove(state, p, "medium", botRng);
      state = step(state, card, rng).state;
    }
    // Play phase 2 until the first cut, then check who leads next.
    let found = false;
    while (!state.finished && !found) {
      const p = state.turn as number;
      const { card } = chooseBotMove(state, p, "medium", botRng);
      const result = step(state, card, rng);
      state = result.state;
      const ev = result.event;
      if (ev.kind === "phase2" && ev.resolved && ev.resolved.pickup) {
        if (ev.resolved.exited.includes(ev.player)) {
          // The cutter emptied their hand on this very play, so they can't
          // lead (no cards left) -- leadership passes to the next alive
          // player instead. Same rule already verified in the Python engine.
          expect(state.alive[state.leader as number]).toBe(true);
        } else {
          expect(state.leader).toBe(ev.player); // the cutter leads
        }
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("cycle detection triggers a full reshuffle", () => {
  it("the exact same post-resolution state, seen twice, reshuffles the second time", () => {
    const QS = parseCard("QS")!, KD = parseCard("KD")!, KH = parseCard("KH")!, QD = parseCard("QD")!;

    function freshScenario(): { state: GameState; rng: ReturnType<typeof makeRng> } {
      const rng = makeRng(1);
      const base = createGame({}, rng);
      const state: GameState = {
        ...structuredClone(base),
        phase: 2,
        hands: base.hands.map((_, i) => (i === 1 ? [QS, KH] : i === 5 ? [KD, QD] : [])),
        alive: [false, true, false, false, false, true],
        leader: 1,
        turn: 1,
        order: [1, 5],
        idx: 0,
        trick: [],
        led: null,
        known: base.known.map(() => []),
        phase2Signatures: [],
        reshuffles: 0,
      };
      return { state, rng };
    }

    // Pass 1: play the sequence with no history -- nothing to detect yet,
    // but record the signature this exact resolution produces.
    let { state, rng } = freshScenario();
    state = step(state, QS, rng).state;
    const afterFirst = step(state, KD, rng);
    expect(afterFirst.event.kind).toBe("phase2");
    if (afterFirst.event.kind === "phase2") {
      expect(afterFirst.event.resolved?.reshuffled ?? false).toBe(false);
    }
    const observedSignature = phase2Signature(afterFirst.state);

    // Pass 2: identical sequence, but the signature is already "seen"
    // before this trick resolves -- must trigger a reshuffle this time.
    ({ state, rng } = freshScenario());
    state.phase2Signatures = [observedSignature];
    state = step(state, QS, rng).state;
    const second = step(state, KD, rng);
    expect(second.event.kind).toBe("phase2");
    if (second.event.kind === "phase2") {
      expect(second.event.resolved?.reshuffled).toBe(true);
    }
    // Both alive players get a full fresh hand from the 52-card deck.
    expect(second.state.hands[1].length).toBe(second.state.handSize);
    expect(second.state.hands[5].length).toBe(second.state.handSize);
    expect(second.state.phase2Signatures.length).toBe(0); // tracking resets
  });
});

describe("series carry-over: previous gadha receives all leftover cards", () => {
  it("first game splits leftovers equally; second game loads the loser", () => {
    const g1 = playFullGame(4, null);
    expect(g1.gadha).not.toBeNull();

    const rng2 = makeRng(5);
    let state2 = createGame({ carryGadha: g1.gadha }, rng2);
    const botRng = makeRng(6);
    while (state2.phase === 1) {
      const p = state2.turn as number;
      const { card } = chooseBotMove(state2, p, "medium", botRng);
      state2 = step(state2, card, rng2).state;
    }
    expect(state2.leftoverTo).toBe(g1.gadha);
  });
});

describe("termination statistics (parity with the measured Python numbers)", () => {
  it("cutter-leads + reshuffle-on-cycle: every game finishes naturally now", () => {
    // Before the reshuffle fix, cutter-leads left ~25% of games hanging in a
    // 2-player cycle (Python: 99/400 timeouts). The reshuffle fix -- detect a
    // repeated (leader, alive-hands) state and redeal fresh hands -- brought
    // that to 0/400 in Python. This confirms the same holds here.
    let naturalEnd = 0;
    let timedOut = 0;
    let gamesWithReshuffle = 0;
    let totalReshuffles = 0;
    const lengths: number[] = [];
    let carry: number | null = null;
    const GAMES = 150;
    for (let seed = 0; seed < GAMES; seed++) {
      const state = playFullGame(seed, carry);
      lengths.push(state.turnsTaken);
      if (state.timedOut) timedOut++;
      else naturalEnd++;
      if (state.reshuffles > 0) {
        gamesWithReshuffle++;
        totalReshuffles += state.reshuffles;
      }
      carry = state.gadha;
    }
    expect(timedOut).toBe(0);
    expect(naturalEnd).toBe(GAMES);
    // The phenomenon this fixes must still actually occur in this port,
    // or the test would be vacuous (never exercising the fix at all).
    expect(gamesWithReshuffle).toBeGreaterThan(0);
    expect(totalReshuffles).toBeGreaterThan(0);
  }, 60000);

  it("picker-leads: every game finishes on its own", () => {
    let timedOut = 0;
    let carry: number | null = null;
    for (let seed = 0; seed < 100; seed++) {
      const gameRng = makeRng(seed);
      let state = createGame({ carryGadha: carry }, gameRng);
      const botRng = makeRng(seed + 1000);
      // picker-leads isn't exposed via playFullGame; build inline.
      state = { ...state, pickerLeads: true };
      while (!state.finished) {
        const p = state.turn as number;
        const { card } = chooseBotMove(state, p, "medium", botRng);
        state = step(state, card, gameRng).state;
      }
      if (state.timedOut) timedOut++;
      carry = state.gadha;
    }
    expect(timedOut).toBe(0);
  });
});

describe("bot sanity", () => {
  it("greedy never picks a costly card when a free one exists (phase 1)", () => {
    const rng = makeRng(3);
    let state = createGame({}, rng);
    for (let i = 0; i < 6; i++) {
      const p = state.turn as number;
      const card = policyMove(state, p);
      const result = step(state, card, rng);
      const ev = result.event;
      if (ev.kind === "phase1") {
        // If a zero-cost move existed, the greedy bot must have taken one.
        const legal = legalMoves(state, p);
        const anyFree = legal.some((c) => costOf(state.table, c) === 0);
        if (anyFree) expect(ev.picked).toBe(0);
      }
      state = result.state;
      if (state.finished) break;
    }
  });
});
