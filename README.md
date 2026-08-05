# Gadha (Donkey) — 2D animated card game, solo or online with friends

A browser version of the Gadha terminal game, built with Next.js, React,
TypeScript and Framer Motion. Play solo against 5 bots, or create a room and
share a code with friends — like Ludo King's room-code flow. Deploys free on
Vercel.

The full rules — including every corrected assumption and the reasoning
behind each fix — are documented in `../terminal-games/GADHA_RULES.md`. The
game logic here is an independent, verified TypeScript port of
`gadha_engine.py`; both are kept in sync.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Online rooms work
out of the box in dev with **no setup** — see "Online multiplayer" below for
why, and what changes in production.

## Test the engine

```bash
npx vitest run
```

20 tests cover the rules directly: card matching, the phase-1
replay-restriction, the confirmed cutter-leads rule, the series carry-over
penalty, and the cycle-detection reshuffle — including a deterministic test
that forces the exact repeating-cycle scenario and confirms it's caught.

## How it's built

```
lib/engine/
  cards.ts      card primitives: values, matching, trick ranking
  types.ts      GameState -- plain, JSON-serializable, no classes
  engine.ts     the rules: a pure reducer, step(state, card, rng) -> state
  bots.ts       random / greedy / Monte-Carlo bots
  rng.ts        seedable PRNG (so games and tests are reproducible)

lib/useGadhaGame.ts     solo hook: owns state locally, drives bot turns
lib/useOnlineGadha.ts   online hook: polls a room on the server instead

lib/room/
  types.ts      Room / SeatInfo -- server-side room shape
  store.ts      key-value abstraction: memory locally, Upstash Redis in prod
  rooms.ts      room lifecycle: create, join, start, play, next game
  redact.ts     strips opponents' real cards before a view leaves the server
  api.ts        shared response helper for the route handlers

app/api/room/...        Next.js route handlers -- the only place that
                         touches the authoritative, unredacted GameState
app/room/page.tsx        create-or-join landing
app/room/[code]/page.tsx  a specific room (server wrapper, see below)

components/
  GameBoard.tsx     shared table+hand+log+end-screen, used by BOTH modes
  GadhaApp.tsx      solo mode: GameBoard + local difficulty picker
  RoomClient.tsx    online mode: join screen, lobby, GameBoard once playing
  PlayingCard.tsx   one animated card (framer-motion layoutId per card value)
  Seat.tsx          a seat around the table (bot, human, or empty/waiting)
  HandRow.tsx       your clickable hand, with phase-1 cost badges
  TableCenter.tsx   phase-1 table grid / phase-2 trick-in-progress
  StatusBar.tsx     phase, turn, series scoreboard, room code
  EndScreen.tsx     gadha reveal, reshuffle count, next-game control
```

**Why `engine.ts` is a pure reducer.** `step(state, card, rng)` never mutates
its input — it returns a new state plus an event describing what happened.
That shape is what let online mode reuse it directly: `lib/room/rooms.ts`
calls the *exact same* `step()`, `createGame()`, and `chooseBotMove()` as the
solo hook. Nothing about the rules was rewritten for multiplayer.

**Why `mySeat` is a prop, not a constant.** Solo mode is always seat 0. Online,
you could be any of the 6 seats. Every shared component (`GameBoard`,
`TableCenter`, `StatusBar`, `EndScreen`, `Seat`) takes `mySeat` as a parameter
and computes "who's an opponent" and "which 5 positions go around the oval"
from it, so the identical components render correctly regardless of which
seat you're sitting in.

**Animation.** Every card element carries a stable `layoutId` keyed to its
card value. When a card moves position in the React tree — hand to table,
table to a hand on a catch, trick area to a pile — Framer Motion computes the
FLIP transform automatically. There's no manual coordinate math for "flying"
cards. Redacted opponent cards get unique negative placeholder IDs (see
`lib/room/redact.ts`) specifically so this still works without ever sending a
real hidden card value to the wrong client.

**Hydration.** Next.js server-renders client components for the first paint.
The initial solo deal is seeded deterministically (seed `0`) so the
server-rendered HTML and the client's first render match exactly, then a
`useEffect` re-seeds with real randomness immediately after mount — client
only, after hydration has already succeeded. Skipping this was a real bug
caught during verification: a `Date.now()`-seeded initial deal produced a
different hand on the server than on the client, and React discarded the
whole tree to reconcile it. (Online mode doesn't need this trick at all —
the deal happens server-side in a route handler, never during a render.)

## Online multiplayer

Create a room, get a 5-character code, share it — friends join via the code
or a direct link, wait in a lobby, and the host starts the game. Any seat not
claimed by a human plays as a bot (difficulty chosen per-seat by the host).

**Architecture: Next.js API routes + Redis, no separate server.** Every
action (`create`, `join`, `start`, `play`, `next`) is a normal Vercel
serverless route handler under `app/api/room/`. The authoritative `GameState`
for a room lives in a small shared store (`lib/room/store.ts`), and clients
poll for updates roughly once a second (`lib/useOnlineGadha.ts`).

This was a deliberate choice over a "real" WebSocket/PartyKit-style backend:
Gadha is turn-based, so nobody needs sub-100ms updates — a ~1 second poll
feels prompt, not laggy, and this way the *entire app, including
multiplayer, deploys to one place* with no second service to stand up. See
`../terminal-games/GADHA_RULES.md`-adjacent project notes for the fuller
comparison of options considered (Pusher/Ably for true push-based sync,
PartyKit/Cloudflare for a dedicated realtime server) if 1-second polling ever
stops being good enough.

**Redaction.** The server never sends a client any card it isn't entitled to
see. `lib/room/redact.ts` replaces every other seat's hand with unique
negative placeholder IDs before a view leaves the server — verified directly:
opening two separate browser sessions in the same room, each one's own hand
renders face-up with real values, and the other player's hand renders as a
count of face-down cards with no real card data anywhere in that response.

**No account needed to develop or test this.** `lib/room/store.ts` picks an
in-process memory store automatically when `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` aren't set — which is exactly how this was built
and verified (two-browser-context Playwright sessions, zero external
services). The memory store works for a single dev server or a single
serverless instance; it will *not* share rooms across multiple production
instances, which is the one thing Upstash actually buys you.

### Setting up Upstash for production (free, ~2 minutes)

1. Create a free account at [console.upstash.com](https://console.upstash.com)
   (no card required).
2. Create a Redis database (any region close to your Vercel deployment).
3. Copy the **REST URL** and **REST TOKEN** from its dashboard.
4. Add them as environment variables in your Vercel project settings (or in
   `.env.local` for local testing against real Redis) — see
   `.env.local.example` for the exact names.

Without this, online rooms still work locally and even in a single-instance
deployment, but real production traffic across Vercel's multiple serverless
instances needs the shared store to reliably find the same room.

## Deploy on Vercel (free)

```bash
npm install -g vercel   # once
vercel                  # from this directory; follow the prompts
```

Or connect the repo at [vercel.com/new](https://vercel.com/new). Add the two
Upstash env vars (above) in the project's settings before or after the first
deploy — solo mode works with zero configuration either way; online mode
needs them for real multi-player traffic.

## What's not built (known gaps, honestly listed)

- **No reconnect grace period beyond presence display.** A disconnected
  seat is shown as such (`Seat` renders a 📶 indicator once ~30s pass with no
  poll from that seat), but nothing automatically hands their turn to a bot
  if they never come back — the game just waits.
- **No rate limiting on room actions.** Fine for a hobby game among friends;
  would need attention before any public, adversarial use.
- **Simple concurrency, not transactional.** Two near-simultaneous requests
  for the same room use a plain get-then-set against the store, not an
  atomic compare-and-swap. Low-stakes and low-probability for a casual game
  with real turn-taking (only one seat is ever actually allowed to move at
  a time), but worth knowing if this ever needs to scale beyond that.
