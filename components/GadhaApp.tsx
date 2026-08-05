"use client";

import { useState } from "react";
import { Level } from "@/lib/engine/bots";
import { useGadhaGame, YOU } from "@/lib/useGadhaGame";
import GameBoard from "./GameBoard";

const LEVELS: Level[] = ["easy", "medium", "hard", "brutal"];

export default function GadhaApp() {
  const [level, setLevel] = useState<Level>("medium");
  const { state, log, scores, gameNo, botThinking, playCard, newGame, restartSeries } = useGadhaGame(level);

  return (
    <GameBoard
      state={state}
      mySeat={YOU}
      onPlay={playCard}
      gameNo={gameNo}
      scores={scores}
      log={log}
      busy={botThinking}
      onNextGame={() => newGame(state.gadha)}
      onRestartSeries={restartSeries}
      toolbar={
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span>Bot difficulty:</span>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={`px-2 py-1 rounded-full border ${
                level === lv
                  ? "bg-amber-400 text-amber-950 border-amber-500"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
      }
    />
  );
}
