import { Level } from "../engine/bots";
import { GameState } from "../engine/types";

export interface SeatInfo {
  kind: "human" | "bot" | "empty";
  /** Secret per-seat token. Never sent to any client except the one that
   *  owns this seat -- see redact.ts. Always null for "empty" and "bot". */
  token: string | null;
  name: string;
  botLevel: Level;
  lastSeen: number;
}

export interface Room {
  code: string;
  status: "lobby" | "playing";
  seats: SeatInfo[]; // length is this room's chosen seat count -- see MIN/MAX below
  state: GameState | null;
  gadhaSeries: number[]; // times-been-gadha per seat, across games in this room
  carryGadha: number | null;
  gamesPlayed: number; // 1-based count of games started in this room so far
  createdAt: number;
  /** Bumped on every change. Lets clients cheaply tell "did anything change"
   *  without diffing the whole (possibly large) state. */
  version: number;
}

export const ROOM_TTL_SECONDS = 6 * 60 * 60; // abandoned rooms expire in 6h

// Matches the engine's own supported range (GadhaGame accepts 2-8 players).
export const MIN_SEATS = 2;
export const MAX_SEATS = 8;
export const DEFAULT_SEATS = 6;
