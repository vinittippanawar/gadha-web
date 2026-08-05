"use client";

import { AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { Card, cardName, sortHand, suitOf } from "@/lib/engine/cards";
import { GameState } from "@/lib/engine/types";

interface Props {
  state: GameState;
  hand: Card[];
  legal: Card[];
  costMap: Map<Card, number>;
  onPlay: (card: Card) => void;
  isMyTurn: boolean;
}

export default function HandRow({ state, hand, legal, costMap, onPlay, isMyTurn }: Props) {
  const sorted = sortHand(hand);
  const legalSet = new Set(legal);

  return (
    <div className="flex flex-col items-center gap-2">
      {state.phase === 2 && state.led !== null && (
        <div className="text-xs text-zinc-300">
          {legalSet.size && suitOf(sorted.find((c) => legalSet.has(c)) ?? -1) === state.led
            ? "You must follow suit"
            : "You cannot follow - anything you play CUTS"}
        </div>
      )}
      <div className="flex gap-2 flex-wrap justify-center min-h-[6.5rem] items-end">
        <AnimatePresence mode="popLayout">
          {sorted.map((c) => {
            const isLegal = !isMyTurn ? false : legalSet.has(c);
            const cost = costMap.get(c);
            let highlight: "safe" | "danger" | null = null;
            if (state.phase === 1 && cost !== undefined) {
              highlight = cost === 0 ? "safe" : "danger";
            }
            return (
              <div key={c} className="flex flex-col items-center gap-1">
                <PlayingCard
                  card={c}
                  size="lg"
                  layoutIdPrefix="card"
                  disabled={!isLegal}
                  highlight={highlight}
                  onClick={isLegal ? () => onPlay(c) : undefined}
                  title={
                    state.phase === 1 && cost !== undefined
                      ? cost === 0
                        ? `${cardName(c)} - safe`
                        : `${cardName(c)} - costs ${cost} cards`
                      : cardName(c)
                  }
                />
                {state.phase === 1 && cost !== undefined && (
                  <span className={`text-[10px] font-semibold ${cost === 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {cost === 0 ? "safe" : `+${cost}`}
                  </span>
                )}
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
