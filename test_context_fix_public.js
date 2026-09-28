// Regression tests for the contextual-suggestion fix (fix_AI.md), public build
// (public_index.html). Covers TC-3, TC-5, TC-7/TC-9 (public half), and TC-11 -- the parts of
// the spec that specifically need a mocked Worker fetch() (S1's incremental JSON recovery, and
// the exact shape of the request the public build sends over the network). See
// test_context_fix.js for TC-1/TC-2/TC-6 and the Artifact-build half of TC-7/TC-9, and
// test_context_fix_parser.js for TC-4's pure-JS parser unit tests.
const { chromium } = require('playwright');
const path = require('path');

const TEXT = "That whas scery. I can fell a shiver down may spiyn. Its getting liyt. I shud go to bed. I bet im gooing to have nitmers a bawt that. o well, just have to dell with it. I cant get that dam thim song out ove my haed never going to whach halloween movie a gen or its seqwels";

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
];

function fetchMockScript(){
  return (responseText) => {
    window.__fetchCalls = [];
    window.fetch = async function(url, opts){
      if (typeof url === 'string' && url.indexOf('/ai') !== -1){
        var body = opts && opts.body ? JSON.parse(opts.body) : {};
        window.__fetchCalls.push(body);
        return new Response(JSON.stringify({ text: responseText, usage: { prompt_tokens: 500, completion_tokens: 300 }, model: 'gpt-5-mini' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
  };
}

async function openApp(page, mockedReplyText){
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fetchMockScript(), mockedReplyText);
  await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
  await page.waitForTimeout(150);
  return errors;
}

// For the two-pass ensemble tests (TC-12): each /ai fetch call gets the NEXT entry from
// `steps`, cycling if there are more calls than steps. An entry is one of:
//   {text: <ai reply string>}   -- a normal 200 response with that reply body
//   {status: 500}               -- a non-ok HTTP response (simulates a Worker-side failure)
//   {networkError: true}        -- fetch() itself throws (simulates being offline)
// This lets a single check's two concurrent callAI() passes behave differently from each
// other, which a single static mocked reply (fetchMockScript above) can't express.
function fetchMockSequentialScript(){
  return (steps) => {
    window.__fetchCalls = [];
    var i = 0;
    window.fetch = async function(url, opts){
      if (typeof url === 'string' && url.indexOf('/ai') !== -1){
        var body = opts && opts.body ? JSON.parse(opts.body) : {};
        window.__fetchCalls.push(body);
        var step = steps[i % steps.length]; i++;
        if (step.networkError) throw new Error("simulated network failure");
        if (step.status && step.status !== 200) return new Response('{}', { status: step.status });
        return new Response(JSON.stringify({ text: step.text, usage: { prompt_tokens: 100, completion_tokens: 50 }, model: 'gpt-5-mini' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
  };
}

async function openAppSequential(page, steps){
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fetchMockSequentialScript(), steps);
  await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
  await page.waitForTimeout(150);
  return errors;
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

  // ---------- TC-3: a truncated reply keeps the items that DID arrive (S1) ----------
  {
    const page = await browser.newPage();
    const truncated = '[' +
      '{"original":"whas","suggestion":"was","type":"spelling","explanation":"e"},' +
      '{"original":"spiyn","suggestion":"spine","type":"spelling","explanation":"e"},' +
      '{"original":"liyt","suggestion":"late","type":"spelling","explanation":"e"},' +
      '{"original":"shud","suggestion":"should","type":"spelling","explanation":"e"},' +
      '{"original":"bawt","suggestion":"about","type":"spelling","explanation":"e"},' +
      '{"original":"thim","sugg'; // cut off mid-item, no closing braces -- simulates hitting maxTokens
    const errors = await openApp(page, truncated);
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(500);
    const marks = await markTexts(page);
    const banner = await page.textContent('#banners').catch(() => '');
    console.log("=== TC-3: truncated AI reply recovers the valid items (S1) ===");
    console.log({ liytPresent: marks.includes('liyt'), banner: (banner || '').trim() });
    if (!marks.includes('liyt')) fail("TC-3 [G4]: the 5 complete items (incl. 'liyt') should still merge from a truncated reply");
    const reveal = await revealFor(page, 'liyt');
    if (!reveal || reveal.indexOf('“late”') === -1) fail("TC-3: 'liyt' should still resolve to 'late' out of the truncated reply, got: " + reveal);
    if (!/incomplete/i.test(banner || '')) fail("TC-3: expected a distinct 'results may be incomplete' banner, not the generic 'hit a snag' one, got: " + banner);
    if (/snag/i.test(banner || '')) fail("TC-3 [G4]: a partially-recovered reply must not show the total-failure 'hit a snag' banner");
    if (errors.length) fail("TC-3 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-5: the prompt sent to the Worker carries local guess + confidence per hint (S2) ----------
  {
    const page = await browser.newPage();
    const errors = await openApp(page, '[]');
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const calls = await page.evaluate(() => window.__fetchCalls || []);
    const call = calls[0] || {};
    console.log("\n=== TC-5: request carries structured hints (S2) ===");
    console.log({ requestKeys: Object.keys(call), promptMentionsLit: (call.prompt || '').indexOf('"lit"') !== -1 });
    if (!call.prompt) fail("TC-5: expected a prompt to have been sent");
    if ((call.prompt || '').indexOf('"lit"') === -1) fail("TC-5 [S2]: expected the local guess 'lit' for 'liyt' to appear in the hints sent to the model");
    if ((call.prompt || '').indexOf('localGuess') === -1) fail("TC-5 [S2]: expected hints to be structured objects with a localGuess field, not bare words");
    if (!/CONFIRM/.test(call.prompt || '') || !/REPLACE/.test(call.prompt || '') || !/CLEAR/.test(call.prompt || '')) {
      fail("TC-5 [S2]: expected the explicit CONFIRM/REPLACE/CLEAR instruction in the prompt");
    }
    const extraKeys = Object.keys(call).filter(k => ['prompt','model','maxTokens','image'].indexOf(k) === -1);
    if (extraKeys.length) fail("TC-5: request body should only carry prompt/model/maxTokens(/image), found extra: " + extraKeys.join(','));
    if (errors.length) fail("TC-5 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-7 / TC-9 (public-build half): full G2 answer key holds here too ----------
  {
    const page = await browser.newPage();
    const errors = await openApp(page, JSON.stringify(G2_AI_ITEMS));
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(500);
    console.log("\n=== TC-7/TC-9: full G2 answer key (public build) ===");
    const marks = await markTexts(page);
    console.log({ marks, betFlagged: marks.includes('bet') });
    if (marks.includes('bet')) fail("TC-7 [G2]: 'bet' must NOT be flagged (public build)");
    const answerKey = {
      whas:"was", scery:"scary", fell:"feel", may:"my", spiyn:"spine", Its:"It's", liyt:"late",
      shud:"should", gooing:"going", nitmers:"nightmares", bawt:"about", "o well":"oh well",
      dell:"deal", cant:"can't", dam:"damn", thim:"theme", ove:"of", haed:"head", whach:"watch",
      "a gen":"again", seqwels:"sequels"
    };
    for (const word of Object.keys(answerKey)){
      if (!marks.includes(word)) { fail("TC-7 [G2] (public): expected '" + word + "' to be flagged"); continue; }
      const reveal = await revealFor(page, word);
      const want = answerKey[word];
      if (!reveal || reveal.indexOf('“' + want + '”') === -1) {
        fail("TC-7 [G2] (public): '" + word + "' should suggest '" + want + "', got: " + reveal);
      }
    }
    if (errors.length) fail("TC-7 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-11: budget accounting is unchanged by S1-S5 ----------
  {
    const page = await browser.newPage();
    const errors = await openApp(page, '[{"original":"whas","suggestion":"was","type":"spelling","explanation":"e"}]');
    await page.fill('#editor', 'That whas nice.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const usageText = await page.textContent('#aiUsageInfo').catch(() => '');
    const storedUsage = await page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('secondlook_session_usage_v1')); } catch(e){ return null; } });
    console.log("\n=== TC-11: budget accounting unchanged ===");
    console.log({ usageText: (usageText || '').trim(), storedUsage });
    // runAIPass now fires TWO concurrent callAI() passes per check (the ensemble fix for
    // real-word misses like "win"->"when" that the local checker never hinted at all -- see
    // build.py's runAIPass comment). So one "Check my writing" click books 2x 500in/300out
    // gpt-5-mini tokens: (1000*0.25 + 600*2.00)/1e6 = $0.00145, same published rate as before
    // this fix. Floating point rounds usage.cost.toFixed(4) down to "$0.0014", so check the
    // underlying stored figure exactly rather than the rounded display string.
    if (!storedUsage || Math.abs(storedUsage.cost - 0.00145) > 1e-9) fail("TC-11: expected the stored session cost to be exactly 0.00145 for two 500in/300out gpt-5-mini passes, got: " + JSON.stringify(storedUsage));
    if (!/\$0\.0014/.test(usageText || '') || !/1,?600/.test(usageText || '')) fail("TC-11: expected the usage readout to show 1600 tokens and ~$0.0014, got: " + usageText);

    // Now force the session over budget and confirm the existing cutoff still fires.
    await page.evaluate(() => { try { sessionStorage.setItem('secondlook_session_usage_v1', JSON.stringify({ cost: 0.25, tokens: 999999, calls: 1 })); } catch(e){} });
    await page.click('#btnEditAgain');
    await page.waitForTimeout(100);
    await page.fill('#editor', 'That whas nice again, a second time.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const callsAfter = (await page.evaluate(() => window.__fetchCalls || [])).length;
    const banner = await page.textContent('#banners').catch(() => '');
    console.log({ callsAfterBudgetForced: callsAfter, banner: (banner || '').trim() });
    // callsAfter should still equal the 2 calls from the FIRST (successful) check above --
    // once over budget, both concurrent callAI() calls must refuse before ever reaching
    // fetch, so this second click adds zero new network calls.
    if (callsAfter !== 2) fail("TC-11: once over budget, both concurrent callAI() passes should refuse before a network call, saw " + callsAfter + " total calls (expected 2, from the first successful check)");
    if (!/budget/i.test(banner || '')) fail("TC-11: expected the existing 'budget used up' banner once the session is over the $0.20 cap, got: " + banner);
    if (errors.length) fail("TC-11 page errors: " + errors.join('; '));
    await page.close();
  }

  // ---------- TC-12: two-pass ensemble (union, dedup, and partial-failure tolerance) ----------
  // Follow-up fix: a real-word mistake the local checker never hinted at all (e.g. "win"
  // instead of "when") depends on the model spontaneously noticing it on a single free-form
  // read -- a probabilistic call that can catch it on one pass and miss it on another. runAIPass
  // now fires two independent callAI() passes per check and unions whatever either one found.
  {
    // (a) the two passes catch two DIFFERENT, non-overlapping mistakes -- both must survive,
    // proving the union actually adds recall rather than just using pass 1.
    const page = await browser.newPage();
    const errors = await openAppSequential(page, [
      { text: '[{"original":"dog","suggestion":"canine","type":"word choice","explanation":"e"}]' },
      { text: '[{"original":"cat","suggestion":"feline","type":"word choice","explanation":"e"}]' }
    ]);
    await page.fill('#editor', 'I have a dog. I have a cat.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const marksA = await markTexts(page);
    console.log("=== TC-12a: union of two non-overlapping passes ===");
    console.log({ marksA });
    if (!marksA.includes('dog')) fail("TC-12a: pass 1's catch ('dog') should survive the union");
    if (!marksA.includes('cat')) fail("TC-12a: pass 2's catch ('cat'), which pass 1 never mentioned, should ALSO survive the union -- this is the whole point of running two passes");
    if (errors.length) fail("TC-12a page errors: " + errors.join('; '));
    await page.close();
  }
  {
    // (b) both passes catch the SAME mistake -- must merge into exactly one flag, not two.
    const page = await browser.newPage();
    const sameItem = '[{"original":"dog","suggestion":"canine","type":"word choice","explanation":"e"}]';
    const errors = await openAppSequential(page, [{ text: sameItem }, { text: sameItem }]);
    await page.fill('#editor', 'I have a dog.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const marksB = await markTexts(page);
    console.log("\n=== TC-12b: both passes agreeing dedupes to one flag ===");
    console.log({ marksB });
    if (marksB.filter(m => m === 'dog').length !== 1) fail("TC-12b: two passes agreeing on the same word should produce exactly one flag, got " + marksB.filter(m => m === 'dog').length);
    if (errors.length) fail("TC-12b page errors: " + errors.join('; '));
    await page.close();
  }
  {
    // (c) pass 1 fails outright (network error) but pass 2 succeeds -- the check must still
    // surface pass 2's finding and must NOT show the "hit a snag" failure banner, since at
    // least one pass came back clean. This is the resilience half of the ensemble: a flaky
    // pass shouldn't make the whole deeper check look broken.
    const page = await browser.newPage();
    const errors = await openAppSequential(page, [
      { networkError: true },
      { text: '[{"original":"cat","suggestion":"feline","type":"word choice","explanation":"e"}]' }
    ]);
    await page.fill('#editor', 'I have a cat.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const marksC = await markTexts(page);
    const bannerC = await page.textContent('#banners').catch(() => '');
    console.log("\n=== TC-12c: one pass fails outright, the other still gets used ===");
    console.log({ marksC, bannerC: (bannerC || '').trim() });
    if (!marksC.includes('cat')) fail("TC-12c: pass 2's catch should still surface even though pass 1's network call failed");
    if (/snag/i.test(bannerC || '')) fail("TC-12c: one pass failing should NOT trigger the 'hit a snag' banner when the other pass succeeded, got: " + bannerC);
    if (errors.length) fail("TC-12c page errors: " + errors.join('; '));
    await page.close();
  }
  {
    // (d) BOTH passes fail -- the existing "hit a snag" fallback must still fire (this is the
    // one case runAIPass's catch block should actually reach).
    const page = await browser.newPage();
    const errors = await openAppSequential(page, [{ status: 500 }, { status: 500 }]);
    await page.fill('#editor', 'I have a cat.');
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const bannerD = await page.textContent('#banners').catch(() => '');
    console.log("\n=== TC-12d: both passes fail -> existing 'hit a snag' fallback still fires ===");
    console.log({ bannerD: (bannerD || '').trim() });
    if (!/snag/i.test(bannerD || '')) fail("TC-12d: when BOTH passes fail, the deeper check should still show the 'hit a snag' banner, got: " + bannerD);
    if (errors.length) fail("TC-12d page errors: " + errors.join('; '));
    await page.close();
  }

  await browser.close();
  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
