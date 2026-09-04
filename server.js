const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const {
  createDeck,
  shuffle,
  sortCards,
  bestMeldSolution,
  canTakeDiscard,
  publicCard
} = require('./game/phom');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 20000,
  pingInterval: 10000
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const ROOM_TTL = 6 * 60 * 60 * 1000;
const DISCONNECT_TTL = 5 * 60 * 1000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 20) || 'Người chơi';
}

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function makeToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function newPlayer(socket, name, token) {
  return {
    id: crypto.randomUUID(),
    socketId: socket.id,
    token: token || makeToken(),
    name: cleanName(name),
    connected: true,
    cards: [],
    takenCards: [],
    discardCount: 0,
    laidDown: false,
    laydown: null,
    disconnectTimer: null
  };
}

function newRoom(code, hostPlayer) {
  return {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId: hostPlayer.id,
    players: [hostPlayer],
    status: 'waiting',
    deck: [],
    discardPile: [],
    currentIndex: 0,
    phase: 'waiting',
    totalDiscards: 0,
    lastAction: 'Phòng đã được tạo.',
    results: null
  };
}

function touch(room) {
  room.updatedAt = Date.now();
}

function currentPlayer(room) {
  return room.players[room.currentIndex] || null;
}

function socketPlayer(socket) {
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;
  if (!roomCode || !playerId) return {};
  const room = rooms.get(roomCode);
  const player = room?.players.find((p) => p.id === playerId);
  return { room, player };
}

function publicRoom(room, viewerId) {
  const current = currentPlayer(room);
  const viewer = room.players.find((p) => p.id === viewerId);
  const topDiscard = room.discardPile.at(-1) || null;
  const canAct = room.status === 'playing' && current?.id === viewerId;
  const canDraw = canAct && room.phase === 'draw';
  const canDiscard = canAct && room.phase === 'discard' && viewer?.cards.length === 10;
  const canTake = canDraw && topDiscard && viewer ? canTakeDiscard(viewer.cards, topDiscard) : false;
  const canLayDown = canAct && room.phase === 'discard' && viewer && viewer.discardCount >= 3 && !viewer.laidDown;

  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    phase: room.phase,
    deckCount: room.deck.length,
    topDiscard: publicCard(topDiscard),
    totalDiscards: room.totalDiscards,
    lastAction: room.lastAction,
    currentPlayerId: current?.id || null,
    currentPlayerName: current?.name || null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      cardCount: p.cards.length,
      discardCount: p.discardCount,
      laidDown: p.laidDown,
      melds: p.laidDown ? (p.laydown?.melds || []).map((m) => m.map(publicCard)) : []
    })),
    me: viewer ? {
      id: viewer.id,
      name: viewer.name,
      cards: sortCards(viewer.cards).map(publicCard),
      canDraw,
      canTake,
      canDiscard,
      canLayDown,
      isHost: room.hostId === viewer.id,
      token: viewer.token
    } : null,
    results: room.results
  };
}

function emitRoom(room) {
  touch(room);
  for (const p of room.players) {
    if (p.connected && p.socketId) {
      io.to(p.socketId).emit('state', publicRoom(room, p.id));
    }
  }
}

function ackError(ack, message) {
  if (typeof ack === 'function') ack({ ok: false, error: message });
}

function attachSocketToPlayer(socket, room, player) {
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  player.socketId = socket.id;
  player.connected = true;
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
  socket.join(room.code);
}

function createRoomFor(socket, name, token) {
  const player = newPlayer(socket, name, token);
  const code = makeCode();
  const room = newRoom(code, player);
  rooms.set(code, room);
  attachSocketToPlayer(socket, room, player);
  return { room, player };
}

function startGame(room) {
  const deck = shuffle(createDeck());
  room.deck = deck;
  room.discardPile = [];
  room.totalDiscards = 0;
  room.results = null;
  room.status = 'playing';
  room.phase = 'discard';
  room.currentIndex = 0;

  for (const p of room.players) {
    p.cards = [];
    p.takenCards = [];
    p.discardCount = 0;
    p.laidDown = false;
    p.laydown = null;
  }

  for (let round = 0; round < 9; round += 1) {
    for (const p of room.players) p.cards.push(room.deck.pop());
  }
  room.players[0].cards.push(room.deck.pop());
  room.lastAction = `${room.players[0].name} có 10 lá và đánh trước.`;
}

function finishGame(room, reason = 'Đã hết 4 vòng.') {
  const rows = room.players.map((p) => {
    const solution = bestMeldSolution(p.cards);
    return {
      playerId: p.id,
      name: p.name,
      score: solution.deadwoodScore,
      isMom: solution.melds.length === 0,
      isU: solution.deadwoodScore === 0,
      melds: solution.melds.map((m) => m.map(publicCard)),
      deadwood: solution.deadwood.map(publicCard)
    };
  });

  rows.sort((a, b) => {
    if (a.isU !== b.isU) return a.isU ? -1 : 1;
    if (a.isMom !== b.isMom) return a.isMom ? 1 : -1;
    return a.score - b.score;
  });
  rows.forEach((r, i) => { r.rank = i + 1; });

  room.status = 'finished';
  room.phase = 'finished';
  room.results = { reason, rows };
  room.lastAction = reason;
}

function advanceTurn(room) {
  if (room.totalDiscards >= room.players.length * 4 || room.deck.length === 0) {
    finishGame(room, room.deck.length === 0 ? 'Nọc đã hết.' : 'Đã đủ 4 vòng.');
    return;
  }
  room.currentIndex = (room.currentIndex + 1) % room.players.length;
  room.phase = 'draw';
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ name, token } = {}, ack) => {
    const { room, player } = createRoomFor(socket, name, token);
    ack?.({ ok: true, code: room.code, token: player.token, playerId: player.id });
    emitRoom(room);
  });

  socket.on('join-room', ({ code, name, token } = {}, ack) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ackError(ack, 'Không tìm thấy phòng. Có thể server vừa khởi động lại.');

    let player = token ? room.players.find((p) => p.token === token) : null;
    if (player) {
      player.name = cleanName(name || player.name);
      attachSocketToPlayer(socket, room, player);
      ack?.({ ok: true, code, token: player.token, playerId: player.id, reconnected: true });
      room.lastAction = `${player.name} đã kết nối lại.`;
      emitRoom(room);
      return;
    }

    if (room.status !== 'waiting') return ackError(ack, 'Ván đã bắt đầu. Chỉ người chơi cũ mới có thể vào lại.');
    if (room.players.length >= 4) return ackError(ack, 'Phòng đã đủ 4 người.');

    player = newPlayer(socket, name, token);
    room.players.push(player);
    attachSocketToPlayer(socket, room, player);
    room.lastAction = `${player.name} đã vào phòng.`;
    ack?.({ ok: true, code, token: player.token, playerId: player.id });
    emitRoom(room);
  });

  socket.on('start-game', (_payload, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ackError(ack, 'Bạn chưa ở trong phòng.');
    if (room.hostId !== player.id) return ackError(ack, 'Chỉ chủ phòng được bắt đầu.');
    if (room.status === 'playing') return ackError(ack, 'Ván đang diễn ra.');
    if (room.players.length < 2) return ackError(ack, 'Cần ít nhất 2 người.');
    if (room.players.some((p) => !p.connected)) return ackError(ack, 'Có người đang mất kết nối.');
    startGame(room);
    ack?.({ ok: true });
    emitRoom(room);
  });

  socket.on('draw-card', (_payload, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ackError(ack, 'Bạn chưa ở trong phòng.');
    if (room.status !== 'playing' || currentPlayer(room)?.id !== player.id || room.phase !== 'draw') {
      return ackError(ack, 'Chưa tới lượt bốc bài.');
    }
    const card = room.deck.pop();
    if (!card) return ackError(ack, 'Nọc đã hết.');
    player.cards.push(card);
    room.phase = 'discard';
    room.lastAction = `${player.name} đã bốc 1 lá.`;
    ack?.({ ok: true });
    emitRoom(room);
  });

  socket.on('take-discard', (_payload, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ackError(ack, 'Bạn chưa ở trong phòng.');
    if (room.status !== 'playing' || currentPlayer(room)?.id !== player.id || room.phase !== 'draw') {
      return ackError(ack, 'Chưa tới lượt ăn bài.');
    }
    const card = room.discardPile.at(-1);
    if (!card) return ackError(ack, 'Chưa có lá bài bỏ để ăn.');
    if (!canTakeDiscard(player.cards, card)) return ackError(ack, 'Lá này chưa tạo được phỏm với bài trên tay.');
    room.discardPile.pop();
    player.cards.push(card);
    player.takenCards.push(card.id);
    room.phase = 'discard';
    room.lastAction = `${player.name} đã ăn ${label(card)}.`;
    ack?.({ ok: true });
    emitRoom(room);
  });

  socket.on('discard-card', ({ cardId } = {}, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ackError(ack, 'Bạn chưa ở trong phòng.');
    if (room.status !== 'playing' || currentPlayer(room)?.id !== player.id || room.phase !== 'discard') {
      return ackError(ack, 'Chưa tới lượt đánh bài.');
    }
    if (player.cards.length !== 10) return ackError(ack, 'Bạn phải có 10 lá trước khi đánh.');
    const index = player.cards.findIndex((c) => c.id === cardId);
    if (index < 0) return ackError(ack, 'Không tìm thấy lá bài.');
    if (player.takenCards.includes(cardId)) return ackError(ack, 'Không thể đánh lại lá bài bạn đã ăn.');

    const [candidate] = player.cards.splice(index, 1);
    const requiredStillValid = player.takenCards.every((takenId) => {
      const takenCard = player.cards.find((c) => c.id === takenId);
      return takenCard && require('./game/phom').enumerateMelds(player.cards).some((meld) => meld.some((c) => c.id === takenId));
    });
    if (!requiredStillValid) {
      player.cards.splice(index, 0, candidate);
      return ackError(ack, 'Lá này đang giữ phỏm có bài đã ăn; không thể đánh làm vỡ phỏm.');
    }
    const card = candidate;
    room.discardPile.push(card);
    player.discardCount += 1;
    room.totalDiscards += 1;
    room.lastAction = `${player.name} đánh ${label(card)}.`;

    const solution = bestMeldSolution(player.cards);
    if (solution.deadwoodScore === 0) {
      player.laidDown = true;
      player.laydown = solution;
      finishGame(room, `${player.name} Ù!`);
    } else {
      advanceTurn(room);
    }

    ack?.({ ok: true });
    emitRoom(room);
  });

  socket.on('lay-down', (_payload, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ackError(ack, 'Bạn chưa ở trong phòng.');
    if (room.status !== 'playing' || currentPlayer(room)?.id !== player.id || room.phase !== 'discard') return ackError(ack, 'Bạn chỉ hạ phỏm sau khi đã bốc/ăn ở lượt của mình.');
    if (player.discardCount < 3) return ackError(ack, 'Bạn chỉ hạ phỏm ở vòng cuối.');
    const solution = bestMeldSolution(player.cards);
    if (!solution.melds.length) return ackError(ack, 'Hiện chưa có phỏm để hạ.');
    player.laidDown = true;
    player.laydown = solution;
    room.lastAction = `${player.name} đã hạ ${solution.melds.length} phỏm.`;
    ack?.({ ok: true });
    emitRoom(room);
  });

  socket.on('leave-room', (_payload, ack) => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player) return ack?.({ ok: true });
    if (room.status === 'playing') return ackError(ack, 'Đang trong ván; hãy dùng kết nối lại nếu bị rớt mạng.');
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.hostId === player.id && room.players.length) room.hostId = room.players[0].id;
    socket.leave(room.code);
    socket.data.roomCode = null;
    socket.data.playerId = null;
    if (!room.players.length) rooms.delete(room.code);
    else emitRoom(room);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const { room, player } = socketPlayer(socket);
    if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    room.lastAction = `${player.name} mất kết nối, giữ chỗ 5 phút.`;
    emitRoom(room);

    player.disconnectTimer = setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom || player.connected) return;
      if (currentRoom.status === 'waiting' || currentRoom.status === 'finished') {
        currentRoom.players = currentRoom.players.filter((p) => p.id !== player.id);
        if (currentRoom.hostId === player.id && currentRoom.players.length) currentRoom.hostId = currentRoom.players[0].id;
        if (!currentRoom.players.length) rooms.delete(currentRoom.code);
        else emitRoom(currentRoom);
      }
    }, DISCONNECT_TTL);
  });
});

function label(card) {
  const rank = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[card.rank] || card.rank;
  const suit = { S: '♠', H: '♥', D: '♦', C: '♣' }[card.suit];
  return `${rank}${suit}`;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > ROOM_TTL) rooms.delete(code);
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Phom Online running on http://0.0.0.0:${PORT}`);
});
