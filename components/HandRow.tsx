"use client";

import { AnimatePresence } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { Card, cardName, sortHand, suitOf } from "@/lib/engine/cards";
import { GameState } from "@/lib/engine/types";

interface Props {
  state: GameState;
  hand: Card[];
  legal: Card[];
  onPlay: (card: Card) => void;
  isMyTurn: boolean;
}

export default function HandRow({ state, hand, legal, onPlay, isMyTurn }: Props) {
  const sorted = sortHand(hand);
  const legalSet = new Set(legal);
  // Split by the RULES, not by whose turn it is -- a card that's locked (a
  // phase-1 card you already caught, or one that can't follow suit) stays in
  // the locked row even while waiting for your turn; a legal card stays in
  // the playable row even though it isn't clickable until it's your turn.
  const playable = sorted.filter((c) => legalSet.has(c));
  const locked = sorted.filter((c) => !legalSet.has(c));

  return (
    <div className="flex flex-col items-center gap-3">
      {state.phase === 2 && state.led !== null && (
        <div className="text-xs text-zinc-300">
          {legalSet.size && suitOf(sorted.find((c) => legalSet.has(c)) ?? -1) === state.led
            ? "You must follow suit"
            : "You cannot follow - anything you play CUTS"}
        </div>
      )}

      <div className="flex gap-2 flex-wrap justify-center min-h-[6.5rem] items-end">
        <AnimatePresence mode="popLayout">
          {playable.map((c) => (
            <PlayingCard
              key={c}
              card={c}
              size="lg"
              layoutIdPrefix="card"
              disabled={!isMyTurn}
              onClick={isMyTurn ? () => onPlay(c) : undefined}
              title={cardName(c)}
            />
          ))}
        </AnimatePresence>
      </div>

      {locked.length > 0 && (
        <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/10 w-full">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            {state.phase === 1 ? "already caught - locked until phase 2" : "can't follow suit - locked this trick"}
          </span>
          <div className="flex gap-1.5 flex-wrap justify-center opacity-40 grayscale">
            <AnimatePresence mode="popLayout">
              {locked.map((c) => (
                <PlayingCard key={c} card={c} size="sm" layoutIdPrefix="card" disabled title={cardName(c)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
