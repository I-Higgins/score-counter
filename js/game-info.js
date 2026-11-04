// How to play the built-in games: short, in our own words, enough to start or
// remind people offline. The Wikipedia link is the only web address in the app:
// a plain link the person taps (it opens in Safari), never fetched by the app.
// Games point here with `about` (see PRESETS in model.js).

export const WIKI = 'https://en.wikipedia.org/wiki/';

const SUITS = [['♠', 'Spades'], ['♣', 'Clubs'], ['♦', 'Diamonds'], ['♥', 'Hearts']];

export const INFO = {
  'preset-5-crowns': {
    wiki: 'Five_Crowns_(game)',
    intro: 'A rummy-style game with five suits, over 11 rounds. 2 to 7 players.',
    start: [
      'Round 1 deals 3 cards each. Each round deals one more, up to 13.',
      'The wild card changes every round: 3s in the 3-card round, up to Kings in the 13-card round. Jokers are always wild.',
      'On your turn, take the top card of the deck or the discard pile, then discard one.',
      'Go out when all your cards are in books (3 or more of a kind) or runs (3 or more in a row, same suit). Everyone else gets one more turn.',
    ],
    scoring: [
      'Cards you can’t lay down count against you: their number, Jacks 11, Queens 12, Kings 13.',
      'Wild cards left in your hand: 20 each. Jokers: 50 each.',
      'Lowest total after the last round wins.',
    ],
  },
  'preset-dutch-blitz': {
    wiki: 'Dutch_Blitz',
    intro: 'A fast game where everyone plays at once, each with their own deck. 2 to 4 players (more with an expansion pack).',
    start: [
      'Deal yourself a Blitz pile of 10 cards, and 3 cards face up beside it (your Post piles). Hold the rest.',
      'Everyone plays at the same time. Start piles in the middle with a 1, then build each one up to 10 in the same colour.',
      'Turn over your hand 3 cards at a time and play the top card where it fits.',
      'Empty your Blitz pile and call “Blitz!” to end the hand.',
    ],
    scoring: [
      '+1 for each of your cards in the middle piles.',
      '−2 for each card still in your Blitz pile.',
      'Many groups play to 75: change the target in Edit if you like.',
    ],
  },
  'preset-phase-10': {
    wiki: 'Phase_10',
    intro: 'A rummy-style game where everyone works through 10 phases in order. 2 to 6 players, with the Phase 10 deck.',
    start: [
      'Deal 10 cards each. On your turn, take the top card of the deck or the discard pile, then discard one.',
      'Once you have your whole phase in your hand, lay it down. After that you can add cards to any laid-down group.',
      'The hand ends when someone has no cards left.',
      'Made your phase this hand? Next hand you start the next one. Missed it? Try the same phase again.',
      'In this app, tick “Made phase” for each player who made it when you save the hand.',
    ],
    scoring: [
      'Cards left in your hand: 1 to 9 are 5 points, 10 to 12 are 10, Skips 15, Wilds 25.',
      'Whoever went out scores 0.',
      'The game ends after the hand where someone finishes phase 10. Whoever has finished the most phases wins. A tie goes to the lowest score.',
    ],
    phases: [
      '2 sets of 3',
      '1 set of 3 + 1 run of 4',
      '1 set of 4 + 1 run of 4',
      '1 run of 7',
      '1 run of 8',
      '1 run of 9',
      '2 sets of 4',
      '7 cards of one colour',
      '1 set of 5 + 1 set of 2',
      '1 set of 5 + 1 set of 3',
    ],
    phasesNote: 'A set is cards of the same number. A run is cards in a row. Wilds can fill any gap.',
  },
  'preset-skip-bo': {
    wiki: 'Skip-Bo',
    intro: 'Build piles from 1 to 12 in the middle, and be first to empty your stockpile. 2 to 6 players, with the Skip-Bo deck.',
    start: [
      'Deal each player a stockpile: 30 cards with 2 to 4 players, 20 with 5 or more. Turn the top card face up.',
      'At the start of your turn, draw until you hold 5 cards.',
      'Start piles in the middle with a 1, then build up in order to 12. Skip-Bo cards are wild.',
      'Play from your hand, the top of your stockpile, or your 4 discard piles. End your turn by putting a card on one of your discard piles.',
      'A pile that reaches 12 is shuffled back into the deck.',
      'The first to empty their stockpile wins the hand.',
    ],
    scoring: [
      'The hand winner scores 25, plus 5 for each card left in everyone else’s stockpiles.',
      'Everyone else scores 0 that hand.',
      'First to 500 wins. For a shorter game, lower the target in Edit.',
    ],
  },
  'preset-uno': {
    wiki: 'Uno_(card_game)',
    intro: 'Match the top card by colour or number, and be first to empty your hand. 2 to 10 players, with the Uno deck.',
    start: [
      'Deal 7 cards each. Turn over the top card of the deck to start the discard pile.',
      'On your turn, play a card that matches the top card’s colour, number or symbol, or play a Wild. If you can’t, draw one.',
      'Skip, Reverse and Draw Two affect the next player. A Wild picks the colour. Wild Draw Four also makes the next player draw 4.',
      'Say “Uno” when you’re down to one card. If someone catches you first, draw 2.',
      'The first to empty their hand wins the hand.',
    ],
    scoring: [
      'The hand winner scores the cards left in everyone else’s hands.',
      'Number cards: their number. Skip, Reverse and Draw Two: 20 each. Wild and Wild Draw Four: 50 each.',
      'First to 500 wins.',
    ],
  },
  'preset-500': {
    wiki: '500_(card_game)',
    intro: 'Australia’s favourite trick-taking game: bid how many tricks your team will win. Usually 4 players in 2 teams, with a 43-card deck (red 4s and up, black 5s and up, and a Joker).',
    start: [
      'Add each team as a player.',
      'Deal 10 cards each, and 3 face down for the kitty.',
      'Take turns to bid the number of tricks (6 to 10) your team will win, and a trump suit or no trumps. Each bid must be worth more than the last, or pass.',
      'The highest bidder picks up the kitty, then discards 3 cards.',
      'In a trump suit, the Joker is highest, then the Jack of trumps, then the other Jack of the same colour.',
      'Misère: bid to win no tricks at all, playing alone. Open misère: the same, with your cards face up.',
    ],
    scoring: [
      'The bidding team scores the bid’s value if they make it, and loses it if they don’t.',
      'The other team scores 10 for each trick they win.',
      'Winning all 10 tricks scores at least 250.',
      'Reach 500 to win (most groups say only by making a bid). Drop to −500 and you lose.',
    ],
    table: {
      caption: 'What each bid is worth',
      head: ['Tricks', ...SUITS, ['NT', 'No trumps']],
      rows: [6, 7, 8, 9, 10].map((n) => [String(n), ...[40, 60, 80, 100, 120].map((v) => String(v + (n - 6) * 100))]),
      foot: 'Misère is worth 250. Open misère is worth 500.',
    },
  },
  'preset-president': {
    wiki: 'President_(card_game)',
    intro: 'Be first to get rid of your cards. The order you finish in decides who’s President and who’s Scum next hand. Best with 4 to 8 players. Also called Scum, Arsehole or Bum.',
    start: [
      'Deal out the whole deck. Jokers in, if you like.',
      'Cards rank from 3 (lowest) up to Ace, then 2. Jokers, if used, beat everything.',
      'The leader plays a single card, or a pair, three or four of a kind. Each next player plays the same number of cards of a higher rank, or passes.',
      'When everyone passes, the last player to play clears the pile and leads again.',
      'First out is President, last out is Scum. Next hand they swap cards: in many groups Scum hands over their best card and gets back any card President chooses.',
    ],
    scoring: [
      'Score each hand by the order players went out. First out gets 1 point for each other player, then 1 less each place, down to 0 for Scum. With 5 players: 4, 3, 2, 1, 0.',
      'Tap a player’s score as they go out to add their points with the quick buttons, or type them all in at End hand.',
      'The game goes on until you stop. Use Finish game in the menu to crown the winner.',
    ],
  },
  'preset-fishbowl': {
    wiki: 'Celebrity_(game)',
    intro: 'A team guessing game in 3 rounds, with the same bowl of names each round. 4 or more players in 2 or more teams. Also called Salad Bowl, Celebrity or The Hat Game.',
    start: [
      'Add each team as a player.',
      'Everyone writes a few names (people, places, things) on slips of paper and puts them in a bowl.',
      'Teams take turns. One player has a set time (often 1 minute) to get their team to guess as many slips as they can.',
      'Round 1, Describe it: say anything except the words on the slip.',
      'Round 2, One word: just one word for each slip.',
      'Round 3, Act it out: no words at all.',
      'A round ends when the bowl is empty. Put every slip back for the next round.',
    ],
    scoring: [
      '+1 for each slip your team guesses: tap + on your team during the turn.',
      'Most points after round 3 wins.',
    ],
  },
};

/** How to play this game, if the app knows it (built-ins and their copies). */
export function infoFor(game) {
  return (game && (INFO[game.about] || INFO[game.id])) || null;
}

/** "1 set of 4 + 1 run of 4" for Phase 10's phase n, or ''. */
export function phaseText(game, n) {
  const info = infoFor(game);
  return (info && info.phases && game.phases === info.phases.length && info.phases[n - 1]) || '';
}

export const wikiUrl = (info) => WIKI + info.wiki;
