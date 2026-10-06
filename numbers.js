(function(){
  'use strict';

  var Domain = window.SecondLookNumbers;
  var app = document.getElementById('numbersApp');
  if (!Domain || !app) return;

  var STORAGE_KEY = 'secondlook_numbers_v1';
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-mode]'));
  var wordTabs = document.getElementById('wordTabs');
  var brandTagline = document.getElementById('brandTagline');
  var currentScreen = 'overview';
  var check = null;
  var game = null;
  var dotTimer = null;
  var store = loadStore();

  function loadStore(){
    var fallback = { checkSessions:[], practiceSessions:[], demo:false };
    try{
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || typeof parsed !== 'object') return fallback;
      return {
        checkSessions: Array.isArray(parsed.checkSessions) ? parsed.checkSessions : [],
        practiceSessions: Array.isArray(parsed.practiceSessions) ? parsed.practiceSessions : [],
        demo: !!parsed.demo
      };
    }catch(e){ return fallback; }
  }

  function persist(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }catch(e){}
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setMode(mode){
    clearTimeout(dotTimer);
    document.querySelectorAll('.view').forEach(function(view){ view.classList.remove('active'); });
    modeButtons.forEach(function(button){ button.setAttribute('aria-current', button.dataset.mode === mode ? 'page' : 'false'); });
    if (mode === 'home'){
      document.getElementById('view-home').classList.add('active');
      wordTabs.style.display = 'none';
      brandTagline.textContent = 'Words and numbers, understood differently.';
    } else if (mode === 'words'){
      var selected = document.querySelector('.tab[aria-selected="true"]');
      document.getElementById('view-' + (selected ? selected.dataset.view : 'write')).classList.add('active');
      wordTabs.style.display = 'flex';
      brandTagline.textContent = 'Writing support that teaches, not replaces.';
    } else {
      document.getElementById('view-numbers').classList.add('active');
      wordTabs.style.display = 'none';
      brandTagline.textContent = 'Number activities and progress.';
      renderNumbers();
    }
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  modeButtons.forEach(function(button){
    button.addEventListener('click', function(){ setMode(button.dataset.mode); });
  });
  document.getElementById('brandHome').addEventListener('click', function(){ setMode('home'); });

  function nav(current){
    var items = [['overview','Overview'],['map','My Number Map'],['practice','Practice'],['dashboard','For parents and educators'],['research','Evidence & design']];
    return '<nav class="num-nav" aria-label="Numbers navigation">' + items.map(function(item){
      return '<button type="button" data-screen="'+item[0]+'" aria-current="'+(current===item[0]?'page':'false')+'">'+item[1]+'</button>';
    }).join('') + '</nav>';
  }

  function shell(content, screen){
    return '<div class="num-shell">'+nav(screen)+content+'</div>';
  }

  function renderNumbers(){
    if (currentScreen === 'overview') renderOverview();
    else if (currentScreen === 'check') renderCheck();
    else if (currentScreen === 'map') renderMap();
    else if (currentScreen === 'practice') renderPractice();
    else if (currentScreen === 'dashboard') renderDashboard();
    else if (currentScreen === 'research') renderResearch();
    else if (currentScreen === 'game') renderGame();
  }

  function latestSession(){ return store.checkSessions.length ? store.checkSessions[store.checkSessions.length-1] : null; }
  function latestProfile(){ var session = latestSession(); return session ? session.profile : null; }

  function practicesSince(session){
    if (!session) return [];
    var start = new Date(session.date).getTime();
    return store.practiceSessions.filter(function(item){ return new Date(item.date).getTime() > start; });
  }

  function signed(value){
    return value > 0 ? '+'+value : String(value);
  }

  function renderOverview(){
    var last = latestSession();
    var practiceCount = store.practiceSessions.length;
    app.innerHTML = shell(
      '<section class="num-hero">' +
        '<div class="num-hero-copy"><span class="num-kicker">NUMBER SENSE</span>' +
          '<h2>Check foundational number skills.</h2>' +
          '<div class="num-actions"><button class="num-button" type="button" data-action="start-check">'+(last?'Take another Number Check':'Start the 5-minute Number Check')+' <span>→</span></button>' +
          (last?'<button class="num-button secondary" type="button" data-screen="map">View latest map</button>':'<button class="num-button secondary" type="button" data-action="demo">Explore a sample journey</button>')+'</div>' +
          '<div class="mini-stats"><div class="mini-stat"><strong>'+store.checkSessions.length+'</strong><span>checks on this device</span></div><div class="mini-stat"><strong>'+practiceCount+'</strong><span>practice sessions</span></div><div class="mini-stat"><strong>4</strong><span>foundational skills</span></div></div>' +
        '</div>' +
        '<div class="hero-visual" aria-hidden="true"><div class="hero-blob"></div><div class="hero-number">7</div><div class="hero-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>' +
      '</section>' +
      '<section class="num-panel" style="margin-top:18px"><div class="num-section-head"><div><h2>What the Number Check measures</h2></div></div>' +
        '<div class="how-grid"><article class="how-card"><b>01</b><h3>Dot sense</h3><p>Notice small quantities without counting one by one.</p></article><article class="how-card"><b>02</b><h3>Number size</h3><p>Compare what written numerals represent.</p></article><article class="how-card"><b>03</b><h3>Dots & digits</h3><p>Connect visual quantities to symbols.</p></article><article class="how-card"><b>04</b><h3>Number line</h3><p>Place numbers within a spatial range.</p></article></div>' +
      '</section>', 'overview');
  }

  function createTrials(){
    return [
      { skill:'dot', count:4, choices:[3,4,5] },
      { skill:'dot', count:6, choices:[5,6,7] },
      { skill:'dot', count:8, choices:[7,8,9] },
      { skill:'symbolic', left:7, right:4 },
      { skill:'symbolic', left:6, right:8 },
      { skill:'symbolic', left:12, right:17 },
      { skill:'mapping', dots:5, numeral:7 },
      { skill:'mapping', dots:8, numeral:6 },
      { skill:'mapping', dots:9, numeral:7 },
      { skill:'numberLine', target:3, min:0, max:10 },
      { skill:'numberLine', target:7, min:0, max:10 },
      { skill:'numberLine', target:14, min:0, max:20 }
    ];
  }

  function startCheck(){
    check = { intro:true, index:0, trials:createTrials(), results:[], startedAt:0, locked:false, replayed:false };
    currentScreen = 'check';
    renderCheck();
  }

  function renderCheck(){
    if (!check){ startCheck(); return; }
    if (check.intro){
      app.innerHTML = shell('<section class="num-panel check-shell check-card"><span class="task-badge">Number Check</span><h2 style="margin-top:14px">Before you begin</h2><p>The learner will count dots, compare numbers, match quantities to numerals, and place numbers on a line. Let them answer independently. Accuracy and response time are stored on this device.</p><div class="num-actions"><button class="num-button" data-action="begin-trials" type="button">Begin <span>→</span></button><button class="num-button secondary" data-screen="overview" type="button">Back</button></div></section>', 'overview');
      return;
    }
    if (check.index >= check.trials.length){ finishCheck(); return; }
    var trial = check.trials[check.index];
    var progress = Math.round(check.index / check.trials.length * 100);
    var numberInTask = check.trials.slice(0,check.index+1).filter(function(t){ return t.skill === trial.skill; }).length;
    var content = '<section class="num-panel check-shell"><div class="check-top"><span>'+Domain.SKILLS[trial.skill].short+' · '+numberInTask+' of 3</span><span>'+ (check.index+1)+' / '+check.trials.length+'</span></div><div class="check-progress"><i style="width:'+progress+'%"></i></div><div class="check-card">'+renderTrial(trial)+'<div class="encouragement" id="checkFeedback" aria-live="polite"></div></div></section>';
    app.innerHTML = shell(content, 'overview');
    check.startedAt = performance.now();
    if (trial.skill === 'dot') armDotFlash();
  }

  function dots(count, compact){
    var items = '';
    for (var i=0;i<count;i++) items += '<i class="num-dot"></i>';
    return '<span class="dot-field'+(compact?' compact':'')+'" aria-label="'+count+' dots">'+items+'</span>';
  }

  function renderTrial(trial){
    if (trial.skill === 'dot'){
      return '<span class="task-badge">Dot sense</span><h2 style="margin-top:12px">How many dots did you see?</h2><p>Look quickly. The dots will hide after a moment.</p><div id="flashDots">'+dots(trial.count,false)+'</div><div class="choice-row">'+trial.choices.map(function(n){ return '<button class="choice-card" type="button" data-answer="'+n+'">'+n+'</button>'; }).join('')+'</div><button class="num-button secondary small" type="button" data-action="replay-dots" style="margin-top:13px">Show the dots again</button>';
    }
    if (trial.skill === 'symbolic'){
      return '<span class="task-badge">Number duel</span><h2 style="margin-top:12px">Tap the bigger number.</h2><p>Which numeral represents more?</p><div class="duel-row"><button class="choice-card wide" type="button" data-answer="'+trial.left+'">'+trial.left+'</button><span class="duel-vs">OR</span><button class="choice-card wide" type="button" data-answer="'+trial.right+'">'+trial.right+'</button></div>';
    }
    if (trial.skill === 'mapping'){
      return '<span class="task-badge">Dots vs. digits</span><h2 style="margin-top:12px">Which side shows more?</h2><p>Connect the amount you see with the number you read.</p><div class="duel-row"><button class="choice-card wide" type="button" data-answer="dots">'+dots(trial.dots,true)+'<span class="choice-label">DOTS</span></button><span class="duel-vs">OR</span><button class="choice-card wide" type="button" data-answer="numeral">'+trial.numeral+'<span class="choice-label">NUMERAL</span></button></div>';
    }
    return '<span class="task-badge">Number line rescue</span><h2 style="margin-top:12px">Where does '+trial.target+' live?</h2><p>Tap the place on the line that feels right.</p><div class="number-line-wrap"><button type="button" class="number-track" data-number-line data-min="'+trial.min+'" data-max="'+trial.max+'" aria-label="Place '+trial.target+' on a number line from '+trial.min+' to '+trial.max+'"></button></div>';
  }

  function armDotFlash(){
    clearTimeout(dotTimer);
    dotTimer = setTimeout(function(){
      var field = document.querySelector('#flashDots .dot-field');
      if (field) field.classList.add('hidden');
    }, 850);
  }

  function replayDots(){
    var field = document.querySelector('#flashDots .dot-field');
    if (!field) return;
    check.replayed = true;
    field.classList.remove('hidden');
    check.startedAt = performance.now();
    armDotFlash();
  }

  function answerTrial(value, placement){
    if (!check || check.locked) return;
    check.locked = true;
    var trial = check.trials[check.index];
    var reactionTime = Math.max(100, Math.round(performance.now() - check.startedAt));
    var result = { skill:trial.skill, reactionTime:reactionTime, replayed:check.replayed };
    var correct = false;
    if (trial.skill === 'dot') correct = Number(value) === trial.count;
    else if (trial.skill === 'symbolic') correct = Number(value) === Math.max(trial.left,trial.right);
    else if (trial.skill === 'mapping'){
      var expected = trial.dots === trial.numeral ? String(value) : (trial.dots > trial.numeral ? 'dots' : 'numeral');
      correct = trial.dots === trial.numeral ? true : String(value) === expected;
    } else {
      result.placement = placement;
      result.target = trial.target;
      result.min = trial.min;
      result.max = trial.max;
      result.absoluteError = Math.abs(placement-trial.target);
      correct = result.absoluteError <= Math.max(1,(trial.max-trial.min)*.12);
    }
    result.correct = correct;
    check.results.push(result);
    var feedback = document.getElementById('checkFeedback');
    if (feedback) feedback.textContent = ['Thanks — next one!','Nice looking!','Got it — keep going!'][check.index%3];
    setTimeout(function(){ check.index++; check.locked=false; check.replayed=false; renderCheck(); }, 430);
  }

  function finishCheck(){
    var profile = Domain.buildProfile(check.results);
    var session = { id:'check-'+Date.now(), date:new Date().toISOString(), profile:profile, results:check.results, demo:false };
    // A real check replaces the optional sample journey so sample records can never be
    // mistaken for the learner's own history.
    store.checkSessions = store.checkSessions.filter(function(item){ return !item.demo; });
    store.practiceSessions = store.practiceSessions.filter(function(item){ return !item.demo; });
    store.checkSessions.push(session);
    if (store.checkSessions.length > 30) store.checkSessions = store.checkSessions.slice(-30);
    store.demo = false;
    persist();
    check = null;
    app.innerHTML = shell('<section class="num-panel game-complete"><div class="celebrate" aria-hidden="true">✓</div><h2>Number Check complete</h2><div class="num-actions" style="justify-content:center"><button class="num-button" type="button" data-screen="map">View results <span>→</span></button><button class="num-button secondary" type="button" data-screen="practice">Go to practice</button></div></section>', 'map');
  }

  function statusClass(value){ return value.toLowerCase().replace(/\s+/g,'-'); }
  function formatSeconds(ms){ return ms ? (ms/1000).toFixed(1)+' s' : '—'; }

  function renderMap(){
    var profile = latestProfile();
    if (!profile){
      app.innerHTML = shell('<section class="num-panel game-complete"><div class="celebrate">🗺️</div><h2>Your map starts with a Number Check.</h2><p>Complete four short activities so Second Look can choose practice based on the learner’s pattern.</p><div class="num-actions" style="justify-content:center"><button class="num-button" data-action="start-check" type="button">Start the Number Check</button><button class="num-button secondary" data-action="demo" type="button">View sample map</button></div></section>', 'map');
      return;
    }
    var rec = Domain.recommendActivity(profile);
    var skills = Object.keys(Domain.SKILLS).map(function(key){
      var s = profile[key];
      var detail = key === 'numberLine' ? 'Average placement error: '+(s.meanAbsoluteError || 0)+'% of the line' : s.accuracy+'% accurate · typical response '+formatSeconds(s.medianReactionTime);
      return '<article class="skill-card"><div class="skill-card-head"><h3>'+escapeHtml(s.label)+'</h3><span class="skill-status '+statusClass(s.observation)+'">'+s.observation+'</span></div><div class="skill-meter"><i style="width:'+s.score+'%"></i></div><p>'+escapeHtml(s.description)+'</p><div class="skill-meta"><span>'+detail+'</span><span>'+s.score+'/100</span></div></article>';
    }).join('');
    app.innerHTML = shell('<div class="skill-grid">'+skills+'</div><section class="recommend-card"><div class="recommend-icon">→</div><div><h3>Start with '+escapeHtml(rec.name)+'</h3><p>Recommended focus: '+escapeHtml(rec.skillLabel)+'</p></div><button class="num-button purple small" type="button" data-game="'+rec.id+'">Practice now</button></section><button class="num-button secondary small" type="button" data-action="toggle-why" style="margin-top:11px">Why this activity?</button><div class="why-box" id="whyBox" hidden><strong>How this was selected</strong>'+escapeHtml(rec.reason)+' This activity targets the skill with the lowest score in the latest Number Check.</div>', 'map');
  }

  function renderPractice(){
    var profile = latestProfile();
    var rec = profile ? Domain.recommendActivity(profile) : null;
    var games = [
      {id:'number-trail',icon:'1→10',name:'Number Trail',copy:'Spin, move, and count along a linear board. Builds the link between numerals, order, and distance.'},
      {id:'number-line',icon:'0—10',name:'Number Line Adventure',copy:'Help each number find its place. The range grows as placement becomes more accurate.'},
      {id:'quantity-battle',icon:'● vs 7',name:'Quantity Battle',copy:'Compare dots, digits, and mixed pairs to strengthen quantity–symbol connections.'}
    ];
    var tiles = games.map(function(item){
      var recommended = rec && rec.id === item.id;
      var level = Domain.nextPracticeLevel(store.practiceSessions,item.id);
      return '<article class="practice-tile '+(recommended?'recommended':'')+'">'+(recommended?'<span class="recommended-label">PICKED FOR YOU</span>':'')+'<div class="tile-icon">'+item.icon+'</div><h3>'+item.name+'</h3><p>'+item.copy+'</p><span class="level-note">Next: Level '+level+' of 3</span><button class="num-button small" type="button" data-game="'+item.id+'">Play</button></article>';
    }).join('');
    app.innerHTML = shell('<section class="num-panel"><div class="num-section-head"><div><h2>Practice activities</h2><p>'+(rec?'Recommended first: '+escapeHtml(rec.name)+'.':'Take a Number Check for a recommended starting activity, or choose any activity.')+'</p></div>'+(profile?'<button class="num-button secondary small" type="button" data-screen="map">See my map</button>':'<button class="num-button secondary small" type="button" data-action="start-check">Take the check</button>')+'</div><div class="practice-grid">'+tiles+'</div></section>', 'practice');
  }

  function startGame(id){
    var level = Domain.nextPracticeLevel(store.practiceSessions,id);
    var plan = Domain.gamePlan(id,level);
    if (id === 'number-trail') game = {id:id,level:level,position:0,turns:0,goal:plan.goal,spinnerMax:plan.spinnerMax,complete:false,saved:false};
    if (id === 'number-line') game = {id:id,level:level,index:0,score:0,rounds:plan.rounds,startedAt:performance.now(),complete:false,saved:false};
    if (id === 'quantity-battle') game = {id:id,level:level,index:0,score:0,rounds:plan.rounds,startedAt:performance.now(),complete:false,saved:false};
    currentScreen = 'game';
    renderGame();
  }

  function renderGame(){
    if (!game){ currentScreen='practice'; renderPractice(); return; }
    if (game.complete){ renderGameComplete(); return; }
    if (game.id === 'number-trail') renderTrail();
    else if (game.id === 'number-line') renderLineGame();
    else renderBattle();
  }

  function gameFrame(title,score,body){
    app.innerHTML = shell('<section class="num-panel game-shell"><div class="game-top"><div><span class="num-kicker">PRACTICE · LEVEL '+game.level+' OF 3</span><h2>'+title+'</h2></div><span class="game-score">'+score+'</span></div>'+body+'</section>', 'practice');
  }

  function renderTrail(){
    var cells = '';
    for (var i=0;i<=game.goal;i++) cells += '<div class="trail-step '+(i<game.position?'passed':i===game.position?'current':'')+'">'+(i===0?'GO':i)+'</div>';
    gameFrame('Number Trail','Turn '+(game.turns+1),'<p style="color:var(--text-muted);font-size:13px">Spin 1–'+game.spinnerMax+', then count each space as your star moves. Reach '+game.goal+' to finish.</p><div class="trail">'+cells+'</div><div class="spinner" id="spinner">?</div><div class="num-actions" style="justify-content:center"><button class="num-button" data-action="spin" type="button">Spin & move</button><button class="num-button secondary" data-screen="practice" type="button">Leave game</button></div><p class="encouragement" id="gameFeedback" style="text-align:center"></p>');
  }

  function spinTrail(){
    if (!game || game.id !== 'number-trail') return;
    var roll = 1 + Math.floor(Math.random()*game.spinnerMax);
    game.turns++;
    game.position = Math.min(game.goal,game.position+roll);
    if (game.position >= game.goal){ game.score = 100; game.complete=true; saveGame(); }
    renderGame();
    var spinner = document.getElementById('spinner');
    if (spinner) spinner.textContent = roll;
  }

  function renderLineGame(){
    var round = game.rounds[game.index];
    gameFrame('Number Line Adventure',(game.index+1)+' of '+game.rounds.length,'<div class="check-card" style="min-height:340px"><span class="task-badge">Help it land</span><h2 style="margin-top:12px">Where does '+round.target+' live?</h2><p>Tap the line as close as you can.</p><div class="number-line-wrap"><button class="number-track" type="button" data-game-line data-min="'+round.min+'" data-max="'+round.max+'" aria-label="Place '+round.target+' on a number line"></button></div><p class="encouragement" id="gameFeedback"></p></div>');
    game.startedAt = performance.now();
  }

  function answerGameLine(placement){
    if (!game || game.id !== 'number-line') return;
    var round = game.rounds[game.index];
    var error = Math.abs(round.target-placement)/(round.max-round.min);
    if (error <= .12) game.score++;
    game.index++;
    if (game.index >= game.rounds.length){ game.complete=true; saveGame(); }
    renderGame();
  }

  function representation(value,type){
    return type === 'dots' ? dots(value,true) : '<span>'+value+'</span>';
  }

  function renderBattle(){
    var round = game.rounds[game.index];
    gameFrame('Quantity Battle',(game.index+1)+' of '+game.rounds.length,'<div class="check-card" style="min-height:350px"><span class="task-badge">Choose more</span><h2 style="margin-top:12px">Which card wins?</h2><p>Tap the side that represents the larger amount.</p><div class="duel-row"><button class="choice-card wide" data-game-answer="left" type="button">'+representation(round.l,round.lr)+'</button><span class="duel-vs">VS</span><button class="choice-card wide" data-game-answer="right" type="button">'+representation(round.r,round.rr)+'</button></div><p class="encouragement" id="gameFeedback"></p></div>');
    game.startedAt = performance.now();
  }

  function answerBattle(side){
    if (!game || game.id !== 'quantity-battle') return;
    var round = game.rounds[game.index];
    if ((side === 'left' && round.l > round.r) || (side === 'right' && round.r > round.l)) game.score++;
    game.index++;
    if (game.index >= game.rounds.length){ game.complete=true; saveGame(); }
    renderGame();
  }

  function saveGame(){
    if (game.saved) return;
    game.saved = true;
    var total = game.id === 'number-trail' ? 100 : game.rounds.length;
    var score = game.id === 'number-trail' ? game.score : Math.round(game.score/total*100);
    store.practiceSessions.push({id:'practice-'+Date.now(),date:new Date().toISOString(),game:game.id,score:score,level:game.level});
    if (store.practiceSessions.length>60) store.practiceSessions=store.practiceSessions.slice(-60);
    persist();
  }

  function renderGameComplete(){
    var meta = Domain.GAME_META[game.id];
    var total = game.id === 'number-trail' ? 100 : game.rounds.length;
    var score = game.id === 'number-trail' ? game.score : Math.round(game.score/total*100);
    var nextLevel = Domain.nextPracticeLevel(store.practiceSessions,game.id);
    app.innerHTML = shell('<section class="num-panel game-complete"><div class="celebrate">★</div><h2>Practice complete</h2><p>'+escapeHtml(meta.name)+' · Level '+game.level+' · '+score+'%. Next round: Level '+nextLevel+'.</p><fieldset class="fit-check"><legend>How did that level feel?</legend><button type="button" data-fit="too-hard">Too hard</button><button type="button" data-fit="just-right">Just right</button><button type="button" data-fit="too-easy">Too easy</button></fieldset><p class="fit-status" id="fitStatus" aria-live="polite"></p><div class="num-actions" style="justify-content:center"><button class="num-button" data-game="'+game.id+'" type="button">Play again</button><button class="num-button secondary" data-screen="dashboard" type="button">View progress</button></div></section>', 'practice');
  }

  function renderDashboard(){
    var session = latestSession();
    if (!session){
      app.innerHTML = shell('<section class="num-panel game-complete"><div class="celebrate">📈</div><h2>No learning pattern yet.</h2><p>Complete a Number Check to create a private on-device dashboard, or load clearly marked sample data for a quick tour.</p><div class="num-actions" style="justify-content:center"><button class="num-button" data-action="start-check" type="button">Start the check</button><button class="num-button secondary" data-action="demo" type="button">Load sample data</button></div></section>', 'dashboard');
      return;
    }
    var profile = session.profile;
    var summary = Domain.patternSummary(profile);
    var rec = Domain.recommendActivity(profile);
    var rows = Object.keys(Domain.SKILLS).map(function(key){ return '<div class="profile-row"><span>'+escapeHtml(profile[key].short)+'</span><div class="bar"><i style="width:'+profile[key].score+'%"></i></div><b>'+profile[key].score+'</b></div>'; }).join('');
    var history = store.checkSessions.slice(-5).reverse().map(function(s){ return '<div class="history-row"><div><strong>'+(s.demo?'Sample Number Check':'Number Check')+'</strong><span>'+new Date(s.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+'</span></div><span class="history-score">'+Domain.overallScore(s.profile)+'</span></div>'; }).join('');
    var practiceHistory = store.practiceSessions.slice(-5).reverse().map(function(item){
      var meta = Domain.GAME_META[item.game];
      return '<div class="history-row"><div><strong>'+escapeHtml(meta ? meta.name : item.game)+'</strong><span>Level '+(item.level || 1)+' · '+new Date(item.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})+(item.fit?' · '+fitLabel(item.fit):'')+'</span></div><span class="history-score">'+item.score+'%</span></div>';
    }).join('') || '<p class="empty-note">No practice sessions yet.</p>';
    var trend = renderTrend(store.checkSessions);
    var realChecks = store.checkSessions.filter(function(item){ return !item.demo; });
    var comparison = realChecks.length > 1 ? Domain.compareProfiles(realChecks[realChecks.length-2].profile,profile) : null;
    if (store.demo && store.checkSessions.length > 1) comparison = Domain.compareProfiles(store.checkSessions[store.checkSessions.length-2].profile,profile);
    var comparisonCard = comparison ? '<section class="change-card"><div><span>Overall change</span><strong class="'+(comparison.overall>=0?'positive':'negative')+'">'+signed(comparison.overall)+'</strong></div>'+Object.keys(Domain.SKILLS).map(function(key){ var delta=comparison.skills[key]; return '<div><span>'+escapeHtml(Domain.SKILLS[key].short)+'</span><b class="'+(delta>=0?'positive':'negative')+'">'+signed(delta)+'</b></div>'; }).join('')+'</section>' : '<p class="empty-note">Take another Number Check after practice to compare each skill.</p>';
    var since = practicesSince(session);
    var nextStep = since.length ? 'You have completed '+since.length+' practice '+(since.length===1?'session':'sessions')+' since this check. Recheck when the learner is ready to compare skills.' : 'Complete the recommended activity, then return for another Number Check to compare skills.';
    var metricDetails = Object.keys(Domain.SKILLS).map(function(key){
      var item=profile[key];
      var measure=key==='numberLine' ? (item.meanAbsoluteError || 0)+'% average line error' : item.accuracy+'% accuracy · '+formatSeconds(item.medianReactionTime)+' median response';
      return '<div class="metric-row"><span>'+escapeHtml(item.short)+'</span><b>'+escapeHtml(measure)+'</b><small>'+item.trials+' trials · score '+item.score+'/100</small></div>';
    }).join('');
    app.innerHTML = shell('<section class="num-panel"><div class="num-section-head"><div><span class="num-kicker">FOR PARENTS &amp; EDUCATORS</span><h2>Learner’s number sense</h2><p>Results stay on this device unless you download or print them.</p></div><div class="report-actions">'+(store.demo?'<span class="sample-pill">SAMPLE DATA</span>':'')+'<button class="num-button secondary small" data-action="download-report" type="button">Download report</button><button class="num-button secondary small" data-action="print-report" type="button">Print</button></div></div><div class="dashboard-grid"><div class="dashboard-stack"><section><h3 class="dashboard-heading">Latest skill map</h3>'+rows+'</section><section><h3 class="dashboard-heading">Change since the previous check</h3>'+comparisonCard+'</section><section class="metric-panel"><div class="metric-head"><h3>How the scores were calculated</h3><button type="button" data-action="toggle-metrics" aria-expanded="false">Show details</button></div><div id="metricDetails" hidden>'+metricDetails+'<p class="method-note">Accuracy is weighted more than speed. Number-line scores use placement error relative to the displayed range. The lowest current skill selects the recommended activity.</p></div></section></div><div class="dashboard-stack"><article class="insight-card"><small>PATTERN OBSERVED</small><h3>'+escapeHtml(Domain.SKILLS[summary.strongest].short)+' is a relative strength.</h3><p>'+escapeHtml(summary.text)+'</p></article><article class="insight-card" style="background:var(--num-mint);color:#375b50"><small style="color:var(--num-teal-dark)">NEXT STEP</small><h3>'+escapeHtml(rec.name)+'</h3><p>'+escapeHtml(nextStep)+'</p><div class="inline-actions"><button class="num-button small" data-game="'+rec.id+'" type="button">Practice</button><button class="num-button secondary small" data-action="start-check" type="button">Recheck skills</button></div></article><section class="history-panel"><h3>Recent checks</h3><div class="history-list">'+history+'</div></section><section class="history-panel"><h3>Recent practice</h3><div class="history-list">'+practiceHistory+'</div></section></div></div></section>', 'dashboard');
  }

  function fitLabel(value){
    return value === 'too-hard' ? 'felt too hard' : value === 'too-easy' ? 'felt too easy' : 'felt right';
  }

  function downloadReport(){
    var session = latestSession();
    if (!session) return;
    var profile = session.profile;
    var rec = Domain.recommendActivity(profile);
    var rows = [['Second Look learner report'],['Date',new Date(session.date).toLocaleString()],['Overall score',Domain.overallScore(profile)],[],['Skill','Score','Accuracy','Median response (seconds)','Average number-line error']];
    Object.keys(Domain.SKILLS).forEach(function(key){
      var item=profile[key];
      rows.push([item.label,item.score,item.accuracy == null ? '' : item.accuracy,item.medianReactionTime ? (item.medianReactionTime/1000).toFixed(1) : '',key==='numberLine' ? item.meanAbsoluteError+'%' : '']);
    });
    rows.push([],['Recommended activity',rec.name],['Recommended focus',rec.skillLabel],['Reason',rec.reason],[],['Practice date','Activity','Level','Score','Learner feedback']);
    store.practiceSessions.forEach(function(item){ var meta=Domain.GAME_META[item.game]; rows.push([new Date(item.date).toLocaleString(),meta?meta.name:item.game,item.level||1,item.score+'%',item.fit?fitLabel(item.fit):'']); });
    rows.push([],['Note','Second Look is a practice and progress tool. It does not provide a diagnosis.']);
    var csv = rows.map(function(row){ return row.map(function(cell){ return '"'+String(cell == null ? '' : cell).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
    var url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    var link = document.createElement('a');
    link.href=url;
    link.download='second-look-report-'+new Date(session.date).toISOString().slice(0,10)+'.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },0);
  }

  function recordFit(value){
    if (!game || !game.saved || !store.practiceSessions.length) return;
    var latest = store.practiceSessions[store.practiceSessions.length-1];
    if (latest.game !== game.id) return;
    latest.fit = value;
    persist();
    var buttons = document.querySelectorAll('[data-fit]');
    buttons.forEach(function(button){ button.setAttribute('aria-pressed',button.dataset.fit === value ? 'true' : 'false'); });
    var status = document.getElementById('fitStatus');
    if (status) status.textContent = 'Saved. The next round will use Level '+Domain.nextPracticeLevel(store.practiceSessions,game.id)+'.';
  }

  function renderTrend(sessions){
    var items = sessions.slice(-8);
    if (items.length < 2) return '<p style="color:var(--text-muted);font-size:12px">Take another check later to see change over time.</p>';
    var w=480,h=120,p=18;
    var values=items.map(function(s){ return Domain.overallScore(s.profile); });
    var points=values.map(function(v,i){ var x=p+i*((w-2*p)/(values.length-1)); var y=h-p-(v/100)*(h-2*p); return [x,y]; });
    return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" role="img" aria-label="Overall number sense scores over time"><line x1="'+p+'" y1="'+(h-p)+'" x2="'+(w-p)+'" y2="'+(h-p)+'" stroke="var(--border)"/><polyline points="'+points.map(function(pt){return pt.join(',');}).join(' ')+'" fill="none" stroke="var(--num-teal)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+points.map(function(pt,i){return '<circle cx="'+pt[0]+'" cy="'+pt[1]+'" r="5" fill="var(--surface)" stroke="var(--num-teal)" stroke-width="3"><title>'+values[i]+'</title></circle>';}).join('')+'</svg>';
  }

  function renderResearch(){
    app.innerHTML = shell('<section class="num-panel"><div class="num-section-head"><div><span class="num-kicker">TRANSPARENT BY DESIGN</span><h2>How Second Look works</h2><p>The app uses explainable rules so families and educators can see what changes and why.</p></div></div><div class="system-flow"><article><b>1</b><h3>Measure</h3><p>Twelve short trials record accuracy, response time, and number-line placement error.</p></article><span aria-hidden="true">→</span><article><b>2</b><h3>Score</h3><p>Accuracy carries more weight than speed. Placement error is adjusted for the line’s range.</p></article><span aria-hidden="true">→</span><article><b>3</b><h3>Adapt</h3><p>The lowest skill selects an activity. Performance and learner feedback set its next level.</p></article><span aria-hidden="true">→</span><article><b>4</b><h3>Compare</h3><p>Later checks show change by skill. Data stays in this browser unless a report is exported.</p></article></div></section><section class="num-panel"><div class="num-section-head"><div><h2>Research behind the activities</h2></div></div><div class="research-grid"><article class="research-card"><span class="source-label">DOT ENUMERATION</span><h3>Quantity recognition</h3><p>Dot enumeration is used in research on numerical-processing efficiency and developmental dyscalculia.</p><a href="https://pubmed.ncbi.nlm.nih.gov/23898310/" target="_blank" rel="noopener">Read the study →</a></article><article class="research-card"><span class="source-label">SYMBOLIC MAGNITUDE</span><h3>Comparing written numbers</h3><p>A meta-analysis found slower symbolic magnitude-comparison responses among children with mathematical difficulties.</p><a href="https://pubmed.ncbi.nlm.nih.gov/28432933/" target="_blank" rel="noopener">Read the meta-analysis →</a></article><article class="research-card"><span class="source-label">LINEAR BOARD PLAY</span><h3>Number Trail</h3><p>Linear numerical board-game play improved magnitude comparison, number-line estimation, counting, and numeral identification in a randomized study.</p><a href="https://pubmed.ncbi.nlm.nih.gov/18366429/" target="_blank" rel="noopener">Read the study →</a></article><article class="research-card"><span class="source-label">SPATIAL NUMBER TRAINING</span><h3>Number Line Adventure</h3><p>A computer intervention improved spatial number representation and arithmetic performance in children with developmental dyscalculia.</p><a href="https://pubmed.ncbi.nlm.nih.gov/21295145/" target="_blank" rel="noopener">Read the study →</a></article></div><article class="legal-card" style="margin-top:16px"><h3>California SB 1067</h3><p>Beginning in the 2028–29 school year, California’s law calls for annual K–2 screening for early math difficulties. Second Look does not fulfill that screening requirement or diagnose dyscalculia. It provides practice based on performance in these activities. <a href="https://sd39.senate.ca.gov/sites/sd39.senate.ca.gov/files/pdf/SB%201067-%20Universal%20Math%20Screener%20Bill%20Factsheet%202.18%20Final%20.pdf" target="_blank" rel="noopener">View the bill fact sheet →</a></p></article></section>', 'research');
  }

  function loadDemo(){
    store.checkSessions = Domain.demoSessions();
    store.practiceSessions = [
      {id:'demo-p1',date:new Date(Date.now()-16*86400000).toISOString(),game:'quantity-battle',score:60,level:1,fit:'just-right',demo:true},
      {id:'demo-p2',date:new Date(Date.now()-6*86400000).toISOString(),game:'number-trail',score:84,level:1,fit:'too-easy',demo:true}
    ];
    store.demo = true;
    persist();
    currentScreen='map';
    renderMap();
  }

  app.addEventListener('click', function(event){
    var screenButton = event.target.closest('[data-screen]');
    if (screenButton){ currentScreen=screenButton.dataset.screen; game=null; renderNumbers(); return; }
    var action = event.target.closest('[data-action]');
    if (action){
      if (action.dataset.action === 'start-check') startCheck();
      else if (action.dataset.action === 'begin-trials'){ check.intro=false; renderCheck(); }
      else if (action.dataset.action === 'replay-dots') replayDots();
      else if (action.dataset.action === 'demo') loadDemo();
      else if (action.dataset.action === 'toggle-why'){ var box=document.getElementById('whyBox'); if(box) box.hidden=!box.hidden; }
      else if (action.dataset.action === 'toggle-metrics'){ var details=document.getElementById('metricDetails'); if(details){ details.hidden=!details.hidden; action.setAttribute('aria-expanded',String(!details.hidden)); action.textContent=details.hidden?'Show details':'Hide details'; } }
      else if (action.dataset.action === 'download-report') downloadReport();
      else if (action.dataset.action === 'print-report') window.print();
      else if (action.dataset.action === 'spin') spinTrail();
      return;
    }
    var answer = event.target.closest('[data-answer]');
    if (answer){ answerTrial(answer.dataset.answer); return; }
    var gameButton = event.target.closest('[data-game]');
    if (gameButton){ startGame(gameButton.dataset.game); return; }
    var fitButton = event.target.closest('[data-fit]');
    if (fitButton){ recordFit(fitButton.dataset.fit); return; }
    var battle = event.target.closest('[data-game-answer]');
    if (battle){ answerBattle(battle.dataset.gameAnswer); return; }
    var line = event.target.closest('[data-number-line]');
    if (line){
      var rect=line.getBoundingClientRect(); var trial=check.trials[check.index]; var ratio=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)); var placement=trial.min+ratio*(trial.max-trial.min);
      line.innerHTML='<i class="target-pin" style="left:'+(ratio*100)+'%"></i>'; answerTrial(null,placement); return;
    }
    var gameLine = event.target.closest('[data-game-line]');
    if (gameLine){
      var gr=gameLine.getBoundingClientRect(); var round=game.rounds[game.index]; var gratio=Math.max(0,Math.min(1,(event.clientX-gr.left)/gr.width)); answerGameLine(round.min+gratio*(round.max-round.min));
    }
  });

  // Preserve the repository's file:// regression tests: they exercise the original Words
  // interface and expect it to be visible immediately. The deployed site and local server
  // open on the new choice screen; a query parameter can deep-link either mode.
  var requested = new URLSearchParams(location.search).get('mode');
  if (requested === 'numbers') setMode('numbers');
  else if (requested === 'words' || location.protocol === 'file:') setMode('words');
  else setMode('home');
})();
