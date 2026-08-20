/**
 * 組み込み戦略の一覧と説明。
 * 正は packages/simulator の BOT_NAMES(サーバーは GET /api/builtins で同じ並びを返す)。
 * 戦略を増やしたらここにも説明を足すこと。
 */
export interface BuiltinStrategy {
  id: string;
  label: string;
  description: string;
}

export const BUILTIN_STRATEGIES: BuiltinStrategy[] = [
  { id: "tight", label: "tight", description: "堅実なレンジで攻める。現状もっとも強い" },
  { id: "balanced", label: "balanced", description: "堅実なレンジに一定割合のブラフを混ぜる" },
  { id: "lag", label: "lag", description: "ほぼ全ハンドで開き、高頻度のブラフで圧をかける" },
  { id: "aggro", label: "aggro", description: "ハンドを問わずベット・レイズを多用する" },
  { id: "random", label: "random", description: "合法アクションから一様ランダムに選ぶ" },
  { id: "call", label: "call", description: "常にコール。ショーダウンまで降りない" },
  { id: "fold", label: "fold", description: "常にフォールド。動作確認用" },
];

export const BUILTIN_IDS: string[] = BUILTIN_STRATEGIES.map((s) => s.id);
