const socket = io({ reconnection: true, reconnectionAttempts: Infinity });

const $ = (id) => document.getElementById(id);
const els = {
  lobby: $('lobby'), game: $('game'), name: $('nameInput'), room: $('roomInput'),
  create: $('createBtn'), join: $('joinBtn'), lobbyError: $('lobbyError'), roomCode: $('roomCode'),
  connection: $('connection'), copy: $('copyBtn'), leave: $('leaveBtn'), start: $('startBtn'),
  draw: $('drawBtn'), take: $('takeBtn'), lay: $('layBtn'), discard: $('discardBtn'),
  hand: $('hand'), actionError: $('actionError'), deckCount: $('deckCount'), discardCard: $('discardCard'),
  notice: $('notice'), seatTop: $('seatTop'), seatLeft: $('seatLeft'), seatRight: $('seatRight'), seatMe: $('seatMe'),
  results: $('results'), resultReason: $('resultReason'), resultRows: $('resultRows'), playAgain: $('playAgainBtn')
};

let state = null;
let selectedCardId = null;
let currentRoom = localStorage.getItem('phomRoom') || '';
let token = localStorage.getItem('phomToken') || '';
let savedName = localStorage.getItem('phomName') || '';
els.name.value = savedName;
els.room.value = currentRoom;

const rankLabel = (rank) => ({1:'A',11:'J',12:'Q',13:'K'}[rank] || rank);
const suitLabel = (suit) => ({S:'♠',H:'♥',D:'♦',C:'♣'}[suit] || suit);
const cardText = (card) => card ? `${rankLabel(card.rank)}${suitLabel(card.suit)}` : '—';
const isRed = (card) => card && (card.suit === 'H' || card.suit === 'D');

function remember(name, code, nextToken) {
  if (name) localStorage.setItem('phomName', name);
  if (code) localStorage.setItem('phomRoom', code);
  if (nextToken) localStorage.setItem('phomToken', nextToken);
  currentRoom = code || currentRoom;
  token = nextToken || token;
}

function showLobby(error = '') {
  els.game.classList.add('hidden');
  els.lobby.classList.remove('hidden');
  els.lobbyError.textContent = error;
}

function showGame() {
  els.lobby.classList.add('hidden');
  els.game.classList.remove('hidden');
}

function invoke(event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('Server không phản hồi.'));
      if (!res?.ok) return reject(new Error(res?.error || 'Có lỗi xảy ra.'));
      resolve(res);
    });
  });
}

els.create.addEventListener('click', async () => {
  const name = els.name.value.trim();
  if (!name) return els.lobbyError.textContent = 'Hãy nhập tên của bạn.';
  try {
    els.lobbyError.textContent = '';
    const res = await invoke('create-room', { name, token: '' });
    remember(name, res.code, res.token);
    showGame();
  } catch (e) { els.lobbyError.textContent = e.message; }
});

els.join.addEventListener('click', async () => {
  const name = els.name.value.trim();
  const code = els.room.value.trim().toUpperCase();
  if (!name || !code) return els.lobbyError.textContent = 'Nhập tên và mã phòng.';
  try {
    els.lobbyError.textContent = '';
    const res = await invoke('join-room', { code, name, token: currentRoom === code ? token : '' });
    remember(name, res.code, res.token);
    showGame();
  } catch (e) { els.lobbyError.textContent = e.message; }
});

els.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state?.code || '');
    els.copy.textContent = 'Đã copy';
    setTimeout(() => els.copy.textContent = 'Copy mã', 1200);
  } catch {
    prompt('Copy mã phòng:', state?.code || '');
  }
});

els.leave.addEventListener('click', async () => {
  try {
    await invoke('leave-room');
    localStorage.removeItem('phomRoom');
    localStorage.removeItem('phomToken');
    currentRoom = ''; token = ''; state = null;
    showLobby();
  } catch (e) { els.actionError.textContent = e.message; }
});

els.start.addEventListener('click', async () => action(() => invoke('start-game')));
els.playAgain.addEventListener('click', async () => {
  els.results.classList.add('hidden');
  action(() => invoke('start-game'));
});
els.draw.addEventListener('click', async () => action(() => invoke('draw-card')));
els.take.addEventListener('click', async () => action(() => invoke('take-discard')));
els.lay.addEventListener('click', async () => action(() => invoke('lay-down')));
els.discard.addEventListener('click', async () => {
  if (!selectedCardId) return els.actionError.textContent = 'Chạm/click một lá bài trước.';
  await action(() => invoke('discard-card', { cardId: selectedCardId }));
});

async function action(fn) {
  els.actionError.textContent = '';
  try { await fn(); selectedCardId = null; }
  catch (e) { els.actionError.textContent = e.message; }
}

socket.on('connect', async () => {
  els.connection.textContent = '● Đã kết nối';
  els.connection.classList.remove('offline');
  if (currentRoom && token && !state) {
    const name = localStorage.getItem('phomName') || 'Người chơi';
    try {
      const res = await invoke('join-room', { code: currentRoom, name, token });
      remember(name, res.code, res.token);
      showGame();
    } catch {
      localStorage.removeItem('phomRoom');
      localStorage.removeItem('phomToken');
      currentRoom = ''; token = '';
    }
  }
});

socket.on('disconnect', () => {
  els.connection.textContent = '● Mất kết nối — đang nối lại';
  els.connection.classList.add('offline');
});

socket.on('state', (next) => {
  state = next;
  remember(next.me?.name, next.code, next.me?.token);
  showGame();
  render();
});

function render() {
  if (!state?.me) return;
  els.roomCode.textContent = state.code;
  els.deckCount.textContent = `Nọc: ${state.deckCount}`;
  els.notice.textContent = state.lastAction || '';
  renderDiscard();
  renderSeats();
  renderHand();
  renderActions();
  renderResults();
}

function renderDiscard() {
  const c = state.topDiscard;
  els.discardCard.textContent = cardText(c);
  els.discardCard.className = 'playing-card';
  if (!c) els.discardCard.classList.add('empty-card');
  if (isRed(c)) els.discardCard.classList.add('red');
}

function renderSeats() {
  const meIndex = state.players.findIndex((p) => p.id === state.me.id);
  const others = [];
  for (let offset = 1; offset < state.players.length; offset += 1) {
    others.push(state.players[(meIndex + offset) % state.players.length]);
  }

  const slots = state.players.length === 2
    ? [els.seatTop]
    : state.players.length === 3
      ? [els.seatLeft, els.seatRight]
      : [els.seatLeft, els.seatTop, els.seatRight];

  [els.seatTop, els.seatLeft, els.seatRight].forEach((e) => e.innerHTML = '');
  slots.forEach((slot, i) => { if (others[i]) slot.innerHTML = playerHtml(others[i]); });
  const me = state.players.find((p) => p.id === state.me.id);
  els.seatMe.innerHTML = playerHtml(me, true);
}

function playerHtml(p, me = false) {
  if (!p) return '';
  const current = state.currentPlayerId === p.id ? 'current' : '';
  const offline = p.connected ? '' : 'offline';
  const host = state.hostId === p.id ? ' 👑' : '';
  const melds = (p.melds || []).map((m) => `<div class="meld-mini">${m.map((c) => `<span class="mini-card ${isRed(c) ? 'red' : ''}">${cardText(c)}</span>`).join('')}</div>`).join('');
  return `<div class="player-name ${current} ${offline}">${escapeHtml(p.name)}${host}${me ? ' (Bạn)' : ''}</div><div class="card-count">🂠 ${p.cardCount} lá · vòng ${Math.min(p.discardCount + 1, 4)}/4</div>${melds}`;
}

function renderHand() {
  const stillExists = state.me.cards.some((c) => c.id === selectedCardId);
  if (!stillExists) selectedCardId = null;
  els.hand.innerHTML = '';
  for (const c of state.me.cards) {
    const div = document.createElement('div');
    div.className = `playing-card ${isRed(c) ? 'red' : ''} ${selectedCardId === c.id ? 'selected' : ''}`;
    div.textContent = cardText(c);
    div.dataset.id = c.id;
    div.addEventListener('click', () => {
      selectedCardId = selectedCardId === c.id ? null : c.id;
      renderHand();
      els.actionError.textContent = '';
    });
    div.addEventListener('dblclick', () => {
      selectedCardId = c.id;
      if (state.me.canDiscard) els.discard.click();
    });
    els.hand.appendChild(div);
  }
}

function renderActions() {
  const waiting = state.status === 'waiting';
  els.start.classList.toggle('hidden', !waiting || !state.me.isHost);
  els.draw.classList.toggle('hidden', waiting || state.status === 'finished');
  els.take.classList.toggle('hidden', waiting || state.status === 'finished');
  els.lay.classList.toggle('hidden', waiting || state.status === 'finished');
  els.discard.classList.toggle('hidden', waiting || state.status === 'finished');

  els.draw.disabled = !state.me.canDraw;
  els.take.disabled = !state.me.canTake;
  els.lay.disabled = !state.me.canLayDown;
  els.discard.disabled = !state.me.canDiscard;
  els.start.disabled = state.players.length < 2 || state.players.some((p) => !p.connected);
}

function renderResults() {
  if (state.status !== 'finished' || !state.results) {
    els.results.classList.add('hidden');
    return;
  }
  els.resultReason.textContent = state.results.reason;
  els.resultRows.innerHTML = state.results.rows.map((r) => {
    const medal = ['🥇','🥈','🥉','4️⃣'][r.rank - 1] || r.rank;
    const label = r.isU ? 'Ù' : r.isMom ? 'Móm' : `${r.score} điểm`;
    return `<div class="result-row"><div class="result-rank">${medal}</div><div>${escapeHtml(r.name)}</div><div class="result-score">${label}</div></div>`;
  }).join('');
  els.playAgain.classList.toggle('hidden', !state.me.isHost);
  els.results.classList.remove('hidden');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
