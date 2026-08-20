-- Poker Arena D1 schema

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  api_key_hash  TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bots (
  id                    TEXT PRIMARY KEY,
  owner_id              TEXT NOT NULL,
  name                  TEXT NOT NULL,
  kind                  TEXT NOT NULL,           -- webhook | builtin
  webhook_url           TEXT,
  builtin_strategy      TEXT,
  secret                TEXT NOT NULL,
  status                TEXT NOT NULL,           -- idle | active | error
  version               INTEGER NOT NULL DEFAULT 1,
  last_error            TEXT,
  last_error_at         TEXT,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bots_owner ON bots(owner_id);
CREATE INDEX IF NOT EXISTS bots_status ON bots(status);

-- シーズン成績。bot を再デプロイすると version が上がり、成績は新しい行に分離される
CREATE TABLE IF NOT EXISTS season_stats (
  season_id       TEXT NOT NULL,
  bot_id          TEXT NOT NULL,
  version         INTEGER NOT NULL,
  hands           INTEGER NOT NULL DEFAULT 0,
  net_chips       INTEGER NOT NULL DEFAULT 0,
  sum_sq_bb       REAL    NOT NULL DEFAULT 0,
  vpip_hands      INTEGER NOT NULL DEFAULT 0,
  pfr_hands       INTEGER NOT NULL DEFAULT 0,
  showdown_hands  INTEGER NOT NULL DEFAULT 0,
  won_showdown    INTEGER NOT NULL DEFAULT 0,
  btn_hands       INTEGER NOT NULL DEFAULT 0,
  btn_net         INTEGER NOT NULL DEFAULT 0,
  bb_hands        INTEGER NOT NULL DEFAULT 0,
  bb_net          INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (season_id, bot_id, version)
);

-- bb/100 推移用のスナップショット
CREATE TABLE IF NOT EXISTS stat_timeline (
  season_id  TEXT NOT NULL,
  bot_id     TEXT NOT NULL,
  version    INTEGER NOT NULL,
  hands      INTEGER NOT NULL,
  bb100      REAL NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS timeline_bot ON stat_timeline(season_id, bot_id, version, hands);

CREATE TABLE IF NOT EXISTS hands (
  id           TEXT PRIMARY KEY,
  season_id    TEXT NOT NULL,
  table_id     TEXT NOT NULL,
  hand_number  INTEGER NOT NULL,
  played_at    TEXT NOT NULL,
  button       INTEGER NOT NULL,
  small_blind  INTEGER NOT NULL,
  big_blind    INTEGER NOT NULL,
  board        TEXT NOT NULL,
  pot          INTEGER NOT NULL,
  rake         INTEGER NOT NULL,
  seats        TEXT NOT NULL,
  actions      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hands_table ON hands(table_id, hand_number);
CREATE INDEX IF NOT EXISTS hands_played ON hands(played_at);

CREATE TABLE IF NOT EXISTS hand_seats (
  hand_id    TEXT NOT NULL,
  bot_id     TEXT NOT NULL,
  seat       INTEGER NOT NULL,
  net        INTEGER NOT NULL,
  showdown   INTEGER NOT NULL DEFAULT 0,
  played_at  TEXT NOT NULL,
  PRIMARY KEY (hand_id, bot_id)
);
CREATE INDEX IF NOT EXISTS hand_seats_bot ON hand_seats(bot_id, played_at);

-- 直近の対戦カード(観戦用)
CREATE TABLE IF NOT EXISTS tables (
  id            TEXT PRIMARY KEY,
  season_id     TEXT NOT NULL,
  bot_a         TEXT NOT NULL,
  bot_b         TEXT NOT NULL,
  hand_number   INTEGER NOT NULL DEFAULT 0,
  last_hand_id  TEXT,
  updated_at    TEXT NOT NULL
);

-- 人間 vs bot のプレイセッション(デッキシード + hero のアクション列から決定的に再構築)
CREATE TABLE IF NOT EXISTS play_sessions (
  id            TEXT PRIMARY KEY,
  opponent      TEXT NOT NULL,
  seed          INTEGER NOT NULL,
  hand_number   INTEGER NOT NULL DEFAULT 1,
  hero_actions  TEXT NOT NULL DEFAULT '[]',
  total_hands   INTEGER NOT NULL DEFAULT 0,
  total_net     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
