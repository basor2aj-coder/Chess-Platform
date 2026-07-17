const { test } = require('node:test');
const assert = require('node:assert/strict');
const { containsProfanity } = require('../public/js/profanity.js');

test('flags a standalone blocked word', () => {
  assert.equal(containsProfanity('this is shit'), true);
});

test('does not flag an innocent word containing a blocked substring', () => {
  assert.equal(containsProfanity('Scunthorpe'), false);
  assert.equal(containsProfanity('Cassidy'), false);
});

test('is case-insensitive', () => {
  assert.equal(containsProfanity('SHIT'), true);
});

test('ignores empty or missing input', () => {
  assert.equal(containsProfanity(''), false);
  assert.equal(containsProfanity(undefined), false);
});

test('allows a clean name and catchphrase', () => {
  assert.equal(containsProfanity('Grandpa Joe'), false);
  assert.equal(containsProfanity("Let's have some fun!"), false);
});
