CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(8) NOT NULL,
  player1_name VARCHAR(24) NOT NULL,
  player2_name VARCHAR(24) NOT NULL,
  winner_name VARCHAR(24) NOT NULL,
  theme VARCHAR(80) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  player1_image TEXT,
  player2_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS matches_winner_idx ON matches(winner_name);
