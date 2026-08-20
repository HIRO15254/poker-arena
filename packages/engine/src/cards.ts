/** カードは 0..51 の整数。card = rank * 4 + suit、rank 0=2 .. 12=A、suit 0=c 1=d 2=h 3=s */
export type Card = number;

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";

export function rankOf(c: Card): number {
  return c >> 2;
}

export function suitOf(c: Card): number {
  return c & 3;
}

export function cardToString(c: Card): string {
  return `${RANKS[c >> 2]}${SUITS[c & 3]}`;
}

export function parseCard(s: string): Card {
  const rank = RANKS.indexOf(s[0]!);
  const suit = SUITS.indexOf(s[1]!);
  if (s.length !== 2 || rank < 0 || suit < 0) throw new Error(`invalid card: ${s}`);
  return rank * 4 + suit;
}

export function parseCards(s: string): Card[] {
  return s.split(/\s+/).filter(Boolean).map(parseCard);
}

export function freshDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i);
}
