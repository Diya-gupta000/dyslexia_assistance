const test = require('node:test');
const assert = require('node:assert/strict');
const Numbers = require('../numbers-domain.js');

test('median handles odd and even sets without mutating input', () => {
  const values = [7, 1, 4, 2];
  assert.equal(Numbers.median(values), 3);
  assert.deepEqual(values, [7, 1, 4, 2]);
});

test('profile combines correctness and latency but weights correctness most', () => {
  const profile = Numbers.buildProfile([
    { skill:'dot', correct:true, reactionTime:1000 },
    { skill:'dot', correct:true, reactionTime:1300 },
    { skill:'dot', correct:true, reactionTime:1600 },
    { skill:'symbolic', correct:false, reactionTime:500 },
    { skill:'symbolic', correct:false, reactionTime:600 },
    { skill:'symbolic', correct:true, reactionTime:700 }
  ]);
  assert.ok(profile.dot.score > profile.symbolic.score);
  assert.equal(profile.dot.observation, 'Strong');
  assert.equal(profile.symbolic.observation, 'Needs practice');
});

test('number-line score is based on error relative to the displayed range', () => {
  const profile = Numbers.buildProfile([
    { skill:'numberLine', min:0, max:10, absoluteError:0.4, reactionTime:1800 },
    { skill:'numberLine', min:0, max:20, absoluteError:1, reactionTime:2000 },
    { skill:'numberLine', min:0, max:100, absoluteError:4, reactionTime:2200 }
  ]);
  assert.ok(profile.numberLine.score >= 90);
  assert.ok(profile.numberLine.meanAbsoluteError <= 5);
});

test('recommendation targets the lowest relative skill with an explainable game', () => {
  const profile = Numbers.demoSessions().at(-1).profile;
  profile.mapping.score = 35;
  const recommendation = Numbers.recommendActivity(profile);
  assert.equal(recommendation.targetSkill, 'mapping');
  assert.equal(recommendation.id, 'quantity-battle');
  assert.match(recommendation.reason, /dots, numerals/i);
});

test('pattern summary names both a strength and a focus area', () => {
  const profile = Numbers.demoSessions().at(-1).profile;
  const summary = Numbers.patternSummary(profile);
  assert.notEqual(summary.strongest, summary.focus);
  assert.match(summary.text, /practice will begin/i);
});

test('practice level adapts from the most recent result and learner feedback', () => {
  assert.equal(Numbers.nextPracticeLevel([], 'number-line'), 1);
  assert.equal(Numbers.nextPracticeLevel([{game:'number-line', level:1, score:84}], 'number-line'), 2);
  assert.equal(Numbers.nextPracticeLevel([{game:'number-line', level:2, score:70, fit:'too-hard'}], 'number-line'), 1);
  assert.equal(Numbers.nextPracticeLevel([{game:'number-line', level:2, score:100, fit:'too-hard'}], 'number-line'), 1);
  assert.equal(Numbers.nextPracticeLevel([{game:'number-line', level:3, score:98}], 'number-line'), 3);
});

test('game plans increase the range and preserve five scored rounds', () => {
  const first = Numbers.gamePlan('number-line', 1);
  const third = Numbers.gamePlan('number-line', 3);
  assert.equal(first.rounds.length, 5);
  assert.equal(third.rounds.length, 5);
  assert.ok(Math.max(...third.rounds.map(round => round.max)) > Math.max(...first.rounds.map(round => round.max)));
  assert.deepEqual(Numbers.gamePlan('number-trail', 2), {level:2, goal:20, spinnerMax:4});
});

test('profile comparison reports overall and per-skill change', () => {
  const sessions = Numbers.demoSessions();
  const comparison = Numbers.compareProfiles(sessions[0].profile, sessions[2].profile);
  assert.ok(comparison.overall > 0);
  assert.ok(comparison.skills.mapping > 0);
});
