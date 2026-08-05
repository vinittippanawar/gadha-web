import { StepEvent } from "./engine/types";

/** A resolved phase-2 trick, stamped with when it happened so the UI can
 *  show it briefly and then let it expire. Shared by solo mode (built
 *  directly from step()'s return value) and online mode (the server embeds
 *  the same shape in the room view -- trick cards are never secret, so no
 *  redaction is needed here). */
export interface TrickEvent {
  event: Extract<StepEvent, { kind: "phase2" }>;
  at: number;
}

export function trickEventFrom(event: StepEvent): TrickEvent | null {
  if (event.kind === "phase2" && event.resolved) {
    return { event, at: Date.now() };
  }
  return null;
}
