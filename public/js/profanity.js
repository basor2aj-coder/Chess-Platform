// A lightweight, word-boundary based profanity filter for the name/catchphrase
// fields. It intentionally only matches whole words (not substrings), so it
// won't flag things like "Cassidy" or "Scunthorpe" — it catches the word
// typed on its own, not embedded inside an unrelated word.
//
// This list is deliberately a common/standard set, not exhaustive. It's meant
// as a reasonable deterrent for a family game, not a bulletproof moderation
// system — someone determined to be crude can still get creative with
// spacing or spelling.

const PROFANITY_BLOCKLIST = [
  'fuck', 'fucker', 'fucking', 'motherfucker',
  'shit', 'bullshit', 'shithead',
  'bitch', 'son of a bitch',
  'asshole', 'ass', 'jackass', 'dumbass', 'asswipe',
  'bastard',
  'damn', 'goddamn',
  'piss', 'pissed',
  'dick', 'dickhead', 'cock',
  'pussy', 'cunt', 'twat',
  'slut', 'whore',
  'fag', 'faggot',
  'nigger', 'nigga',
  'retard', 'retarded',
  'rape', 'rapist',
  'porn', 'pornography',
  'boob', 'boobs', 'tit', 'tits',
  'penis', 'vagina',
  'blowjob', 'handjob', 'cum', 'wank', 'wanker',
  'douche', 'douchebag',
  'dipshit', 'crap',
];

function containsProfanity(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return PROFANITY_BLOCKLIST.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + escaped + '\\b', 'i').test(lower);
  });
}

// Expose for the browser (game.js) and for Node (server.js) alike.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROFANITY_BLOCKLIST, containsProfanity };
} else {
  window.containsProfanity = containsProfanity;
}
