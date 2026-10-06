(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SecondLookNumbers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  var SKILLS = {
    dot: {
      label: 'Quantity recognition',
      short: 'Dot sense',
      description: 'Quickly noticing how many objects are in a small group.'
    },
    symbolic: {
      label: 'Symbolic magnitude',
      short: 'Number size',
      description: 'Understanding which written numeral represents the larger amount.'
    },
    mapping: {
      label: 'Quantity ↔ numeral mapping',
      short: 'Dots & digits',
      description: 'Connecting a visual quantity with the numeral that represents it.'
    },
    numberLine: {
      label: 'Number-line estimation',
      short: 'Number line',
      description: 'Placing a number within a spatial range.'
    }
  };

  var GAME_BY_SKILL = {
    dot: 'quantity-battle',
    symbolic: 'number-trail',
    mapping: 'quantity-battle',
    numberLine: 'number-line'
  };

  var GAME_META = {
    'number-trail': {
      name: 'Number Trail',
      skill: 'symbolic',
      reason: 'A linear number board links spoken counting, written numerals, and distance as the learner moves one space at a time.'
    },
    'number-line': {
      name: 'Number Line Adventure',
      skill: 'numberLine',
      reason: 'Repeated placement practice makes the spatial distance between numbers visible and gradually expands the range.'
    },
    'quantity-battle': {
      name: 'Quantity Battle',
      skill: 'mapping',
      reason: 'Comparing dots, numerals, and mixed pairs strengthens the connection between a symbol and the quantity it represents.'
    }
  };

  function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }

  function median(values){
    if (!values || !values.length) return 0;
    var sorted = values.slice().sort(function(a,b){ return a-b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  }

  function observation(score){
    if (score >= 82) return 'Strong';
    if (score >= 60) return 'Developing';
    return 'Needs practice';
  }

  function scoreAccuracyTrials(trials){
    if (!trials.length) return { score: 0, accuracy: 0, medianReactionTime: 0, trials: 0 };
    var correct = trials.filter(function(t){ return !!t.correct; }).length;
    var accuracy = correct / trials.length;
    var reactionTimes = trials.map(function(t){ return Number(t.reactionTime) || 0; }).filter(Boolean);
    var rt = median(reactionTimes);
    // Speed adds useful resolution but can never outweigh correctness. Responses at or
    // below 1.3 s get all speed points; responses at 4 s or above get none.
    var speed = rt ? clamp((4000 - rt) / 2700, 0, 1) : 0;
    return {
      score: Math.round((accuracy * 0.8 + speed * 0.2) * 100),
      accuracy: Math.round(accuracy * 100),
      medianReactionTime: Math.round(rt),
      trials: trials.length
    };
  }

  function scoreNumberLine(trials){
    if (!trials.length) return { score: 0, accuracy: 0, medianReactionTime: 0, meanAbsoluteError: 0, trials: 0 };
    var normalizedErrors = trials.map(function(t){
      var range = Math.max(1, (Number(t.max) || 10) - (Number(t.min) || 0));
      return clamp((Number(t.absoluteError) || 0) / range, 0, 1);
    });
    var meanError = normalizedErrors.reduce(function(sum,n){ return sum+n; },0) / normalizedErrors.length;
    var close = normalizedErrors.filter(function(n){ return n <= 0.12; }).length / normalizedErrors.length;
    var rt = median(trials.map(function(t){ return Number(t.reactionTime) || 0; }).filter(Boolean));
    return {
      score: Math.round(clamp((1 - meanError) * 0.75 + close * 0.25, 0, 1) * 100),
      accuracy: Math.round(close * 100),
      medianReactionTime: Math.round(rt),
      meanAbsoluteError: Math.round(meanError * 1000) / 10,
      trials: trials.length
    };
  }

  function buildProfile(results){
    results = Array.isArray(results) ? results : [];
    var profile = {};
    Object.keys(SKILLS).forEach(function(key){
      var trials = results.filter(function(r){ return r.skill === key; });
      var metrics = key === 'numberLine' ? scoreNumberLine(trials) : scoreAccuracyTrials(trials);
      profile[key] = Object.assign({}, SKILLS[key], metrics, { observation: observation(metrics.score) });
    });
    return profile;
  }

  function weakestSkill(profile){
    var keys = Object.keys(SKILLS);
    return keys.reduce(function(lowest, key){
      if (!profile[key]) return lowest;
      return !lowest || profile[key].score < profile[lowest].score ? key : lowest;
    }, null);
  }

  function recommendActivity(profile){
    var skill = weakestSkill(profile) || 'mapping';
    var gameId = GAME_BY_SKILL[skill];
    return Object.assign({ id: gameId, targetSkill: skill, skillLabel: SKILLS[skill].label }, GAME_META[gameId]);
  }

  function overallScore(profile){
    var values = Object.keys(SKILLS).map(function(key){ return profile[key] ? profile[key].score : 0; });
    return values.length ? Math.round(values.reduce(function(a,b){ return a+b; },0) / values.length) : 0;
  }

  function patternSummary(profile){
    var ranked = Object.keys(SKILLS).sort(function(a,b){ return profile[b].score - profile[a].score; });
    var strongest = ranked[0], focus = ranked[ranked.length-1];
    return {
      strongest: strongest,
      focus: focus,
      text: 'The learner was most comfortable with ' + SKILLS[strongest].label.toLowerCase() +
        '. ' + SKILLS[focus].label + ' took more time or included more errors, so practice will begin there.'
    };
  }

  function demoSessions(){
    var date = new Date();
    function ago(days){ var d = new Date(date); d.setDate(d.getDate()-days); return d.toISOString(); }
    return [
      { id:'demo-1', date:ago(21), demo:true, profile:demoProfile([72,51,47,78]) },
      { id:'demo-2', date:ago(10), demo:true, profile:demoProfile([78,61,58,82]) },
      { id:'demo-3', date:ago(0), demo:true, profile:demoProfile([84,70,67,87]) }
    ];
  }

  function demoProfile(scores){
    var profile = {};
    Object.keys(SKILLS).forEach(function(key,index){
      var score = scores[index];
      profile[key] = Object.assign({}, SKILLS[key], {
        score: score,
        accuracy: Math.max(40, score-4),
        medianReactionTime: Math.max(950, 2900-score*18),
        meanAbsoluteError: key === 'numberLine' ? Math.max(3, 20-score*.17) : undefined,
        trials: 4,
        observation: observation(score)
      });
    });
    return profile;
  }

  return {
    SKILLS: SKILLS,
    GAME_META: GAME_META,
    median: median,
    observation: observation,
    buildProfile: buildProfile,
    weakestSkill: weakestSkill,
    recommendActivity: recommendActivity,
    overallScore: overallScore,
    patternSummary: patternSummary,
    demoSessions: demoSessions
  };
});
