import { freshDeck, type Card } from "@poker-arena/engine";

/**
 * Web Crypto による予測不可能なシャッフル。
 *
 * 以前はハンドごとに 32bit のシードを作って mulberry32 でシャッフルしていたが、
 * シードの探索空間が狭く、bot は自分の 2 枚とフロップ 3 枚からシードを総当たりして
 * 相手のホールカードとターン/リバーを復元できてしまった。
 * シードを介さず毎回デッキそのものを CSPRNG で作ることで、この経路を塞ぐ。
 */
export function secureDeck(): Card[] {
  const deck = freshDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureIndex(i + 1);
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

/** [0, n) の一様乱数。剰余バイアスを避けるため棄却サンプリングする */
function secureIndex(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % n;
  }
}

/** bot の内部乱数用シード(デッキとは無関係) */
export function secureSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}
