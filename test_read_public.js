// Regression test for the Read tab, public build (public_index.html).
//
// The Read tab makes no AI/Worker calls at all ("$0 cost... no AI, no network call"), so this
// is largely a re-check of test_read.js's scenarios against the standalone public document,
// plus the one thing that's genuinely different between the two builds: reading-stats storage
// is real localStorage here rather than a mocked claude.use("db"), so persistence across an
// actual page reload can (and should) be tested directly, and a returning visitor's pre-feature
// localStorage shape (see test_practice_public.js's equivalent check) must still load cleanly.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const LONG_TEXT = [
  "This is the first paragraph. It is short.",
  Array(4).fill("This is a much longer second paragraph that keeps going and going so that it comfortably exceeds the sixty word threshold used for splitting a single paragraph into more than one chunk via the sentence-level fallback path in the chunker.").join(" "),
  "This is the third and final paragraph, also short.",
].join("\n\n");

const SPEECH_TEXT = "The quick brown fox jumps. Over the lazy dog again and again in the sun.";

const SPEECH_STUB = () => {
  window.__speakLog = [];
  class FakeUtterance {
    constructor(text) { this.text = text; this.rate = 1; this.onboundary = null; this.onend = null; this.onerror = null; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, writable: true, configurable: true });
  window.__fakeSpeaking = false;
  window.__fakePaused = false;
  window.__timers = [];
  const fakeSynth = {
    speak: function (u) {
      window.__speakLog.push({ text: u.text, rate: u.rate });
      window.__fakeSpeaking = true;
      window.__fakePaused = false;
      const words = u.text.split(/\s+/);
      let i = 0;
      function fireNext() {
        if (window.__fakePaused) { window.__timers.push(setTimeout(fireNext, 30)); return; }
        if (!window.__fakeSpeaking) return;
        if (i < words.length) {
          if (u.onboundary) u.onboundary({ charIndex: u.text.indexOf(words[i]), name: 'word' });
          i++;
          window.__timers.push(setTimeout(fireNext, 90));
        } else {
          window.__fakeSpeaking = false;
          if (u.onend) u.onend();
        }
      }
      window.__timers.push(setTimeout(fireNext, 30));
    },
    cancel: function () { window.__fakeSpeaking = false; window.__fakePaused = false; window.__timers.forEach(clearTimeout); window.__timers = []; },
    pause: function () { window.__fakePaused = true; },
    resume: function () { window.__fakePaused = false; },
    getVoices: function () { return []; },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, writable: true, configurable: true });
};

async function openApp(extraInit, seedLocalStorageJson) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (seedLocalStorageJson) {
    await page.addInitScript((json) => { localStorage.setItem('secondlook_sessions_v1', json); }, seedLocalStorageJson);
  }
  if (extraInit) await page.addInitScript(extraInit);
  await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
  await page.waitForTimeout(200);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- chunking + navigation (re-check) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== chunking + prev/next navigation (public) ===");
    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', LONG_TEXT);
    await page.click('#btnStartReading');
    await page.waitForTimeout(150);
    const nChunks = await page.locator('.read-chunk').count();
    const prevDisabledInitially = (await page.getAttribute('#btnPrevChunk', 'disabled')) !== null;
    console.log({ nChunks, prevDisabledInitially });
    if (nChunks < 3) fail("expected the long multi-paragraph text to split into at least 3 chunks, got " + nChunks);
    if (!prevDisabledInitially) fail("Previous should be disabled on the first chunk");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- 2000-word cap (re-check) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== 2000-word cap (public) ===");
    await page.click('button.tab[data-view="read"]');
    const bigText = Array(2001).fill('word').join(' ');
    await page.fill('#readInput', bigText);
    await page.click('#btnStartReading');
    await page.waitForTimeout(100);
    const banner = await page.textContent('#readInputBanner');
    const stillOnInput = await page.isVisible('#read-input');
    console.log({ banner: (banner || '').trim(), stillOnInput });
    if (!/2000-word limit/.test(banner || '')) fail("expected an over-the-limit banner, got: " + banner);
    if (!stillOnInput) fail("should stay on the input screen when over the word cap");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- sample passages + upload + Send to Write (re-check, combined) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== samples, upload, Send to Write (public) ===");
    await page.click('button.tab[data-view="read"]');
    await page.click('#sampleLong');
    await page.waitForTimeout(50);
    const longVal = await page.inputValue('#readInput');
    if (!longVal || longVal.trim().split(/\s+/).length < 150) fail("Sample: Long should load a substantial passage, got " + longVal.trim().split(/\s+/).length + " words");

    const tmpFile = path.join(os.tmpdir(), 'read_upload_test_public.txt');
    fs.writeFileSync(tmpFile, "Uploaded passage text for the public build test.");
    await page.setInputFiles('#readUpload', tmpFile);
    await page.waitForTimeout(150);
    const uploadedVal = await page.inputValue('#readInput');
    if (uploadedVal.indexOf('Uploaded passage text') === -1) fail("uploaded .txt content should replace the textarea, got: " + uploadedVal);
    fs.unlinkSync(tmpFile);

    await page.click('#btnStartReading');
    await page.waitForTimeout(100);
    await page.click('#btnSendToWrite');
    await page.waitForTimeout(100);
    const editorVal = await page.inputValue('#editor');
    const writeViewActive = await page.evaluate(() => document.getElementById('view-write').classList.contains('active'));
    console.log({ editorVal, writeViewActive });
    if (editorVal.indexOf('Uploaded passage text') === -1) fail("Send to Write should hand over the uploaded passage verbatim, got: " + editorVal);
    if (!writeViewActive) fail("Send to Write should switch to the Write view");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- reading stats: real localStorage persistence across an actual reload ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== reading stats: real reload persistence (public) ===");
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(100);
    const hiddenBefore = !(await page.isVisible('#readingStatsCard'));
    if (!hiddenBefore) fail("readingStatsCard should stay hidden before any passage has been read");

    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', SPEECH_TEXT); // 16 words
    await page.click('#btnStartReading');
    await page.waitForTimeout(150);

    await page.reload();
    await page.waitForTimeout(200);
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(100);
    const visibleAfterReload = await page.isVisible('#readingStatsCard');
    const statText = await page.textContent('#readingStatGrid');
    console.log({ visibleAfterReload, statText: (statText || '').replace(/\s+/g, ' ').trim() });
    if (!visibleAfterReload) fail("reading stats should survive a real page reload via localStorage");
    if (!/1/.test(statText || '') || !/passage/.test(statText || '')) fail("expected a '1 passage read' style stat after reload, got: " + statText);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- backwards compatibility: a real visitor's pre-feature bare-array localStorage
  //     shape (see test_practice_public.js's equivalent) should still load cleanly, with no
  //     reading stats shown since that old shape has no readingSessions at all ---
  {
    const oldShape = JSON.stringify([{ date: "2026-01-01T00:00:00.000Z", words: 50, spelling: 1, grammar: 0, punctuation: 0, wordChoice: 1, total: 1, selfFixed: 1, revealed: 0, skipped: 0, helpRequests: 0, aiUsed: false, spellingPairs: [] }]);
    const { browser, page, errors } = await openApp(null, oldShape);
    console.log("=== backwards-compat: old bare-array localStorage (public) ===");
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(100);
    const readingStatsHidden = !(await page.isVisible('#readingStatsCard'));
    const statGridText = await page.textContent('#statGrid');
    console.log({ readingStatsHidden, oldSessionLoaded: /1/.test(statGridText || '') });
    if (!readingStatsHidden) fail("readingStatsCard should stay hidden for an old-format doc with no readingSessions field");
    if (!statGridText || statGridText.indexOf('paragraph') === -1) fail("the old session history should still load and render normally");
    if (errors.length) fail("page errors loading the old data shape: " + errors.join('; '));
    await browser.close();
  }

  // --- speech controller (re-check) ---
  {
    const { browser, page, errors } = await openApp(SPEECH_STUB);
    console.log("=== speech controller (public) ===");
    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', SPEECH_TEXT);
    await page.click('#btnStartReading');
    await page.waitForTimeout(100);

    await page.click('#btnPlayPause');
    await page.waitForTimeout(50);
    const label1 = await page.textContent('#btnPlayPause');
    const speakingAfterPlay = await page.evaluate(() => window.__fakeSpeaking);
    if (!/Pause/.test(label1)) fail("label should switch to Pause once playing, got: " + label1);
    if (!speakingAfterPlay) fail("the fake speech engine should be speaking after Play is clicked");

    await page.waitForTimeout(120);
    const hlCount = await page.locator('.word-highlight').count();
    if (hlCount < 1) fail("expected a word to be highlighted during playback");

    await page.click('#btnStopReading');
    await page.waitForTimeout(50);
    const speakingAfterStop = await page.evaluate(() => window.__fakeSpeaking);
    if (speakingAfterStop) fail("Stop should cancel the fake speech engine");

    await page.click('button.tab[data-view="write"]');
    await page.waitForTimeout(30);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
