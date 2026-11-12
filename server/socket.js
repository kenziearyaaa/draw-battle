const { rooms, THEMES, createRoom, publicRoom, cleanName } = require('./rooms');
const { saveMatch } = require('./store');
const MAX_STROKES = 18000;
const validCode = s => typeof s === 'string' && /^[A-F0-9]{6}$/.test(s);
const roomOf = socket => socket.data.roomCode && rooms.get(socket.data.roomCode);
const isHost = (socket, room) => !!room && socket.id === room.hostSocketId && socket.data.role === 'host';
const emitState = (io, room) => io.to(room.code).emit('room:state', publicRoom(room));
function attachSockets(io) {
 io.on('connection', socket => {
  socket.on('host:create', ({ duration } = {}, ack = () => {}) => {
   const room = createRoom(socket.id); room.duration = [60,90,120].includes(Number(duration)) ? Number(duration) : 90;
   socket.join(room.code); socket.data = { role:'host', roomCode:room.code };
   ack({ ok:true, code:room.code, hostToken:room.hostToken, state:publicRoom(room) });
  });
  socket.on('host:resume', ({ code, hostToken } = {}, ack = () => {}) => {
   const room = validCode(code) && rooms.get(code);
   if (!room || !hostToken || room.hostToken !== hostToken) return ack({ok:false,error:'Room host session is invalid or finished.'});
   room.hostSocketId = socket.id; socket.join(code); socket.data = {role:'host',roomCode:code};
   ack({ok:true,state:publicRoom(room),strokes:room.strokes,images:room.images}); emitState(io,room);
  });
  socket.on('player:join', ({ code, name } = {}, ack = () => {}) => {
   const room = validCode(code) && rooms.get(code); const playerName = cleanName(name);
   if (!room) return ack({ok:false,error:'Room tidak ditemukan.'});
   if (room.phase !== 'lobby') return ack({ok:false,error:'Pertandingan sudah dimulai atau selesai.'});
   if (playerName.length < 2) return ack({ok:false,error:'Nama minimal 2 karakter.'});
   const slot = room.players.findIndex(p => !p || !p.socketId);
   if (slot < 0) return ack({ok:false,error:'Room sudah penuh.'});
   if (room.players.some(p => p && p.name.toLowerCase() === playerName.toLowerCase())) return ack({ok:false,error:'Nama tersebut sudah digunakan di room ini.'});
   room.players[slot] = { id: cryptoId(), name:playerName, socketId:socket.id };
   socket.join(code); socket.data = {role:'player',roomCode:code,slot,playerId:room.players[slot].id};
   ack({ok:true,slot,playerId:room.players[slot].id,state:publicRoom(room),strokes:room.strokes[slot]}); emitState(io,room);
  });
  socket.on('player:resume', ({ code, playerId } = {}, ack = () => {}) => {
   const room = validCode(code) && rooms.get(code); const slot = room?.players.findIndex(p => p && p.id === playerId) ?? -1;
   if (!room || slot < 0 || room.phase === 'finished') return ack({ok:false,error:'Sesi pemain tidak tersedia.'});
   room.players[slot].socketId = socket.id; socket.join(code); socket.data = {role:'player',roomCode:code,slot,playerId};
   ack({ok:true,slot,state:publicRoom(room),strokes:room.strokes[slot],finished:!!room.players[slot].finished}); emitState(io,room);
  });
  socket.on('host:settings', ({duration} = {}, ack=()=>{}) => { const r=roomOf(socket); if(!isHost(socket,r)||r.phase!=='lobby') return ack({ok:false}); if([60,90,120].includes(Number(duration))) r.duration=Number(duration); emitState(io,r); ack({ok:true}); });
  socket.on('host:start', ({theme, random} = {}, ack=()=>{}) => {
   const r=roomOf(socket); if(!isHost(socket,r)||r.phase!=='lobby'||r.players.some(p=>!p?.socketId)) return ack({ok:false,error:'Kedua pemain harus bergabung terlebih dahulu.'});
   r.theme = random !== false ? THEMES[Math.floor(Math.random()*THEMES.length)] : String(theme||'').trim().slice(0,80);
   if(!r.theme) return ack({ok:false,error:'Tema wajib diisi.'});
   r.phase='playing'; r.endsAt=Date.now()+r.duration*1000; r.strokes=[[],[]]; r.redo=[[],[]]; r.images=[null,null];
   io.to(r.code).emit('battle:start',{state:publicRoom(r),serverNow:Date.now()});
   r.timer=setTimeout(()=>finish(io,r),r.duration*1000); emitState(io,r); ack({ok:true});
  });
  socket.on('draw:stroke', (stroke, ack=()=>{}) => {
   const r=roomOf(socket), slot=socket.data.slot;
   if(!r||socket.data.role!=='player'||r.phase!=='playing'||!r.players[slot]||r.players[slot].socketId!==socket.id||r.players[slot].finished||Date.now()>=r.endsAt) return ack({ok:false});
   if(!stroke||!Array.isArray(stroke.points)||stroke.points.length<1||stroke.points.length>120||!['brush','eraser'].includes(stroke.tool)||!/^#[0-9a-fA-F]{6}$/.test(stroke.color)||!Number.isFinite(stroke.size)||stroke.size<1||stroke.size>40) return ack({ok:false});
   const points=stroke.points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1).slice(0,120);
   if(!points.length||r.strokes[slot].length>=MAX_STROKES) return ack({ok:false});
   const safe={tool:stroke.tool,color:stroke.color,size:stroke.size,points}; r.strokes[slot].push(safe); r.redo[slot]=[];
   socket.to(r.code).emit('draw:stroke',{slot,stroke:safe}); ack({ok:true});
  });
  socket.on('draw:action', ({action}={},ack=()=>{})=>{const r=roomOf(socket),slot=socket.data.slot;if(!r||socket.data.role!=='player'||r.phase!=='playing'||r.players[slot]?.socketId!==socket.id||r.players[slot]?.finished||Date.now()>=r.endsAt)return ack({ok:false});if(action==='undo'&&r.strokes[slot].length){r.redo[slot].push(r.strokes[slot].pop())}else if(action==='redo'&&r.redo[slot].length){r.strokes[slot].push(r.redo[slot].pop())}else if(action==='clear'){r.redo[slot].push(...r.strokes[slot]);r.strokes[slot]=[]}else return ack({ok:false});io.to(r.code).emit('draw:history',{slot,strokes:r.strokes[slot]});ack({ok:true});});
  socket.on('draw:sync', (_,ack=()=>{})=>{const r=roomOf(socket);if(!r)return ack({ok:false});ack({ok:true,strokes:r.strokes,images:r.images});});
  socket.on('player:finish', ({image}={},ack=()=>{})=>{const r=roomOf(socket),slot=socket.data.slot;if(!r||socket.data.role!=='player'||r.phase!=='playing'||r.players[slot]?.socketId!==socket.id)return ack({ok:false});if(typeof image==='string'&&image.length<1500000&&/^data:image\/(png|jpeg|webp);base64,/.test(image))r.images[slot]=image;socket.data.finished=true;r.players[slot].finished=true;io.to(r.code).emit('player:finished',{slot});ack({ok:true});});
  socket.on('host:end',(_,ack=()=>{})=>{const r=roomOf(socket);if(!isHost(socket,r)||r.phase!=='playing')return ack({ok:false});clearTimeout(r.timer);finish(io,r);ack({ok:true});});
  socket.on('host:winner',async({slot}={},ack=()=>{})=>{const r=roomOf(socket);if(!isHost(socket,r)||r.phase!=='review'||![0,1].includes(slot)||!r.players[slot])return ack({ok:false,error:'Pilihan pemenang tidak valid.'});r.winner=r.players[slot].name;r.phase='finished';try{await saveMatch(r);}catch(e){console.error('Could not save match:',e.message);}io.to(r.code).emit('battle:winner',{winner:r.winner,slot,players:publicRoom(r).players,images:r.images,theme:r.theme});ack({ok:true});});
  socket.on('host:next',(_,ack=()=>{})=>{const r=roomOf(socket);if(!isHost(socket,r)||r.phase!=='finished')return ack({ok:false});clearTimeout(r.timer);r.players=[null,null];r.phase='lobby';r.theme=null;r.winner=null;r.strokes=[[],[]];r.redo=[[],[]];r.images=[null,null];r.endsAt=null;emitState(io,r);ack({ok:true});});
  socket.on('disconnect',()=>{const r=roomOf(socket);if(!r)return;if(socket.data.role==='player'&&r.players[socket.data.slot]?.socketId===socket.id){r.players[socket.data.slot].socketId=null;emitState(io,r);} });
 });
}
function finish(io,r){if(r.phase!=='playing')return;r.phase='review';clearTimeout(r.timer);io.to(r.code).emit('battle:ended',{state:publicRoom(r),strokes:r.strokes,images:r.images});emitState(io,r);}
function cryptoId(){return require('crypto').randomBytes(12).toString('hex');}
module.exports={attachSockets};
