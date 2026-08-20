CREATE TABLE IF NOT EXISTS bot_versions (
  bot_id      TEXT NOT NULL,
  version     INTEGER NOT NULL,
  deployed_at TEXT NOT NULL,
  note        TEXT,
  PRIMARY KEY (bot_id, version)
);
-- 既存 bot の現行バージョンを登録日で埋める
INSERT OR IGNORE INTO bot_versions (bot_id, version, deployed_at)
SELECT id, version, updated_at FROM bots;
