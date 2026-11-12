const { Pool } = require('pg');
let pool;
function initDb() {
  if (!process.env.DATABASE_URL) return null;
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false, max: 10 });
  pool.on('error', err => console.error('PostgreSQL pool error:', err.message));
  return pool;
}
async function saveMatch(match) {
  if (!pool) return false;
  await pool.query(`INSERT INTO matches (room_code,player1_name,player2_name,winner_name,theme,duration_seconds,player1_image,player2_image)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [match.code, match.players[0].name, match.players[1].name, match.winner, match.theme, match.duration, match.images[0], match.images[1]]);
  return true;
}
async function recentMatches() {
  if (!pool) return null;
  const { rows } = await pool.query('SELECT room_code, player1_name, player2_name, winner_name, theme, duration_seconds, created_at FROM matches ORDER BY created_at DESC LIMIT 30');
  return rows;
}
async function leaderboard() {
  if (!pool) return null;
  const { rows } = await pool.query(`SELECT name, SUM(wins)::int wins, SUM(played)::int played,
    ROUND(100.0*SUM(wins)/NULLIF(SUM(played),0),1) win_rate FROM (
      SELECT player1_name name, CASE WHEN winner_name=player1_name THEN 1 ELSE 0 END wins, 1 played FROM matches
      UNION ALL SELECT player2_name, CASE WHEN winner_name=player2_name THEN 1 ELSE 0 END, 1 FROM matches
    ) stats GROUP BY name ORDER BY wins DESC, win_rate DESC, played DESC, name ASC LIMIT 50`);
  return rows;
}
module.exports = { initDb, saveMatch, leaderboard, recentMatches };
