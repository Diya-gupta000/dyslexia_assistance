// Locks in the wordlist fix: the local checker's "is this a real word" lookup
// (DICTIONARY/DICT_SET) must cover ordinary-but-less-common vocabulary like
// "tutor"/"mentor" -- the exact bug a user hit (local check said "tutor" isn't
// a word it knows, and suggested "auto"). At the same time, the SEPARATE
// suggestion engine (COMMON_WORDS/BY_LENGTH/PHONETIC_MAP) must stay on the
// smaller curated list, so a badly garbled word ("nitmers") still falls
// through to the honest "no suggestion -> try saying it" path instead of
// guessing some obscure dictionary word ("niter") just because the full
// dictionary made it reachable by edit distance. See test_prs.js's Test 2
// ("nitmers") for the suggestion-engine side of this same guarantee.
const { chromium } = require('playwright');
const path = require('path');

const TEXT = "Why do you want to become a volunteer tutor? I recognized the importance of mentoring students and want to help as a mentor myself.";

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let allOk = true;

  for (const [label, file] of [["second_look.html (Artifact)", "second_look.html"], ["index.html (public)", "index.html"]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.claude = {
        use: async (name) => {
          if (name === 'sample') return { json: async () => [] };
          if (name === 'db') return { get: async () => null, set: async () => {} };
          return null;
        }
      };
    });
    await page.goto('file://' + path.resolve(__dirname, file));
    await page.waitForTimeout(150);
    await page.uncheck('#useAI').catch(() => {});
    await page.fill('#editor', TEXT);
    await page.click('#btnCheck');
    await page.waitForTimeout(300);
    const marks = await page.$$eval('#reviewed mark', els => els.map(e => e.textContent.toLowerCase()));

    console.log(`=== ${label} ===`);
    console.log('flagged:', marks);
    const falseFlags = marks.filter(m => m.includes('tutor') || m.includes('mentor'));
    if (falseFlags.length) {
      console.log('FAIL: real, correctly-spelled words were flagged as unknown:', falseFlags);
      allOk = false;
    } else {
      console.log('OK: "tutor"/"mentor"/"mentoring" are recognized as real words');
    }
    if (errors.length) { console.log('PAGE ERRORS:', errors); allOk = false; }
    await page.close();
  }

  await browser.close();
  console.log('\n' + (allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
  process.exit(allOk ? 0 : 1);
})();
