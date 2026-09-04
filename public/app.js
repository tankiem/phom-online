const socket = io({ reconnection: true, reconnectionAttempts: Infinity });

const $ = (id) => document.getElementById(id);
const els = {
  lobby: $('lobby'), game: $('game'), name: $('nameInput'), room: $('roomInput'),
  create: $('createBtn'), join: $('joinBtn'), lobbyError: $('lobbyError'), roomCode: $('roomCode'),
  connection: $('connection'), copy: $('copyBtn'), leave: $('leaveBtn'), start: $('startBtn'),
  draw: $('drawBtn'), take: $('takeBtn'), lay: $('layBtn'), discard: $('discardBtn'),
  hand: $('hand'), actionError: $('actionError'), deckCount: $('deckCount'), discardCard: $('discardCard'),
  notice: $('notice'), seatTop: $('seatTop'), seatLeft: $('seatLeft'), seatRight: $('seatRight'), seatMe: $('seatMe'),
  results: $('results'), resultReason: $('resultReason'), resultRows: $('resultRows'), playAgain: $('playAgainBtn'),
  sound: $('soundBtn'), scoreUnit: $('scoreUnitSelect'), scoreSetting: $('scoreSetting')
};

let state = null;
let selectedCardId = null;
let currentRoom = localStorage.getItem('phomRoom') || '';
let token = localStorage.getItem('phomToken') || '';
let savedName = localStorage.getItem('phomName') || '';
let soundEnabled = localStorage.getItem('phomSound') !== 'off';
let audioCtx = null;

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

function getAudioContext() {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, duration = 0.08, delay = 0, volume = 0.055, type = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noise(duration = 0.05, volume = 0.035) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

function playSound(kind, isMine = false) {
  if (!soundEnabled) return;
  if (kind === 'draw') { noise(0.045, 0.025); tone(260, 0.06, 0.015, 0.035, 'triangle'); }
  if (kind === 'discard') { noise(0.035, 0.05); tone(150, 0.05, 0, 0.035, 'square'); }
  if (kind === 'take') { tone(420, 0.08, 0, 0.045); tone(620, 0.1, 0.07, 0.045); }
  if (kind === 'laydown') { tone(360, 0.08, 0); tone(480, 0.08, 0.07); tone(600, 0.1, 0.14); }
  if (kind === 'start') { tone(330, 0.08, 0); tone(440, 0.08, 0.08); }
  if (kind === 'turn') { tone(700, 0.06, 0, 0.04); tone(880, 0.08, 0.07, 0.04); }
  if (kind === 'finish') {
    const notes = isMine ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((f, i) => tone(f, 0.14, i * 0.1, 0.05));
  }
}

function updateSoundButton() {
  els.sound.textContent = soundEnabled ? '🔊' : '🔇';
  els.sound.title = soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh';
}

function handleStateAudio(previous, next) {
  if (!previous || !next?.me) return;
  const event = next.lastEvent;
  if (event && event.seq !== previous.lastEvent?.seq) {
    if (['draw', 'discard', 'take', 'laydown', 'start'].includes(event.type)) {
      playSound(event.type, event.playerId === next.me.id);
    } else if (event.type === 'finish') {
      const mine = next.results?.rows?.find((r) => r.playerId === next.me.id);
      playSound('finish', mine?.rank === 1);
    }
  }
  if (previous.currentPlayerId !== next.currentPlayerId && next.currentPlayerId === next.me.id && next.status === 'playing') {
    setTimeout(() => playSound('turn', true), 120);
  }
}

document.addEventListener('pointerdown', () => getAudioContext(), { once: true });
updateSoundButton();

els.sound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('phomSound', soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) { getAudioContext(); playSound('turn', true); }
});

els.scoreUnit.addEventListener('change', async () => {
  try {
    await action(() => invoke('set-score-unit', { value: Number(els.scoreUnit.value) }));
  } catch (e) {
    els.actionError.textContent = e.message;
    if (state) els.scoreUnit.value = String(state.scoreUnit || 1);
  }
});

els.create.addEventListener('click', async () => {
  const name = els.name.value.trim();
  if (!name) return els.lobbyError.textContent = 'Hãy nhập tên của bạn.';
  try {
    els.lobbyError.textContent = '';
    getAudioContext();
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
    getAudioContext();
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
  const previous = state;
  state = next;
  remember(next.me?.name, next.code, next.me?.token);
  showGame();
  render();
  handleStateAudio(previous, next);
});

function render() {
  if (!state?.me) return;
  els.roomCode.textContent = state.code;
  els.deckCount.textContent = `Nọc: ${state.deckCount}`;
  els.notice.textContent = state.lastAction || '';
  els.scoreUnit.value = String(state.scoreUnit || 1);
  els.scoreUnit.disabled = !state.me.isHost || state.status === 'playing';
  els.scoreSetting.classList.toggle('host-setting', state.me.isHost);
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

function discardCardsHtml(cards = []) {
  if (!cards.length) return '<div class="player-discards empty-discards"><span>Chưa đánh</span></div>';
  return `<div class="player-discards" title="Các lá người chơi đã đánh và chưa bị ăn">${cards.map((c, i) => `<span class="discard-mini ${isRed(c) ? 'red' : ''} ${i === cards.length - 1 ? 'last' : ''}">${cardText(c)}</span>`).join('')}</div>`;
}

function playerHtml(p, me = false) {
  if (!p) return '';
  const current = state.currentPlayerId === p.id ? 'current' : '';
  const offline = p.connected ? '' : 'offline';
  const host = state.hostId === p.id ? ' 👑' : '';
  const melds = (p.melds || []).map((m) => `<div class="meld-mini">${m.map((c) => `<span class="mini-card ${isRed(c) ? 'red' : ''}">${cardText(c)}</span>`).join('')}</div>`).join('');
  const score = Number(p.matchPoints || 0);
  const scoreText = score > 0 ? `+${score}` : String(score);
  return `<div class="player-block"><div class="player-name ${current} ${offline}">${escapeHtml(p.name)}${host}${me ? ' (Bạn)' : ''}</div><div class="card-count">🂠 ${p.cardCount} lá · vòng ${Math.min(p.discardCount + 1, 4)}/4 · ⭐ ${scoreText}</div>${discardCardsHtml(p.discards)}${melds}</div>`;
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

function signedPoints(value) {
  const n = Number(value || 0);
  return n > 0 ? `+${n}` : String(n);
}

function renderResults() {
  if (state.status !== 'finished' || !state.results) {
    els.results.classList.add('hidden');
    return;
  }
  els.resultReason.textContent = `${state.results.reason} · Mức điểm ván: ${state.results.scoreUnit || state.scoreUnit}`;
  els.resultRows.innerHTML = state.results.rows.map((r) => {
    const medal = ['🥇','🥈','🥉','4️⃣'][r.rank - 1] || r.rank;
    const handLabel = r.isU ? 'Ù' : r.isMom ? `Móm · ${r.score} điểm bài` : `${r.score} điểm bài`;
    const deltaClass = Number(r.roundPoints) >= 0 ? 'gain' : 'loss';
    return `<div class="result-row"><div class="result-rank">${medal}</div><div class="result-player"><strong>${escapeHtml(r.name)}</strong><small>${handLabel}</small></div><div class="result-score"><span class="${deltaClass}">${signedPoints(r.roundPoints)}</span><small>Tổng ⭐ ${signedPoints(r.totalPoints)}</small></div></div>`;
  }).join('');
  els.playAgain.classList.toggle('hidden', !state.me.isHost);
  els.results.classList.remove('hidden');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
