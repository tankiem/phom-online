const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function cardId(card) {
  return `${card.rank}${card.suit}`;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit, rank, id: `${rank}${suit}` });
  }
  return deck;
}

function shuffle(input) {
  const deck = [...input];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardPoints(card) {
  return card.rank;
}

function sortCards(cards) {
  const order = { S: 0, H: 1, D: 2, C: 3 };
  return [...cards].sort((a, b) => a.rank - b.rank || order[a.suit] - order[b.suit]);
}

function combinations(arr, minSize = 3) {
  const out = [];
  const n = arr.length;
  for (let mask = 1; mask < (1 << n); mask += 1) {
    const group = [];
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) group.push(arr[i]);
    if (group.length >= minSize) out.push(group);
  }
  return out;
}

function isSet(group) {
  if (group.length < 3 || group.length > 4) return false;
  return group.every((c) => c.rank === group[0].rank) && new Set(group.map((c) => c.suit)).size === group.length;
}

function isRun(group) {
  if (group.length < 3) return false;
  const suit = group[0].suit;
  if (!group.every((c) => c.suit === suit)) return false;
  const ranks = [...new Set(group.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== group.length) return false;
  for (let i = 1; i < ranks.length; i += 1) if (ranks[i] !== ranks[i - 1] + 1) return false;
  return true;
}

function enumerateMelds(cards) {
  const melds = [];
  const byRank = new Map();
  const bySuit = new Map();

  for (const card of cards) {
    if (!byRank.has(card.rank)) byRank.set(card.rank, []);
    byRank.get(card.rank).push(card);
    if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
    bySuit.get(card.suit).push(card);
  }

  for (const group of byRank.values()) {
    if (group.length === 3) melds.push(group);
    if (group.length === 4) {
      melds.push(group);
      for (const combo of combinations(group, 3)) melds.push(combo);
    }
  }

  for (const suitCards of bySuit.values()) {
    const sorted = [...suitCards].sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 2; j < sorted.length; j += 1) {
        const group = sorted.slice(i, j + 1);
        if (isRun(group)) melds.push(group);
        else break;
      }
    }
  }

  const seen = new Set();
  return melds.filter((m) => {
    const key = m.map(cardId).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bestMeldSolution(cards) {
  const melds = enumerateMelds(cards);
  const byId = new Map(cards.map((c) => [cardId(c), c]));
  let best = { melds: [], deadwood: cards, deadwoodScore: cards.reduce((s, c) => s + cardPoints(c), 0) };

  function walk(index, used, chosen) {
    if (index >= melds.length) {
      const deadwood = cards.filter((c) => !used.has(cardId(c)));
      const score = deadwood.reduce((s, c) => s + cardPoints(c), 0);
      if (score < best.deadwoodScore || (score === best.deadwoodScore && chosen.length > best.melds.length)) {
        best = { melds: chosen.map((m) => [...m]), deadwood, deadwoodScore: score };
      }
      return;
    }

    walk(index + 1, used, chosen);

    const meld = melds[index];
    if (meld.every((c) => !used.has(cardId(c)))) {
      const nextUsed = new Set(used);
      meld.forEach((c) => nextUsed.add(cardId(c)));
      walk(index + 1, nextUsed, [...chosen, meld]);
    }
  }

  walk(0, new Set(), []);
  best.melds = best.melds.map((m) => m.map((c) => byId.get(cardId(c))));
  return best;
}

function canTakeDiscard(hand, discardCard) {
  const withCard = [...hand, discardCard];
  return enumerateMelds(withCard).some((meld) => meld.some((c) => cardId(c) === cardId(discardCard)));
}

function publicCard(card) {
  return card ? { id: card.id, suit: card.suit, rank: card.rank } : null;
}

module.exports = {
  SUITS,
  RANKS,
  cardId,
  createDeck,
  shuffle,
  cardPoints,
  sortCards,
  isSet,
  isRun,
  enumerateMelds,
  bestMeldSolution,
  canTakeDiscard,
  publicCard
};
