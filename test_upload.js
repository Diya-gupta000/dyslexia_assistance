// Regression test for the Write tab's file upload (second_look.html, the Artifact build).
//
// Covers the feature that replaced the Read tab: a button to upload a .txt file, a PDF, or
// a photo (JPG/PNG), which extracts the text and drops it straight into the editor -- always
// silently overwriting whatever was already there, per the project's own decision (a student
// uploading a file is treated the same as if they'd pasted it in themselves). Also covers the
// "auto-limit the deeper AI check to ~2000 words on a long document" behavior that replaced
// the old Read-tab-only 2000-word cap, and confirms the Read tab itself is fully gone.
//
// The PDF case uses fixture_upload_test.pdf (a real two-line PDF built with reportlab) and
// genuinely exercises pdf.js loaded from its real CDN -- this is a real network dependency,
// same tradeoff already accepted for the OpenDyslexic font CDN load, and confirmed working
// against the live CDN as of this test run. The JPG case can't hit a real AI vision endpoint
// from a static file test, so window.claude.use("sample") is stubbed -- this test only proves
// the upload plumbing (file -> data URL -> sample.json call -> editor) works; it does NOT
// prove the real Artifact runtime's sample.json() actually accepts an image the way this code
// assumes, which remains unverified (see the comment left in build.py's extractImageText()).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLAUDE_STUB = () => {
  window.__samplePrompts = [];
  window.claude = {
    use: async function (kind) {
      if (kind === 'sample') {
        return {
          json: async function (prompt, opts) {
            window.__samplePrompts.push({ prompt: prompt, opts: opts });
            if (opts && opts.image) return { text: "Transcribed photo text goes here." };
            return []; // deeper writing check: no AI findings, keeps these tests focused on upload/limit behavior
          }
        };
      }
      throw new Error('not stubbed: ' + kind);
    }
  };
};

async function openApp(extraInit) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (extraInit) await page.addInitScript(extraInit);
  await page.goto('file://' + path.resolve(__dirname, 'second_look.html'));
  await page.waitForTimeout(200);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- Read tab is fully gone ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== Read tab fully removed ===");
    const tabCount = await page.locator('.tab[data-view="read"]').count();
    const viewCount = await page.locator('#view-read').count();
    const statsCardCount = await page.locator('#readingStatsCard').count();
    console.log({ tabCount, viewCount, statsCardCount });
    if (tabCount !== 0) fail("the Read tab button should no longer exist");
    if (viewCount !== 0) fail("#view-read should no longer exist");
    if (statsCardCount !== 0) fail("#readingStatsCard should no longer exist");
    // font/size Aa panel controls (predate the Read tab) should still be there
    const fontBtns = await page.locator('#rsFontAtkinson, #rsFontOpenDyslexic, #rsSizeUp, #rsSizeDown').count();
    if (fontBtns !== 4) fail("expected the original font/size Aa panel controls to still exist, found " + fontBtns);
    // but the Read-tab-only Aa panel extras should not
    const readOnlyRs = await page.locator('#rsLineNormal, #rsLetterNormal, #rsTintCream').count();
    if (readOnlyRs !== 0) fail("Read-tab-only line/letter/tint Aa panel controls should be gone");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- .txt upload: populates the editor, updates wordcount, silently overwrites existing text ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== .txt upload (silent overwrite) ===");
    await page.fill('#editor', 'old text that should be replaced without any confirmation prompt');
    const tmpTxt = path.join(os.tmpdir(), 'upload_test.txt');
    fs.writeFileSync(tmpTxt, "Uploaded plain text content for the test.");
    await page.setInputFiles('#fileUpload', tmpTxt);
    await page.waitForTimeout(150);
    const editorVal = await page.inputValue('#editor');
    const wordcount = await page.textContent('#wordcount');
    const banner = await page.textContent('#uploadBanner');
    console.log({ editorVal, wordcount: (wordcount||'').trim(), banner: (banner||'').trim() });
    if (editorVal !== "Uploaded plain text content for the test.") fail("expected the .txt content to silently replace the editor, got: " + editorVal);
    if (!/7 words/.test(wordcount||'')) fail("expected the wordcount to update after upload, got: " + wordcount);
    if (!/Loaded/.test(banner||'')) fail("expected an upload confirmation banner, got: " + banner);
    fs.unlinkSync(tmpTxt);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- PDF upload: real pdf.js extraction against the live CDN ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== PDF upload (real pdf.js extraction) ===");
    await page.setInputFiles('#fileUpload', path.resolve(__dirname, 'fixture_upload_test.pdf'));
    await page.waitForTimeout(5000); // CDN script load + PDF parse
    const editorVal = await page.inputValue('#editor');
    const banner = await page.textContent('#uploadBanner');
    console.log({ editorVal, banner: (banner||'').trim() });
    if (editorVal.indexOf('Hello from a test PDF upload') === -1) fail("expected the PDF's real text to be extracted into the editor, got: " + editorVal);
    if (editorVal.indexOf('second line of text') === -1) fail("expected both lines of the PDF to be extracted, got: " + editorVal);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- unsupported file type: clear message, editor left untouched ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== unsupported file type ===");
    await page.fill('#editor', 'unchanged');
    const tmpBad = path.join(os.tmpdir(), 'upload_test.xyz');
    fs.writeFileSync(tmpBad, "whatever");
    await page.setInputFiles('#fileUpload', tmpBad);
    await page.waitForTimeout(150);
    const editorVal = await page.inputValue('#editor');
    const banner = await page.textContent('#uploadBanner');
    console.log({ editorVal, banner: (banner||'').trim() });
    if (editorVal !== 'unchanged') fail("an unsupported file type should not touch the editor, got: " + editorVal);
    if (!/isn't supported/.test(banner||'')) fail("expected an unsupported-file-type banner, got: " + banner);
    fs.unlinkSync(tmpBad);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- JPG upload: AI-vision extraction path (window.claude.use stubbed -- see file header) ---
  {
    const { browser, page, errors } = await openApp(CLAUDE_STUB);
    console.log("=== JPG upload (stubbed AI vision) ===");
    const tmpImg = path.join(os.tmpdir(), 'upload_test.jpg');
    fs.writeFileSync(tmpImg, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0]));
    await page.setInputFiles('#fileUpload', tmpImg);
    await page.waitForTimeout(300);
    const editorVal = await page.inputValue('#editor');
    const sawImageCall = await page.evaluate(() => (window.__samplePrompts||[]).some(function(p){ return p.opts && p.opts.image; }));
    console.log({ editorVal, sawImageCall });
    if (editorVal !== "Transcribed photo text goes here.") fail("expected the stubbed vision transcription in the editor, got: " + editorVal);
    if (!sawImageCall) fail("expected sample.json() to have been called with an image option");
    fs.unlinkSync(tmpImg);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- deeper AI check auto-limits to ~2000 words on a long document; local check is unaffected ---
  {
    const { browser, page, errors } = await openApp(CLAUDE_STUB);
    console.log("=== AI check auto-limit on long documents ===");
    const longText = Array(2500).fill('word').join(' ');
    await page.fill('#editor', longText);
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const banner = await page.textContent('#banners');
    const promptLen = await page.evaluate(() => {
      var last = (window.__samplePrompts||[]).slice(-1)[0];
      return last ? last.prompt.length : -1;
    });
    console.log({ banner: (banner||'').trim(), promptLen });
    if (!/first ~2,000 words/.test(banner||'')) fail("expected a truncation notice for a >2000-word document, got: " + banner);
    if (promptLen < 0) fail("expected the AI pass to have run at all");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- a short document does NOT show the truncation notice ---
  {
    const { browser, page, errors } = await openApp(CLAUDE_STUB);
    console.log("=== short document: no truncation notice ===");
    await page.fill('#editor', 'Just a short paragraph with a normal number of words in it.');
    await page.click('#btnCheck');
    await page.waitForTimeout(300);
    const banner = await page.textContent('#banners');
    console.log({ banner: (banner||'').trim() });
    if (/2,000 words/.test(banner||'')) fail("a short document should not show the long-document truncation notice, got: " + banner);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
