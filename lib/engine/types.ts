import { Card } from "./cards";

/**
 * GameState is plain, JSON-serializable data on purpose: no classes, no Sets,
 * no Maps. That is what lets this same shape later be held on a server and
 * broadcast to multiple clients for multiplayer -- the reducer in engine.ts
 * is a pure function (state, action) -> state, which is exactly the shape a
 * server-authoritative game loop needs. Nothing here is React- or
 * browser-specific.
 */
export interface GameState {
  n: number;
  handSize: number;
  maxTurns: number;
  pickerLeads: boolean;
  carryGadha: number | null;

  hands: Card[][];
  table: Card[];
  discarded: Card[];

  phase: 1 | 2 | 0;
  playsMade: number[];
  turnsTaken: number;
  finished: boolean;
  gadha: number | null;
  timedOut: boolean;
  outOrder: number[];

  /** Cards publicly known to have entered a hand (via pickup), per player.
   *  Cards from the original secret deal are never added here. Drives the
   *  PIMC bot's opponent-hand sampling. */
  known: Card[][];

  opener: number;
  turn: number | null;

  alive: boolean[];
  trick: [number, Card][];
  led: number | null; // suit
  order: number[]; // this trick's play order (alive players from leader)
  idx: number;
  leader: number | null;

  leftoverCount: number;
  leftoverTo: number | null;

  /** Every (leader, alive-hands) configuration seen so far this phase, as
   *  strings. A repeat proves the game would cycle forever under
   *  cutter-leads, since bots play deterministically from state -- that's
   *  the trigger for a full reshuffle. */
  phase2Signatures: string[];
  reshuffles: number;
}

// Discriminated on `kind` (not `phase`) so narrowing works cleanly: the
// timeout variant has no `phase` field at all, which otherwise defeats
// TypeScript's control-flow narrowing on `event.phase === 1`.
export type StepEvent =
  | {
      kind: "phase1";
      player: number;
      card: Card;
      caught: Card[];
      picked: number;
      phaseEnd?: boolean;
    }
  | {
      kind: "phase2";
      player: number;
      card: Card;
      cut: boolean;
      resolved: TrickResult | null;
    }
  | { kind: "timeout" };

export interface TrickResult {
  pickup: boolean;
  taker: number | null;
  winner: number;
  cards: Card[];
  topCard: Card;
  exited: number[];
  /** True if this resolution detected a repeating cycle and reshuffled all
   *  remaining alive players' hands from a fresh 52-card deck. */
  reshuffled?: boolean;
}

export interface GameConfig {
  nplayers?: number;
  seed?: number;
  handSize?: number;
  maxTurns?: number;
  pickerLeads?: boolean;
  carryGadha?: number | null;
}
