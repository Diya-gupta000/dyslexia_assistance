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
