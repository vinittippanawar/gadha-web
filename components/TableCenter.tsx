"use client";

import { AnimatePresence, motion } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { SUIT_GLYPH, sortHand } from "@/lib/engine/cards";
import { GameState } from "@/lib/engine/types";
import { seatName } from "@/lib/seatName";

interface Props {
  state: GameState;
  mySeat: number;
  names?: string[];
}

export default function TableCenter({ state, mySeat, names }: Props) {
  if (state.phase === 1) {
    const bySuit = [0, 1, 2, 3].map((s) => sortHand(state.table.filter((c) => Math.floor(c / 13) === s)));
    return (
      <div className="flex flex-col gap-1.5 bg-emerald-950/40 rounded-2xl p-4 border border-emerald-400/20 min-w-[22rem]">
        <div className="text-emerald-200 text-xs font-semibold mb-1">TABLE - {state.table.length} cards</div>
        {bySuit.map(
          (row, s) =>
            row.length > 0 && (
              <div key={s} className="flex items-center gap-1">
                <span className="w-4 text-center opacity-70">{SUIT_GLYPH[s]}</span>
                <div className="flex gap-1 flex-wrap">
                  <AnimatePresence mode="popLayout">
                    {row.map((c) => (
                      <PlayingCard key={c} card={c} size="sm" layoutIdPrefix="card" />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )
        )}
        {state.table.length === 0 && <div className="text-emerald-300/50 text-sm py-2">empty</div>}
      </div>
    );
  }

  // Phase 2: current trick in progress
  return (
    <div className="flex flex-col items-center gap-2 bg-emerald-950/40 rounded-2xl p-4 border border-emerald-400/20 min-w-[22rem] min-h-[8rem] justify-center">
      <div className="text-emerald-200 text-xs font-semibold">
        {state.led !== null ? `LED SUIT ${SUIT_GLYPH[state.led]}` : "NEW TRICK"}
      </div>
      <div className="flex gap-3">
        <AnimatePresence mode="popLayout">
          {state.trick.map(([p, c]) => (
            <motion.div key={c} className="flex flex-col items-center gap-1">
              <PlayingCard card={c} size="md" layoutIdPrefix="card" />
              <span className="text-[10px] text-emerald-200/80">{seatName(p, mySeat, names)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {state.discarded.length > 0 && (
        <div className="text-[10px] text-emerald-300/50 mt-1">{state.discarded.length} cards discarded for good</div>
      )}
    </div>
  );
}
