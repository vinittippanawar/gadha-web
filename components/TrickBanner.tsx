"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlayingCard from "./PlayingCard";
import { seatName } from "@/lib/seatName";
import { TrickEvent } from "@/lib/trickEvent";

const VISIBLE_MS = 3500;

interface Props {
  trick: TrickEvent | null;
  mySeat: number;
  names?: string[];
}

/**
 * A brief callout after each phase-2 trick resolves: who cut (in red, with
 * the card they cut with), and who the whole trick goes to and why (the
 * player who held the highest card of the led suit) -- or, when nobody cut,
 * that the trick was simply discarded. The main table already moves on to
 * the next trick immediately, so this is the only place that still shows
 * what just happened.
 */
export default function TrickBanner({ trick, mySeat, names }: Props) {
  const [shownAt, setShownAt] = useState<number | null>(null);

  useEffect(() => {
    if (!trick) return;
    setShownAt(trick.at);
    const handle = setTimeout(() => {
      setShownAt((current) => (current === trick.at ? null : current));
    }, VISIBLE_MS);
    return () => clearTimeout(handle);
  }, [trick]);

  if (!trick || shownAt !== trick.at) return null;
  const { event } = trick;
  const resolved = event.resolved;
  if (!resolved) return null;

  const cutter = event.cut ? event.player : null;

  return (
    <AnimatePresence>
      <motion.div
        key={trick.at}
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.96 }}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${
          resolved.pickup
            ? "bg-red-950/60 border-red-500/50"
            : "bg-emerald-950/50 border-emerald-500/40"
        }`}
      >
        {cutter !== null && (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <PlayingCard card={event.card} size="sm" layoutIdPrefix="banner" highlight="cut" />
              <span className="text-[10px] font-bold text-red-400">
                {seatName(cutter, mySeat, names)} CUT
              </span>
            </div>
            <span className="text-lg text-zinc-400">→</span>
          </>
        )}

        <div className="flex flex-col items-center gap-0.5">
          <PlayingCard card={resolved.topCard} size="sm" layoutIdPrefix="banner" highlight="picked" />
          <span className="text-[10px] font-bold text-amber-300">highest card</span>
        </div>

        <div className="text-zinc-200 leading-snug">
          {resolved.pickup ? (
            <>
              <span className="font-bold text-amber-300">{seatName(resolved.winner, mySeat, names)}</span>{" "}
              had the highest card, so <span className="font-bold text-red-300">all {resolved.cards.length} cards</span> go
              to {seatName(resolved.winner, mySeat, names)}
            </>
          ) : (
            <>
              Everyone followed suit —{" "}
              <span className="font-bold text-emerald-300">{seatName(resolved.winner, mySeat, names)}</span> had the
              highest card, but it's discarded for good, not picked up
            </>
          )}
          {resolved.reshuffled && (
            <div className="text-sky-300 text-xs mt-1">Cycle detected — deck reshuffled</div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
