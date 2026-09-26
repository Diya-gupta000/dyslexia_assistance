// Regression tests for the contextual-suggestion fix (fix_AI.md), Artifact build
// (second_look.html). Covers TC-1, TC-2, TC-6, and half of TC-7/TC-9 from the spec.
//
// The bug this fixes: the deeper AI check used to suggest "lit" instead of "late" for the
// misspelling "liyt" in "Its getting liyt. I shud go to bed." -- because (a) the prompt never
// told the model what the free local spellchecker already guessed, so it had nothing to
// correct against, and (b) a single malformed/truncated item in the AI's JSON reply discarded
// every other item in the same reply. See test_context_fix_public.js for the public build's
// half of this suite (S1's truncated-JSON recovery and S2's prompt-shape check need a mocked
// Worker fetch(), which only exists in that build).
const { chromium } = require('playwright');
const path = require('path');

// The exact fixture paragraph from fix_AI.md Part 1 -- do not paraphrase or shorten it, its
// ~21 flaggable spots are the point of the test.
const TEXT = "That whas scery. I can fell a shiver down may spiyn. Its getting liyt. I shud go to bed. I bet im gooing to have nitmers a bawt that. o well, just have to dell with it. I cant get that dam thim song out ove my haed never going to whach halloween movie a gen or its seqwels";

// The G2 answer key (fix_AI.md), as AI items. Confirms local-only rows (scery/gooing/seqwels,
// where the local guess is already right) are deliberately left OUT here -- the local checker
// already gets those on its own, so a real gpt-5-mini reply following the CONFIRM/REPLACE/CLEAR
// instruction could reasonably CONFIRM or simply not re-mention them; either way the fixture
// paragraph's answer key must hold, so this test doesn't require every row to come from the AI.
const G2_AI_ITEMS = [
  {original:"whas", suggestion:"was", type:"spelling", explanation:"e"},
  {original:"fell", suggestion:"feel", type:"word choice", explanation:"e"},
  {original:"may", suggestion:"my", type:"word choice", explanation:"e"},
  {original:"spiyn", suggestion:"spine", type:"spelling", explanation:"e"},
  {original:"Its", suggestion:"It's", type:"punctuation", explanation:"e"},
  {original:"liyt", suggestion:"late", type:"spelling", explanation:"e"},
  {original:"shud", suggestion:"should", type:"spelling", explanation:"e"},
  {original:"nitmers", suggestion:"nightmares", type:"spelling", explanation:"e"},
  {original:"bawt", suggestion:"about", type:"spelling", explanation:"e"},
  {original:"o well", suggestion:"oh well", type:"spelling", explanation:"e"},
  {original:"dell", suggestion:"deal", type:"spelling", explanation:"e"},
  {original:"cant", suggestion:"can't", type:"punctuation", explanation:"e"},
  {original:"dam", suggestion:"damn", type:"word choice", explanation:"e"},
  {original:"thim", suggestion:"theme", type:"spelling", explanation:"e"},
  {original:"ove", suggestion:"of", type:"spelling", explanation:"e"},
  {original:"haed", suggestion:"head", type:"spelling", explanation:"e"},
  {original:"whach", suggestion:"watch", type:"spelling", explanation:"e"},
  {original:"a gen", suggestion:"again", type:"spelling", explanation:"e"},
  {original:"seqwels", suggestion:"sequels", type:"spelling", explanation:"e"}
  // "bet" is intentionally absent: G2 says it must NOT be flagged (CLEARed).
];

function mockSample(items){
  return (aiItems) => {
    window.claude = {
      use: async function(name){
        if (name === 'sample') return { json: async function(prompt, opts){ window.__lastPrompt = prompt; return aiItems; } };
        if (name === 'db') return { doc: function(){ return { get: async()=>({exists:false}), set: async()=>{} }; } };
        return null;
      }
    };
  };
}

async function openApp(page, initArg){
  await page.addInitScript(mockSample(), initArg);
  await page.goto('file://' + path.resolve(__dirname, 'second_look.html'));
  await page.waitForTimeout(150);
}

async function markTexts(page){
  return await page.$$eval('#reviewed mark', els => els.map(e => e.textContent));
}

async function revealFor(page, wordText){
  const marks = await page.$$('#reviewed mark');
  for (const mark of marks){
    const t = await mark.textContent();
    if (t === wordText){
      await mark.click();
      await page.waitForTimeout(80);
      await page.click('#popShow');
      await page.waitForTimeout(80);
      const reveal = await page.textContent('#popReveal');
      await page.click('#popClose');
      await page.waitForTimeout(50);
      return reveal;
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // ---------- TC-1: local layer still flags "liyt" with the deeper check off ----------
  {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await openApp(page, []);
    await page.uncheck('#useAI');
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(200);
    const marks = await markTexts(page);
    console.log("=== TC-1: local-only flags 'liyt' (AI off) ===");
    console.log({ liytFlagged: marks.includes('liyt') });
    if (!marks.includes('liyt')) fail("TC-1: 'liyt' should be flagged by the local layer even with AI off");
    if (errors.length) fail("TC-1 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-2: the headline test -- AI upgrades "liyt" to "late" ----------
  {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await openApp(page, [{original:"liyt", suggestion:"late", type:"spelling", explanation:"“Its getting late” makes sense — it's almost bedtime."}]);
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const reveal = await revealFor(page, 'liyt');
    console.log("\n=== TC-2: 'liyt' -> 'late' (headline, must pass) ===");
    console.log({ reveal });
    if (!reveal || reveal.indexOf('“late”') === -1) fail("TC-2 [G1, NON-NEGOTIABLE]: expected the 'liyt' suggestion to be 'late', got: " + reveal);
    if (reveal && reveal.indexOf('The fix') !== 0) fail("TC-2: an AI-confirmed suggestion should use the confident 'The fix' wording, got: " + reveal);
    if (errors.length) fail("TC-2 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-6: a hinted word the AI never claims becomes 'unconfirmed', never shown as confident ----------
  {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    // Confirm/replace every OTHER hinted word, but say nothing about "liyt".
    const items = G2_AI_ITEMS.filter(it => it.original !== 'liyt');
    await openApp(page, items);
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(500);
    const liytReveal = await revealFor(page, 'liyt');
    const whasReveal = await revealFor(page, 'whas');
    console.log("\n=== TC-6: unclaimed hint -> honest 'best guess' wording, never 'The fix' ===");
    console.log({ liytReveal, whasReveal });
    if (!liytReveal || liytReveal.indexOf('My best guess') !== 0) fail("TC-6 [G5]: an AI-unconfirmed 'liyt' should use the soft 'My best guess' wording, got: " + liytReveal);
    if (liytReveal && liytReveal.indexOf('The fix') !== -1) fail("TC-6 [G5]: an unconfirmed suggestion must never use the confident 'The fix' phrasing");
    if (!whasReveal || whasReveal.indexOf('The fix') !== 0) fail("TC-6: 'whas', which the AI DID confirm, should still get the confident wording, got: " + whasReveal);
    if (errors.length) fail("TC-6 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-7 / TC-9 (artifact-build half): full G2 answer key holds, "bet" stays unflagged ----------
  {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await openApp(page, G2_AI_ITEMS);
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(500);
    console.log("\n=== TC-7/TC-9: full G2 answer key (Artifact build) ===");
    const marks = await markTexts(page);
    console.log({ marks, betFlagged: marks.includes('bet') });
    if (marks.includes('bet')) fail("TC-7 [G2]: 'bet' is correct as written and must NOT be flagged");
    const answerKey = {
      whas:"was", scery:"scary", fell:"feel", may:"my", spiyn:"spine", Its:"It's", liyt:"late",
      shud:"should", gooing:"going", nitmers:"nightmares", bawt:"about", "o well":"oh well",
      dell:"deal", cant:"can't", dam:"damn", thim:"theme", ove:"of", haed:"head", whach:"watch",
      "a gen":"again", seqwels:"sequels"
    };
    for (const word of Object.keys(answerKey)){
      if (!marks.includes(word)) { fail("TC-7 [G2]: expected '" + word + "' to be flagged"); continue; }
      const reveal = await revealFor(page, word);
      const want = answerKey[word];
      if (!reveal || reveal.indexOf('“' + want + '”') === -1) {
        fail("TC-7 [G2]: '" + word + "' should suggest '" + want + "', got: " + reveal);
      }
    }
    if (errors.length) fail("TC-7 page errors: " + errors.join('; '));
    await page.close();
  }

  await browser.close();
  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
