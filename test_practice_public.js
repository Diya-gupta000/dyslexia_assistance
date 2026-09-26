// Regression test for the practice-sentence generator (My Progress tab), public build.
//
// Covers the public-build-specific halves of the spec: TC-3's Worker-request-shape
// assertion, TC-9 (budget exhausted -> template, zero requests), TC-10 (Worker HTTP error
// -> template fallback, no hang), plus TC-15's "both builds" re-check of TC-2 through TC-4
// and TC-7 against public_index.html, and a backwards-compatibility check for real visitors
// whose localStorage still holds the pre-feature bare-array progress shape.
const { chromium } = require('playwright');
const path = require('path');

const SEED = {
  sessions: [{ date: "2026-01-01T00:00:00.000Z", words: 50, spelling: 1, grammar: 0, punctuation: 0, wordChoice: 1,
    total: 2, selfFixed: 2, revealed: 0, skipped: 0, helpRequests: 0, aiUsed: true, spellingPairs: [] }],
  wordErrors: { necessary: 4, rhythm: 3, separate: 2 },
  confusionErrors: { "their/there": { correctCounts: { their: 2, there: 1 }, total: 3 } },
  practiceStreaks: {},
  practiceSessions: 0,
  practiceRounds: []
};

function installMocks() {
  return ({ seedJson, workerMode, sessionUsage }) => {
    if (seedJson) localStorage.setItem('secondlook_sessions_v1', seedJson);
    if (sessionUsage) sessionStorage.setItem('secondlook_session_usage_v1', JSON.stringify(sessionUsage));
    window.__fetchCalls = [];
    const origFetch = window.fetch;
    window.fetch = async function (url, opts) {
      if (typeof url === 'string' && url.indexOf('/ai') !== -1) {
        const body = opts && opts.body ? JSON.parse(opts.body) : null;
        window.__fetchCalls.push({ url, body });
        if (workerMode === 'error') return { ok: false, status: 500, json: async () => ({}) };
        const promptStr = body.prompt || '';
        const m = promptStr.match(/Targets:\n(\[.*?\])\n\n/s);
        const targets = m ? JSON.parse(m[1]) : [];
        const sentences = targets.map(t => {
          const word = t.type === 'spelling' ? t.word : t.correct;
          return { target: t.index, sentence: "This is a normal practice sentence about the word " + word + " in context today." };
        });
        return { ok: true, status: 200, json: async () => ({ text: JSON.stringify({ sentences }), usage: { prompt_tokens: 100, completion_tokens: 50 }, model: 'gpt-5-nano' }) };
      }
      return origFetch(url, opts);
    };
    window.speechSynthesis = window.speechSynthesis || {};
    window.speechSynthesis.cancel = function () {};
    window.speechSynthesis.speak = function () {};
  };
}

async function openProgressTab(seed, workerMode, sessionUsage) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(installMocks(), {
    seedJson: seed ? JSON.stringify(seed) : null,
    workerMode: workerMode || 'valid',
    sessionUsage: sessionUsage || null
  });
  await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
  await page.waitForTimeout(150);
  await page.click('[data-view="progress"]');
  await page.waitForTimeout(100);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- TC-15 (re-check TC-2): button enables with history, public build ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-15/TC-2: button enables with history (public) ===");
    const disabled = await page.getAttribute('#btnGeneratePractice', 'disabled');
    if (disabled !== null) fail("button should be enabled once wordErrors/confusionErrors exist");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-3 (public half): exactly one Worker request, on gpt-5-nano, containing only
  //           the targets + count -- no paragraphs or other progress history ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-3: Worker request shape, no history leaked ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(400);
    const nCards = await page.locator('.practice-card').count();
    const caption = await page.textContent('#practiceCaption');
    const calls = await page.evaluate(() => window.__fetchCalls);
    console.log({ nCards, caption, nRequests: calls.length });
    if (calls.length !== 1) fail("expected exactly one Worker request, got " + calls.length);
    if (calls.length) {
      const body = calls[0].body;
      const keys = Object.keys(body).sort();
      console.log({ requestBodyKeys: keys, model: body.model });
      if (JSON.stringify(keys) !== JSON.stringify(['maxTokens', 'model', 'prompt'])) {
        fail("request body should contain only {model, prompt, maxTokens}, got: " + keys.join(','));
      }
      if (body.model !== 'gpt-5-nano') fail("expected model 'gpt-5-nano', got: " + body.model);
      if (/"words":\d/.test(body.prompt) || body.prompt.indexOf('Paragraph:') !== -1) {
        fail("request body must not contain paragraph/session history");
      }
    }
    if (nCards !== 4) fail("expected 4 cards");
    if (caption !== "Sentences written with AI.") fail("expected the AI caption, got: " + caption);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-15 (re-check TC-4): correct spelling answer accepted, public build ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-15/TC-4: correct spelling answer accepted (public) ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(400);
    const card = page.locator('.practice-card').nth(0);
    await card.locator('.practice-answer').fill('necessary');
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const isDone = (await card.getAttribute('class') || '').includes('done');
    if (!isDone) fail("card should be marked done after the correct exact answer");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-15 (re-check TC-7): confusion card exact-match-only, public build ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-15/TC-7: confusion exact-match-only (public) ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(400);
    const card = page.locator('.practice-card:has(.tag)').first();
    await card.locator('.practice-answer').fill('there');
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const doneAfterWrong = (await card.getAttribute('class') || '').includes('done');
    if (doneAfterWrong) fail("the phonetically-identical WRONG pair member ('there') must not be accepted");
    await card.locator('.practice-answer').fill('their');
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const doneAfterCorrect = (await card.getAttribute('class') || '').includes('done');
    if (!doneAfterCorrect) fail("the correct pair member ('their') should be accepted");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-9: session budget already exhausted -> template fallback, zero requests ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid', { cost: 0.20, tokens: 100000, calls: 5 });
    console.log("=== TC-9: budget exhausted -> template fallback ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const caption = await page.textContent('#practiceCaption');
    const nCards = await page.locator('.practice-card').count();
    const calls = await page.evaluate(() => window.__fetchCalls.length);
    const sentences = await page.locator('.practice-card .sentence').allTextContents();
    console.log({ caption, nCards, calls });
    if (calls !== 0) fail("no Worker request should be attempted once the session budget is used up");
    if (nCards !== 4) fail("templates should still fill a full round");
    if (caption !== "AI unavailable — sentences made from built-in templates.") fail("expected the honest fallback caption, got: " + caption);
    if (sentences.some(s => s.indexOf('____') === -1)) fail("every template card must still show a blank");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-10: Worker returns an HTTP error -> template fallback within a few seconds,
  //            with a plain-language note, no hang ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'error');
    console.log("=== TC-10: Worker error -> template fallback, no hang ===");
    const start = Date.now();
    await page.click('#btnGeneratePractice');
    await page.waitForSelector('.practice-card', { timeout: 5000 }).catch(() => {});
    const elapsedMs = Date.now() - start;
    const caption = await page.textContent('#practiceCaption');
    const nCards = await page.locator('.practice-card').count();
    const banner = await page.textContent('#practiceBanner');
    console.log({ elapsedMs, caption, nCards, banner: (banner || '').trim() });
    if (elapsedMs >= 5000) fail("template fallback should clear within 5s of a Worker error, took " + elapsedMs + "ms");
    if (nCards !== 4) fail("expected a full template round after the Worker error");
    if (!/couldn.?t reach the sentence writer/i.test(banner || '')) fail("expected a plain-language note about the Worker error, got: " + banner);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- backwards compatibility: a real visitor's PRE-feature localStorage was a bare
  //     array (not the new {sessions, wordErrors, ...} object) -- must still load cleanly
  //     and the practice button should correctly stay disabled (no wordErrors yet) ---
  {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript((oldFormatJson) => {
      localStorage.setItem('secondlook_sessions_v1', oldFormatJson);
    }, JSON.stringify(SEED.sessions));
    await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
    await page.waitForTimeout(150);
    await page.click('[data-view="progress"]');
    await page.waitForTimeout(100);
    console.log("=== backwards-compat: old bare-array localStorage shape ===");
    const disabled = await page.getAttribute('#btnGeneratePractice', 'disabled');
    const statGrid = await page.textContent('#statGrid');
    console.log({ disabled: disabled !== null, statGridMentionsOldSession: /paragraph/i.test(statGrid || '') });
    if (disabled === null) fail("with no wordErrors yet (old data shape), the button should still be disabled");
    if (!/paragraph/i.test(statGrid || '')) fail("old session history should still load and render normally");
    if (errors.length) fail("page errors loading the old data shape: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
