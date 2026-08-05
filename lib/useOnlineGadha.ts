"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Level } from "./engine/bots";
import { RoomView } from "./room/redact";

const POLL_MS = 1000;

interface ActionResponse {
  view?: RoomView;
  error?: string;
}

async function postJSON(url: string, body: unknown): Promise<ActionResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Drives an online room: polls server state (which also renews this seat's
 * presence heartbeat) and exposes the same shape of actions a local hook
 * would, so GameBoard doesn't need to know whether it's talking to the local
 * engine or a server.
 */
export function useOnlineGadha(code: string, token: string | null) {
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function poll() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch(
          `/api/room/${code}/state?token=${encodeURIComponent(token!)}`
        );
        const data: ActionResponse = await res.json();
        if (cancelled) return;
        if (data.error) setError(data.error);
        else if (data.view) {
          setView(data.view);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("connection lost -- retrying");
      } finally {
        inFlight.current = false;
      }
    }

    poll();
    const handle = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [code, token]);

  const runAction = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      if (!token) return;
      setBusy(true);
      try {
        const data = await postJSON(url, { ...body, token });
        if (data.error) setError(data.error);
        else if (data.view) {
          setView(data.view);
          setError(null);
        }
      } catch {
        setError("connection lost -- try again");
      } finally {
        setBusy(false);
      }
    },
    [token]
  );

  const playCard = useCallback(
    (card: number) => runAction(`/api/room/${code}/play`, { card }),
    [runAction, code]
  );
  const startGame = useCallback(() => runAction(`/api/room/${code}/start`, {}), [runAction, code]);
  const nextGame = useCallback(() => runAction(`/api/room/${code}/next`, {}), [runAction, code]);
  const setSeatBot = useCallback(
    (seat: number, level: Level) => runAction(`/api/room/${code}/set-bot`, { seat, level }),
    [runAction, code]
  );
  const clearSeat = useCallback(
    (seat: number) => runAction(`/api/room/${code}/clear-seat`, { seat }),
    [runAction, code]
  );

  return { view, error, busy, playCard, startGame, nextGame, setSeatBot, clearSeat };
}
