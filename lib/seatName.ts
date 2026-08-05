/**
 * Shared seat-labeling helper. `names`, when given (online rooms), lets
 * other seats show a real player name instead of "Bot N" -- solo-vs-bots
 * mode omits it, since every other seat there really is a bot.
 */
export function seatName(seat: number, mySeat: number, names?: string[]): string {
  if (seat === mySeat) return "You";
  if (names?.[seat]) return names[seat];
  return `Bot ${seat}`;
}
