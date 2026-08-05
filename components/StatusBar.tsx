"use client";

import { GameState } from "@/lib/engine/types";
import { seatName } from "@/lib/seatName";

interface Props {
  state: GameState;
  mySeat: number;
  names?: string[];
  gameNo: number;
  scores: number[];
  botThinking: boolean;
  roomCode?: string;
}

export default function StatusBar({ state, mySeat, names, gameNo, scores, botThinking, roomCode }: Props) {
  const turnLabel =
    state.turn === null
      ? "-"
      : state.turn === mySeat
        ? "Your turn"
        : `${seatName(state.turn, mySeat, names)}${botThinking ? " thinking..." : ""}`;

  return (
    <div className="w-full max-w-4xl flex items-center justify-between px-4 py-2 text-sm text-zinc-200">
      <div className="flex items-center gap-3">
        <span className="font-bold text-amber-300">🫏 GADHA</span>
        {roomCode && (
          <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-xs font-mono font-semibold">
            room {roomCode}
          </span>
        )}
        <span className="opacity-70">game {gameNo}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
          {state.phase === 1 ? "PHASE 1 - addition" : state.phase === 2 ? "PHASE 2 - tricks" : "finished"}
        </span>
      </div>
      <div className="font-medium">{turnLabel}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="opacity-70">gadha count:</span>
        {scores.map((s, i) => (
          <span key={i} className={`px-1.5 py-0.5 rounded ${i === mySeat ? "bg-sky-500/30" : "bg-white/10"}`}>
            {seatName(i, mySeat, names)}:{s}
          </span>
        ))}
      </div>
    </div>
  );
}
