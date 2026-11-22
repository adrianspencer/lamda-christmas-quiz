CREATE TABLE IF NOT EXISTS hosts (
 code TEXT PRIMARY KEY,
 token TEXT NOT NULL,
 pin_hash TEXT,
 pin_salt TEXT,
 phase TEXT NOT NULL DEFAULT 'lobby'
);
CREATE TABLE IF NOT EXISTS players (
 token TEXT PRIMARY KEY,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_players_code ON players(code);

CREATE TABLE IF NOT EXISTS quiz_game (
 code TEXT PRIMARY KEY,
 question_index INTEGER NOT NULL DEFAULT 0,
 revealed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_answers (
 code TEXT NOT NULL,
 player_token TEXT NOT NULL,
 question_index INTEGER NOT NULL,
 answer TEXT NOT NULL,
 correct INTEGER,
 PRIMARY KEY (code, player_token, question_index)
);
CREATE TABLE IF NOT EXISTS quiz_rudolph (
 code TEXT PRIMARY KEY,
 plan TEXT NOT NULL
);
