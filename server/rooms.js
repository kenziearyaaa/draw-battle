const crypto = require('crypto');
const THEMES = ['A robot having a bad day','Your dream house','A cat in space','A futuristic vehicle','A monster made of food','A magical forest','The coolest sneaker','A city underwater','A superhero sidekick','A tiny world inside a bottle','A very confused dinosaur','Your dream holiday'];
const rooms = new Map();
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const token = () => crypto.randomBytes(32).toString('hex');
function createRoom(hostSocketId) {
  let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
  const room = { code: roomCode, hostSocketId, hostToken: token(), players: [null, null], duration: 90, theme: null, phase: 'lobby', strokes: [[], []], redo: [[], []], images: [null, null], winner: null, timer: null, endsAt: null, createdAt: Date.now() };
  rooms.set(roomCode, room); return room;
}
function publicRoom(room) {
  return { code: room.code, phase: room.phase, duration: room.duration, theme: room.theme,
    players: room.players.map(p => p ? { name: p.name, online: !!p.socketId } : null), endsAt: room.endsAt, winner: room.winner };
}
function cleanName(name) { return typeof name === 'string' ? name.trim().replace(/[<>\u0000-\u001f]/g, '').slice(0,24) : ''; }
module.exports = { rooms, THEMES, createRoom, publicRoom, cleanName };
