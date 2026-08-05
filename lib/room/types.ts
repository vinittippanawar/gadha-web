import { Level } from "../engine/bots";
import { GameState } from "../engine/types";

export interface SeatInfo {
  kind: "human" | "bot";
  /** Secret per-seat token. Never sent to any client except the one that
   *  owns this seat -- see redact.ts. */
  token: string | null;
  name: string;
  botLevel: Level;
  lastSeen: number;
}

export interface Room {
  code: string;
  status: "lobby" | "playing";
  seats: SeatInfo[];
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
export const SEAT_COUNT = 6;
