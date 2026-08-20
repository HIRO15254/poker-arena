/**
 * 4色デッキのプレイングカード。
 * spades #282a30 / hearts #d43a3f / diamonds #3b82f6 / clubs #2f9e6e
 * カード表記は "As" "Td" "7h"(rank: 23456789TJQKA / suit: cdhs)。
 */

export type CardSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<CardSize, string> = {
  sm: " pc-sm",
  md: "",
  lg: " pc-lg",
};

const SUIT_CLASS: Record<string, string> = {
  s: "su-s",
  h: "su-h",
  d: "su-d",
  c: "su-c",
};

function SuitGlyph({ suit }: { suit: string }) {
  switch (suit) {
    case "h":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 20.5C6.5 16 3 12.7 3 8.9 3 6.2 5.2 4 7.9 4c1.7 0 3.2.8 4.1 2.1C12.9 4.8 14.4 4 16.1 4 18.8 4 21 6.2 21 8.9c0 3.8-3.5 7.1-9 11.6z" />
        </svg>
      );
    case "d":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5L19 12l-7 9.5L5 12z" />
        </svg>
      );
    case "c":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="6.5" r="3.4" />
          <circle cx="7" cy="12.5" r="3.4" />
          <circle cx="17" cy="12.5" r="3.4" />
          <path d="M10.5 13.5h3L14.5 21h-5z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5C9.5 6.5 4.5 9 4.5 13a3.8 3.8 0 0 0 6.3 2.9c-.2 1.9-.9 3.4-1.8 4.6h6c-.9-1.2-1.6-2.7-1.8-4.6a3.8 3.8 0 0 0 6.3-2.9c0-4-5-6.5-7.5-10.5z" />
        </svg>
      );
  }
}

const SUIT_NAME: Record<string, string> = {
  s: "スペード",
  h: "ハート",
  d: "ダイヤ",
  c: "クラブ",
};

export function PlayingCard({ card, size = "md" }: { card: string; size?: CardSize }) {
  const rank = card.slice(0, card.length - 1).toUpperCase();
  const suit = card.slice(-1).toLowerCase();
  const suitClass = SUIT_CLASS[suit] ?? "su-s";
  return (
    <div
      className={`pc ${suitClass}${SIZE_CLASS[size]}`}
      role="img"
      aria-label={`${rank} ${SUIT_NAME[suit] ?? ""}`}
    >
      <span>{rank}</span>
      <SuitGlyph suit={suit} />
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: CardSize }) {
  return <div className={`cb${SIZE_CLASS[size]}`} role="img" aria-label="伏せカード" />;
}

export function CardSlot({ size = "md" }: { size?: CardSize }) {
  return <div className={`pcx${SIZE_CLASS[size]}`} aria-hidden="true" />;
}

/** 手札・ボードのカード列。cards が null なら裏向き count 枚。 */
export function CardRow({
  cards,
  size = "md",
  hiddenCount = 2,
  gap = 6,
}: {
  cards: string[] | null;
  size?: CardSize;
  hiddenCount?: number;
  gap?: number;
}) {
  if (cards === null) {
    return (
      <div style={{ display: "flex", gap }}>
        {Array.from({ length: hiddenCount }, (_, i) => (
          <CardBack key={i} size={size} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap }}>
      {cards.map((c, i) => (
        <PlayingCard key={`${c}-${i}`} card={c} size={size} />
      ))}
    </div>
  );
}

/** ボード。5 枚に満たない分は破線プレースホルダで埋める。 */
export function Board({ cards, size = "md" }: { cards: string[]; size?: CardSize }) {
  const slots = Math.max(0, 5 - cards.length);
  return (
    <div className="board">
      {cards.map((c, i) => (
        <PlayingCard key={`${c}-${i}`} card={c} size={size} />
      ))}
      {Array.from({ length: slots }, (_, i) => (
        <CardSlot key={`slot-${i}`} size={size} />
      ))}
    </div>
  );
}

/** 履歴中などで使う小さなテキスト表記("7h 2c Jd") */
export function CardText({ cards }: { cards: string[] }) {
  return <span className="mono">{cards.join(" ")}</span>;
}
