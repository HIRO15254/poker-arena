import { seasonOneConfig, type SeasonConfig } from "@poker-arena/protocol";

/** シーズン1はデプロイ月の1日 00:00 UTC から翌月1日まで。 */
export function currentSeason(now = new Date()): SeasonConfig {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const config = seasonOneConfig(start.toISOString(), end.toISOString());
  // ベータ期間の掲載条件。SPEC の 10,000 は 6-max 導入時に戻す
  config.minHandsForLeaderboard = 2000;
  return config;
}
