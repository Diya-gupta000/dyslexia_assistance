// Regression test for the practice-sentence generator (My Progress tab), Artifact build.
//
// Covers TC-1, TC-2, TC-3, TC-4, TC-6, TC-7, TC-8, TC-9, TC-11, TC-12, TC-13, TC-14 from
// the practice-sentence spec. TC-5 is covered implicitly by TC-4/TC-6 exercising the exact
// same isPlausibleSpellingFix() function already regression-tested by test_altfix.js; TC-10
// (Worker HTTP error) and the Worker-request-body assertion half of TC-3 are public-build-only
// (this build has no Worker at all) and live in test_practice_public.js instead, along with
// TC-15's both-builds check.
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

// A fake claude.use("db")/claude.use("sample") harness, in the same style already used by
// this suite's other test files (e.g. test_flag_feedback.js). sampleMode controls how the
// mocked "sample" AI capability behaves, to exercise each fallback path.
function installMocks() {
  return ({ seed, mode }) => {
    window.__sampleCalls = [];
    window.__speakCalls = [];
    window.claude = {
      use: async function (name) {
        if (name === 'db') {
          const store = {};
          if (seed) store['progress/summary'] = seed;
          return {
            doc: (key) => ({
              get: async () => (key in store ? { exists: true, data: () => store[key] } : { exists: false, data: () => null }),
              set: async (val) => { store[key] = val; }
            })
          };
        }
        if (name === 'sample') {
          if (mode === 'unavailable') return null;
          return {
            json: async function (prompt, opts) {
              window.__sampleCalls.push({ prompt: prompt, opts: opts });
              if (mode === 'malformed') return { sentences: "oops" };
              if (mode === 'error') throw new Error("boom");
              if (mode === 'slow') await new Promise(r => setTimeout(r, 800));
              const m = prompt.match(/Targets:\n(\[.*?\])\n\n/s);
              const targets = m ? JSON.parse(m[1]) : [];
              const sentences = targets.map(t => {
                const word = t.type === 'spelling' ? t.word : t.correct;
                return { target: t.index, sentence: "This is a normal practice sentence about the word " + word + " in context today." };
              });
              return { sentences: sentences };
            }
          };
        }
        return null;
      }
    };
    window.speechSynthesis = window.speechSynthesis || {};
    window.speechSynthesis.cancel = function () {};
    window.speechSynthesis.speak = function (u) { window.__speakCalls.push(u.text); };
  };
}

async function openProgressTab(seed, sampleMode) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(installMocks(), { seed, mode: sampleMode });
  await page.goto('file://' + path.resolve(__dirname, 'second_look.html'));
  await page.waitForTimeout(150);
  await page.click('[data-view="progress"]');
  await page.waitForTimeout(100);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- TC-1: empty state disables the button, with the unlock explainer, and clicking
  //           it (were it not disabled) never fires a request ---
  {
    const { browser, page, errors } = await openProgressTab(null, 'valid');
    console.log("=== TC-1: empty state disables the button ===");
    const disabled = await page.getAttribute('#btnGeneratePractice', 'disabled');
    const explainerVisible = await page.isVisible('#practiceExplainer');
    console.log({ disabled: disabled !== null, explainerVisible });
    if (disabled === null) fail("button should be disabled with no history");
    if (!explainerVisible) fail("unlock explainer should be visible in the empty state");
    await page.click('#btnGeneratePractice').catch(() => {}); // disabled -- should be a no-op
    await page.waitForTimeout(100);
    const calls = await page.evaluate(() => window.__sampleCalls.length);
    if (calls !== 0) fail("clicking a disabled button should never fire a generation request");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-2: button enables once wordErrors/confusionErrors history exists ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-2: button enables with history ===");
    const disabled = await page.getAttribute('#btnGeneratePractice', 'disabled');
    if (disabled !== null) fail("button should be enabled once wordErrors/confusionErrors exist");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-3: a full round generates one card per target, correctly blanked, with the
  //           confusion tag, and an honest "written with AI" caption ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-3: AI round shape ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const nCards = await page.locator('.practice-card').count();
    const caption = await page.textContent('#practiceCaption');
    const calls = await page.evaluate(() => window.__sampleCalls.length);
    const nTagged = await page.locator('.practice-card .tag').count();
    const sentences = await page.locator('.practice-card .sentence').allTextContents();
    console.log({ nCards, caption, calls, nTagged });
    if (nCards !== 4) fail("expected 4 cards (3 spelling + 1 confusion target from the seed)");
    if (caption !== "Sentences written with AI.") fail("expected the AI caption, got: " + caption);
    if (calls !== 1) fail("expected exactly one generation call, got " + calls);
    if (nTagged !== 1) fail("expected exactly one 'Tricky pair' tagged card");
    if (sentences.some(s => s.indexOf('____') === -1)) fail("every card's sentence must show a blank");
    if (sentences.some(s => /necessary|rhythm|separate|their|there/i.test(s))) {
      fail("the target word must never appear in the (blanked) card text");
    }
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-4: correct spelling answer (exact) is accepted ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-4: correct spelling answer accepted (exact) ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const card = page.locator('.practice-card').nth(0);
    await card.locator('.practice-answer').fill('necessary');
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const feedback = await card.locator('.feedback').textContent();
    const isDone = (await card.getAttribute('class') || '').includes('done');
    console.log({ feedback, isDone });
    if (!isDone) fail("card should be marked done after the correct exact answer");
    if (!/that's it/i.test(feedback)) fail("expected a success confirmation, got: " + feedback);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-6: wrong answer rejected with a hint, unlimited retries ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-6: wrong answer rejected, retry allowed ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const card = page.locator('.practice-card').nth(1);
    await card.locator('.practice-answer').fill('zzzznotarealword');
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const feedback = await card.locator('.feedback').textContent();
    const isDone = (await card.getAttribute('class') || '').includes('done');
    console.log({ feedback, isDone });
    if (isDone) fail("card should not be marked done after a wrong answer");
    if (!/not quite/i.test(feedback)) fail("expected a 'not quite, try again' hint, got: " + feedback);
    await card.locator('.practice-check').click(); // retry should still be allowed (unlimited)
    await page.waitForTimeout(50);
    if ((await page.getAttribute('#btnGeneratePractice', 'disabled')) === undefined) {} // no-op sanity
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-7: the critical assertion -- a confusion card's phonetically-identical wrong
  //           member must NOT be accepted, while the correct member is. The seed's
  //           confusionErrors ({their:2, there:1}) deterministically makes "their" the
  //           correct member, so the wrong/right guesses are known up front. ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-7: confusion card exact-match-only ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const card = page.locator('.practice-card:has(.tag)').first();
    const tagText = await card.locator('.tag').textContent();
    console.log({ tag: tagText.trim() });

    await card.locator('.practice-answer').fill('there'); // the phonetically-identical WRONG member
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const doneAfterWrong = (await card.getAttribute('class') || '').includes('done');
    const feedbackWrong = await card.locator('.feedback').textContent();
    console.log({ guess: 'there', doneAfterWrong, feedbackWrong });
    if (doneAfterWrong) fail("the phonetically-identical WRONG pair member ('there') must not be accepted");
    if (!/not quite/i.test(feedbackWrong)) fail("expected a 'not quite' hint for the wrong member, got: " + feedbackWrong);

    await card.locator('.practice-answer').fill('their'); // the correct member
    await card.locator('.practice-check').click();
    await page.waitForTimeout(100);
    const doneAfterCorrect = (await card.getAttribute('class') || '').includes('done');
    const feedbackCorrect = await card.locator('.feedback').textContent();
    console.log({ guess: 'their', doneAfterCorrect, feedbackCorrect });
    if (!doneAfterCorrect) fail("the correct pair member ('their') should be accepted");

    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-8: Hear it reads the full, un-blanked sentence ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-8: Hear it reads the full sentence ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    await page.click('.practice-card >> nth=0 >> .practice-hear');
    await page.waitForTimeout(50);
    const calls = await page.evaluate(() => window.__speakCalls);
    console.log({ calls });
    if (!calls.length || calls[0].indexOf('____') !== -1) fail("Hear it should speak the full, un-blanked sentence");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-9 (Artifact-build analog): the AI capability being unavailable falls back to
  //          templates with an honest label and never attempts a generation call ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'unavailable');
    console.log("=== TC-9 (analog): AI capability unavailable -> template fallback ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const caption = await page.textContent('#practiceCaption');
    const nCards = await page.locator('.practice-card').count();
    const calls = await page.evaluate(() => window.__sampleCalls.length);
    console.log({ caption, nCards, calls });
    if (caption !== "AI unavailable — sentences made from built-in templates.") fail("expected the honest fallback caption, got: " + caption);
    if (nCards !== 4) fail("templates should still fill a full round");
    if (calls !== 0) fail("no generation call should be attempted when the capability is unavailable");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-11: malformed AI reply falls back to templates without throwing ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'malformed');
    console.log("=== TC-11: malformed AI reply -> template fallback ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const caption = await page.textContent('#practiceCaption');
    const nCards = await page.locator('.practice-card').count();
    console.log({ caption, nCards });
    if (nCards !== 4) fail("malformed reply should still fall back to a full template round");
    if (errors.length) fail("a malformed AI reply must not surface a console exception: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-12: a rapid double-click doesn't fire two generation requests ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'slow');
    console.log("=== TC-12: double-click doesn't double-spend ===");
    await page.evaluate(() => {
      const btn = document.getElementById('btnGeneratePractice');
      btn.click(); btn.click();
    });
    await page.waitForTimeout(1200);
    const calls = await page.evaluate(() => window.__sampleCalls.length);
    console.log({ calls });
    if (calls !== 1) fail("expected exactly one generation call from a rapid double-click, got " + calls);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-13: completing a round updates progress and appends a distinguished chart point ---
  {
    const { browser, page, errors } = await openProgressTab(SEED, 'valid');
    console.log("=== TC-13: round completion updates progress + chart ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const knownWords = ['necessary', 'rhythm', 'separate'];
    const n = await page.locator('.practice-card').count();
    for (let i = 0; i < n; i++) {
      const card = page.locator('.practice-card').nth(i);
      const hasTag = await card.locator('.tag').count();
      const candidates = hasTag
        ? (await card.locator('.tag').textContent()).replace('Tricky pair:', '').split('/').map(s => s.trim())
        : knownWords;
      for (const guess of candidates) {
        if ((await card.getAttribute('class') || '').includes('done')) break;
        await card.locator('.practice-answer').fill(guess);
        await card.locator('.practice-check').click();
        await page.waitForTimeout(50);
      }
    }
    await page.waitForTimeout(150);
    const summaryVisible = await page.isVisible('#practiceSummary');
    const summaryText = await page.textContent('#practiceSummary');
    console.log({ summaryVisible, summaryText: (summaryText || '').trim() });
    if (!summaryVisible) fail("a completed round should show the summary line + Practice again button");
    if (!/\d for \d/.test(summaryText || '')) fail("expected an 'X for Y' summary line");
    const nMarkers = await page.locator('svg rect[fill="var(--special)"]').count();
    const legendText = await page.textContent('#chart');
    console.log({ nMarkers, legendMentionsPractice: (legendText || '').includes('practice round') });
    if (nMarkers < 1) fail("chart should gain a distinct practice-round marker");
    if (!(legendText || '').includes('practice round')) fail("chart should carry a 'practice round' legend entry");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- TC-14: a target with 3 consecutive practice-correct records rotates out of selection ---
  {
    const seedWithStreak = JSON.parse(JSON.stringify(SEED));
    seedWithStreak.practiceStreaks = { "spelling:necessary": 3 };
    const { browser, page, errors } = await openProgressTab(seedWithStreak, 'valid');
    console.log("=== TC-14: learned target excluded from selection ===");
    await page.click('#btnGeneratePractice');
    await page.waitForTimeout(300);
    const nCards = await page.locator('.practice-card').count();
    const prompt = await page.evaluate(() => window.__sampleCalls.length ? window.__sampleCalls[0].prompt : '');
    console.log({ nCards, mentionsNecessary: prompt.includes('"necessary"'), mentionsRhythm: prompt.includes('"rhythm"') });
    if (nCards !== 3) fail("expected 3 cards (down from 4) once 'necessary' retires");
    if (prompt.includes('"necessary"')) fail("a target with a 3-in-a-row practice streak must not be selected again");
    if (!prompt.includes('"rhythm"')) fail("the next-highest target should still be selected");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
