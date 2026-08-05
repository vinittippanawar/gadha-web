"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cardName } from "./engine/cards";
import { createGame, legalMoves, step } from "./engine/engine";
import { chooseBotMove, Level } from "./engine/bots";
import { makeRng, Rng } from "./engine/rng";
import { GameState, StepEvent } from "./engine/types";

export const YOU = 0;
export const NUM_PLAYERS = 6;

export interface LogEntry {
  id: number;
  text: string;
  kind: "info" | "pickup" | "cut" | "safe" | "gadha";
}

function seatName(p: number): string {
  return p === YOU ? "You" : `Bot ${p}`;
}

function describeEvent(event: StepEvent, nextState: GameState): LogEntry[] {
  const entries: LogEntry[] = [];
  const id = Date.now() + Math.random();
  if (event.kind === "timeout") {
    entries.push({ id, text: "Turn cap reached - largest hand loses.", kind: "info" });
    return entries;
  }
  if (event.kind === "phase1") {
    if (event.picked) {
      entries.push({
        id,
        text: `${seatName(event.player)} plays ${cardName(event.card)} -> catches ${event.caught
          .map(cardName)
          .join(" ")} (+own) = ${event.picked} cards`,
        kind: "pickup",
      });
    } else {
      entries.push({ id, text: `${seatName(event.player)} plays ${cardName(event.card)} - safe`, kind: "info" });
    }
    if (event.phaseEnd) {
      entries.push({
        id: id + 0.1,
        text:
          nextState.leftoverTo !== null
            ? `Leftover ${nextState.leftoverCount} cards -> ${seatName(nextState.leftoverTo)} (last game's gadha)`
            : nextState.leftoverCount
              ? `Leftover ${nextState.leftoverCount} cards split equally`
              : "Table cleared exactly - no leftovers",
        kind: "info",
      });
    }
  } else {
    entries.push({
      id,
      text: `${seatName(event.player)} plays ${cardName(event.card)}${event.cut ? "  CUT!" : ""}`,
      kind: event.cut ? "cut" : "info",
    });
    if (event.resolved) {
      const r = event.resolved;
      entries.push({
        id: id + 0.1,
        text: r.pickup
          ? `${cardName(r.topCard)} was highest -> ${seatName(r.taker!)} picks up ${r.cards.length} cards`
          : `All followed, ${cardName(r.topCard)} wins -> discarded for good`,
        kind: r.pickup ? "pickup" : "info",
      });
      r.exited.forEach((p) => entries.push({ id: id + 0.2 + p, text: `${seatName(p)} is out - safe!`, kind: "safe" }));
      if (r.reshuffled) {
        entries.push({
          id: id + 0.3,
          text: "Cycle detected - deck reshuffled, everyone still in gets a fresh 5-card hand",
          kind: "info",
        });
      }
    }
  }
  if (nextState.finished) {
    entries.push({
      id: id + 0.5,
      text:
        nextState.gadha === null
          ? "Nobody is left holding cards - no Gadha this round."
          : `${seatName(nextState.gadha)} is the GADHA.`,
      kind: "gadha",
    });
  }
  return entries;
}

export function useGadhaGame(level: Level) {
  // Next.js server-renders this client component for the first paint. If the
  // initial deal were seeded from Date.now(), the server's random deal and
  // the client's (different) random deal would produce different HTML and
  // React would throw a hydration mismatch and re-render the whole tree.
  // Fix: seed 0 deterministically for that first render (server and client
  // compute the *same* deal), then re-seed for real randomness in an effect,
  // which only ever runs client-side, after hydration has already succeeded.
  const gameRng = useRef<Rng>(makeRng(0));
  const botRngs = useRef<Rng[]>(
    Array.from({ length: NUM_PLAYERS - 1 }, () => makeRng(0))
  );
  const randomized = useRef(false);
  const scoredRef = useRef(false);

  const [state, setState] = useState<GameState>(() => createGame({}, gameRng.current));
  const [lastEvent, setLastEvent] = useState<StepEvent | null>(null);
  const [scores, setScores] = useState<number[]>(() => Array(NUM_PLAYERS).fill(0));
  const [gameNo, setGameNo] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [botThinking, setBotThinking] = useState(false);

  // Runs once, client-side only, after the seed-0 tree has already been
  // hydrated -- this is what makes the real deal actually random per visit
  // without ever risking a server/client HTML mismatch.
  useEffect(() => {
    if (randomized.current) return;
    randomized.current = true;
    gameRng.current = makeRng();
    botRngs.current = Array.from({ length: NUM_PLAYERS - 1 }, () => makeRng());
    setState(createGame({}, gameRng.current));
  }, []);

  const applyStep = useCallback((prev: GameState, card: number) => {
    const { state: next, event } = step(prev, card, gameRng.current);
    setLastEvent(event);
    setLog((l) => [...describeEvent(event, next), ...l].slice(0, 60));
    setState(next);
  }, []);

  // Reads `state` from closure rather than a setState updater: applyStep has
  // side effects (setLog, setLastEvent), and an updater function can be
  // invoked more than once (React Strict Mode does this deliberately), which
  // would duplicate log entries and re-run step() for the same move.
  const playCard = useCallback(
    (card: number) => {
      if (state.finished || state.turn !== YOU) return;
      if (!legalMoves(state, YOU).includes(card)) return;
      applyStep(state, card);
    },
    [state, applyStep]
  );

  // Bot auto-play: whenever it's a bot's turn, "think" for a moment, then move.
  useEffect(() => {
    if (state.finished || state.turn === null || state.turn === YOU) {
      setBotThinking(false);
      return;
    }
    setBotThinking(true);
    const bot = state.turn;
    const delay = 450 + Math.random() * 500;
    const handle = setTimeout(() => {
      const rng = botRngs.current[bot - 1];
      const { card } = chooseBotMove(state, bot, level, rng);
      setBotThinking(false);
      applyStep(state, card);
    }, delay);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, level]);

  // Tally the series score exactly once per finished game.
  useEffect(() => {
    if (state.finished && !scoredRef.current) {
      scoredRef.current = true;
      if (state.gadha !== null) {
        setScores((prev) => {
          const copy = [...prev];
          copy[state.gadha!]++;
          return copy;
        });
      }
    }
  }, [state]);

  const newGame = useCallback((carryGadha: number | null) => {
    scoredRef.current = false;
    const fresh = createGame({ carryGadha }, gameRng.current);
    setState(fresh);
    setLastEvent(null);
    setGameNo((g) => g + 1);
  }, []);

  const restartSeries = useCallback(() => {
    scoredRef.current = false;
    setScores(Array(NUM_PLAYERS).fill(0));
    setGameNo(1);
    setLog([]);
    const fresh = createGame({}, gameRng.current);
    setState(fresh);
    setLastEvent(null);
  }, []);

  return { state, lastEvent, log, scores, gameNo, botThinking, playCard, newGame, restartSeries };
}
