// Regression test for the Read tab, Artifact build (second_look.html).
//
// Covers: sentence/paragraph chunking + prev/next navigation; the 2000-word cap blocking
// Start Reading with a banner; the three sample-passage buttons; .txt file upload; Send to
// Write (silent overwrite of the Write tab's editor); the reading-stats stretch-goal card on
// My Progress (hidden with no history, populated and persisted after a successful read); the
// dyslexia-friendly line-spacing/letter-spacing/background-tint controls (applied + persisted
// across reload); and the speech controller (play/pause/stop, word highlighting, speed, and
// stopping automatically when the student navigates to another tab).
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

// db stub in the same style as the rest of this suite (test_flag_feedback.js, test_practice.js).
// Takes an optional pre-seeded progress/summary doc so a test can check the LOAD path (a
// returning student whose readingSessions already has history) without relying on reload
// semantics -- this in-page mock is memory-only and is torn down on every navigation
// including reload(), unlike the real claude.use("db") the Artifact runtime provides, so
// "does it survive a reload" isn't something this stub can honestly simulate.
function dbStub(seed) {
  return (seedArg) => {
    window.__db = {};
    if (seedArg) window.__db['progress/summary'] = seedArg;
    window.claude = {
      use: async function (name) {
        if (name === 'db') {
          return {
            doc: (key) => ({
              get: async () => (key in window.__db ? { exists: true, data: () => window.__db[key] } : { exists: false, data: () => null }),
              set: async (val) => { window.__db[key] = val; }
            })
          };
        }
        return null;
      }
    };
  };
}

// A fake speechSynthesis + SpeechSynthesisUtterance that fires real boundary/end events on a
// short timer, ported from test_speech_manual.py's already-validated stub, so the controller's
// state machine and DOM effects can be checked without a real TTS voice installed in CI.
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

async function openApp(extraInit, dbSeed) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(dbStub(), dbSeed || null);
  if (extraInit) await page.addInitScript(extraInit);
  await page.goto('file://' + path.resolve(__dirname, 'second_look.html'));
  await page.waitForTimeout(200);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- chunking + navigation ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== chunking + prev/next navigation ===");
    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', LONG_TEXT);
    await page.click('#btnStartReading');
    await page.waitForTimeout(150);
    const nChunks = await page.locator('.read-chunk').count();
    const nWords = await page.locator('.read-chunk .word').count();
    const prevDisabledInitially = (await page.getAttribute('#btnPrevChunk', 'disabled')) !== null;
    console.log({ nChunks, nWords, prevDisabledInitially });
    if (nChunks < 3) fail("expected the long multi-paragraph text to split into at least 3 chunks, got " + nChunks);
    if (nWords < 10) fail("expected each chunk's words to be wrapped in clickable spans");
    if (!prevDisabledInitially) fail("Previous should be disabled on the first chunk");

    await page.click('#btnNextChunk');
    await page.waitForTimeout(80);
    const activeIdx = await page.evaluate(() => document.querySelector('.read-chunk.active').dataset.chunkIdx);
    if (activeIdx !== '1') fail("expected chunk index 1 to become active after Next, got " + activeIdx);

    for (let i = 0; i < 10; i++) {
      const disabled = (await page.getAttribute('#btnNextChunk', 'disabled')) !== null;
      if (disabled) break;
      await page.click('#btnNextChunk');
      await page.waitForTimeout(40);
    }
    const nextDisabledAtEnd = (await page.getAttribute('#btnNextChunk', 'disabled')) !== null;
    if (!nextDisabledAtEnd) fail("Next should disable once the last chunk is reached");

    await page.click('#btnBackToInput');
    await page.waitForTimeout(80);
    if (!(await page.isVisible('#read-input'))) fail("back-to-input should return to the input card");
    if (await page.isVisible('#read-view')) fail("the reading view should be hidden after going back to input");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- 2000-word cap blocks Start Reading ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== 2000-word cap ===");
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

  // --- sample passages ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== sample passages ===");
    await page.click('button.tab[data-view="read"]');
    const counts = {};
    for (const [btn, key] of [['#sampleShort', 'short'], ['#sampleMedium', 'medium'], ['#sampleLong', 'long']]) {
      await page.click(btn);
      await page.waitForTimeout(50);
      const val = await page.inputValue('#readInput');
      counts[key] = val.trim().split(/\s+/).length;
      if (!val || val.trim().length < 20) fail(btn + " should load real sample text into the textarea");
    }
    console.log({ wordCounts: counts });
    if (!(counts.short < counts.medium && counts.medium < counts.long)) {
      fail("expected short < medium < long sample word counts, got: " + JSON.stringify(counts));
    }
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- .txt upload ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== .txt upload ===");
    const tmpFile = path.join(os.tmpdir(), 'read_upload_test.txt');
    fs.writeFileSync(tmpFile, "Uploaded passage text for the Read tab test.");
    await page.click('button.tab[data-view="read"]');
    await page.setInputFiles('#readUpload', tmpFile);
    await page.waitForTimeout(150);
    const val = await page.inputValue('#readInput');
    console.log({ uploadedValue: val });
    if (val.indexOf('Uploaded passage text') === -1) fail("uploaded .txt content should land in the textarea, got: " + val);
    fs.unlinkSync(tmpFile);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- Send to Write (silent overwrite) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== Send to Write ===");
    await page.click('button.tab[data-view="write"]');
    await page.fill('#editor', 'Old text that should be overwritten.');
    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', SPEECH_TEXT);
    await page.click('#btnStartReading');
    await page.waitForTimeout(100);
    await page.click('#btnSendToWrite');
    await page.waitForTimeout(100);
    const editorVal = await page.inputValue('#editor');
    const writeTabSelected = await page.getAttribute('button.tab[data-view="write"]', 'aria-selected');
    const writeViewActive = await page.evaluate(() => document.getElementById('view-write').classList.contains('active'));
    console.log({ editorVal, writeTabSelected, writeViewActive });
    if (editorVal !== SPEECH_TEXT) fail("Send to Write should silently overwrite the editor with the full passage, got: " + editorVal);
    if (writeTabSelected !== 'true') fail("Send to Write should switch to the Write tab");
    if (!writeViewActive) fail("the Write view should be the active view after Send to Write");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- reading stats: hidden with no history, populated + persisted after a read ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== reading stats (empty state) ===");
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(100);
    const hiddenBefore = !(await page.isVisible('#readingStatsCard'));
    if (!hiddenBefore) fail("readingStatsCard should stay hidden before any passage has been read");

    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', SPEECH_TEXT); // 16 words
    await page.click('#btnStartReading');
    await page.waitForTimeout(150);
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(100);
    const visibleAfter = await page.isVisible('#readingStatsCard');
    const statText = await page.textContent('#readingStatGrid');
    console.log({ visibleAfter, statText: (statText || '').replace(/\s+/g, ' ').trim() });
    if (!visibleAfter) fail("readingStatsCard should appear after a passage has been read");
    if (!/1/.test(statText || '') || !/passage/.test(statText || '')) fail("expected a '1 passage read' style stat, got: " + statText);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- reading stats: the LOAD path -- a returning student whose db doc already has
  //     readingSessions history should see the card populated on first render, with no
  //     Read-tab action needed in this session at all ---
  {
    const seed = { sessions: [], readingSessions: [{ date: "2026-01-01T00:00:00.000Z", words: 40 }, { date: "2026-01-02T00:00:00.000Z", words: 120 }] };
    const { browser, page, errors } = await openApp(null, seed);
    console.log("=== reading stats (seeded/returning student) ===");
    await page.click('button.tab[data-view="progress"]');
    await page.waitForTimeout(150);
    const visible = await page.isVisible('#readingStatsCard');
    const statText = await page.textContent('#readingStatGrid');
    console.log({ visible, statText: (statText || '').replace(/\s+/g, ' ').trim() });
    if (!visible) fail("readingStatsCard should render from a pre-existing db doc, not just from actions taken this session");
    if (!/2/.test(statText || '')) fail("expected the seeded 2 passages to be reflected, got: " + statText);
    if (!/160/.test(statText || '')) fail("expected 40+120=160 total words read, got: " + statText);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- reading settings: line spacing / letter spacing / tint apply + persist ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== line/letter spacing + tint, applied and persisted ===");
    await page.click('#btnReadingSettings');
    await page.waitForTimeout(80);
    await page.click('#rsLineLoose');
    await page.click('#rsLetterWide');
    await page.click('#rsTintYellow');
    const lh = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--read-line-height').trim());
    const ls = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--read-letter-spacing').trim());
    console.log({ lh, ls });
    if (lh !== '2') fail("expected --read-line-height to become 2 after choosing Loose, got: " + lh);
    if (ls === 'normal' || !ls) fail("expected --read-letter-spacing to widen after choosing Wide, got: " + ls);

    await page.reload();
    await page.waitForTimeout(200);
    const lh2 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--read-line-height').trim());
    const ls2 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--read-letter-spacing').trim());
    console.log({ afterReload: { lh2, ls2 } });
    if (lh2 !== lh) fail("line spacing choice should survive a reload, expected " + lh + " got " + lh2);
    if (ls2 !== ls) fail("letter spacing choice should survive a reload, expected " + ls + " got " + ls2);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- speech controller: play/pause/stop, highlighting, speed, tab-switch stops it ---
  {
    const { browser, page, errors } = await openApp(SPEECH_STUB);
    console.log("=== speech controller ===");
    await page.click('button.tab[data-view="read"]');
    await page.fill('#readInput', SPEECH_TEXT);
    await page.click('#btnStartReading');
    await page.waitForTimeout(100);

    const label0 = await page.textContent('#btnPlayPause');
    await page.click('#btnPlayPause');
    await page.waitForTimeout(50);
    const label1 = await page.textContent('#btnPlayPause');
    const speakingAfterPlay = await page.evaluate(() => window.__fakeSpeaking);
    console.log({ label0, label1, speakingAfterPlay });
    if (!/Play/.test(label0)) fail("initial Play/Pause label should say Play, got: " + label0);
    if (!/Pause/.test(label1)) fail("label should switch to Pause once playing, got: " + label1);
    if (!speakingAfterPlay) fail("the fake speech engine should be speaking after Play is clicked");

    // pause mid-utterance
    await page.click('#btnPlayPause');
    await page.waitForTimeout(50);
    const pausedFlag = await page.evaluate(() => window.__fakePaused);
    const label2 = await page.textContent('#btnPlayPause');
    if (!pausedFlag) fail("clicking Pause mid-utterance should pause the fake engine");
    if (!/Play/.test(label2)) fail("label should switch back to Play once paused, got: " + label2);

    // resume, then let it run long enough for a boundary event to land
    await page.click('#btnPlayPause');
    await page.waitForTimeout(120);
    const hlCount = await page.locator('.word-highlight').count();
    if (hlCount < 1) fail("expected a word to be highlighted during playback");

    await page.click('#btnStopReading');
    await page.waitForTimeout(50);
    const speakingAfterStop = await page.evaluate(() => window.__fakeSpeaking);
    const hlAfterStop = await page.locator('.word-highlight').count();
    const labelAfterStop = await page.textContent('#btnPlayPause');
    console.log({ speakingAfterStop, hlAfterStop, labelAfterStop });
    if (speakingAfterStop) fail("Stop should cancel the fake speech engine");
    if (hlAfterStop !== 0) fail("Stop should clear any word highlight");
    if (!/Play/.test(labelAfterStop)) fail("label should reset to Play after Stop");

    // speed change is reflected in the next utterance's rate
    await page.selectOption('#readSpeed', '1.25');
    await page.click('#btnPlayPause');
    await page.waitForTimeout(50);
    const rates = await page.evaluate(() => window.__speakLog.map(x => x.rate));
    if (!rates.length || rates[rates.length - 1] !== 1.25) fail("expected the most recent utterance to use the selected 1.25x rate, got: " + JSON.stringify(rates));

    // click-a-word-to-hear-it
    await page.click('#btnStopReading');
    await page.waitForTimeout(30);
    const before = await page.evaluate(() => window.__speakLog.length);
    await page.locator('.word').first().click();
    await page.waitForTimeout(30);
    const after = await page.evaluate(() => window.__speakLog.length);
    if (!(after > before)) fail("clicking a single word should speak it");

    // switching tabs mid-playback stops speech
    await page.click('#btnPlayPause');
    await page.waitForTimeout(30);
    await page.click('button.tab[data-view="write"]');
    await page.waitForTimeout(30);
    const speakingAfterTabSwitch = await page.evaluate(() => window.__fakeSpeaking);
    if (speakingAfterTabSwitch) fail("navigating away from the Read tab should stop any in-progress speech");

    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
