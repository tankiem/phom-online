const test = require('node:test');
const assert = require('node:assert/strict');
const { createDeck, bestMeldSolution, canTakeDiscard } = require('../game/phom');

const c = (rank, suit) => ({ rank, suit, id: `${rank}${suit}` });

test('deck has 52 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((x) => x.id)).size, 52);
});

test('finds a run and a set with zero deadwood', () => {
  const hand = [c(3,'S'),c(4,'S'),c(5,'S'),c(8,'H'),c(8,'D'),c(8,'C')];
  const result = bestMeldSolution(hand);
  assert.equal(result.deadwoodScore, 0);
  assert.equal(result.melds.length, 2);
});

test('can take discard only when it makes a meld', () => {
  const hand = [c(3,'S'), c(4,'S'), c(9,'D'), c(11,'C')];
  assert.equal(canTakeDiscard(hand, c(5,'S')), true);
  assert.equal(canTakeDiscard(hand, c(7,'H')), false);
});
