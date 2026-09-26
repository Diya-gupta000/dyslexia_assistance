// Regression test for the Write tab's file upload, public build (public_index.html).
//
// .txt and PDF extraction are identical client-side logic to the Artifact build (see
// test_upload.js) so this file re-checks those against the standalone document, plus the
// one thing that's genuinely different: JPG/PNG extraction goes over the network to
// worker.js instead of through window.claude.use("sample"), so fetch() is stubbed here to
// simulate the Worker's response and to confirm the request actually carries an `image`
// field per worker.js's new vision handling. This proves the public build's plumbing is
// wired correctly; it does not re-verify OpenAI's vision API itself (that contract is
// real/documented, unlike the Artifact build's claude.use("sample") image support, which
// remains unverified -- see test_upload.js's file header).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FETCH_STUB = () => {
  window.__fetchCalls = [];
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    if (typeof url === 'string' && url.indexOf('/ai') !== -1) {
      var body = opts && opts.body ? JSON.parse(opts.body) : {};
      window.__fetchCalls.push(body);
      if (body.image) {
        return new Response(JSON.stringify({ text: '{"text":"Transcribed photo text goes here."}', usage: { prompt_tokens: 50, completion_tokens: 10 }, model: 'gpt-5-mini' }), { status: 200 });
      }
      return new Response(JSON.stringify({ text: '[]', usage: { prompt_tokens: 20, completion_tokens: 5 }, model: 'gpt-5-mini' }), { status: 200 });
    }
    return realFetch(url, opts);
  };
};

async function openApp(extraInit) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (extraInit) await page.addInitScript(extraInit);
  await page.goto('file://' + path.resolve(__dirname, 'public_index.html'));
  await page.waitForTimeout(200);
  return { browser, page, errors };
}

(async () => {
  let allOk = true;
  const fail = (msg) => { console.log("FAIL:", msg); allOk = false; };

  // --- Read tab is fully gone (public build) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== Read tab fully removed (public) ===");
    const tabCount = await page.locator('.tab[data-view="read"]').count();
    const viewCount = await page.locator('#view-read').count();
    console.log({ tabCount, viewCount });
    if (tabCount !== 0) fail("the Read tab button should no longer exist");
    if (viewCount !== 0) fail("#view-read should no longer exist");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- .txt upload (re-check) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== .txt upload (public) ===");
    await page.fill('#editor', 'old text');
    const tmpTxt = path.join(os.tmpdir(), 'upload_test_public.txt');
    fs.writeFileSync(tmpTxt, "Uploaded plain text content for the public build test.");
    await page.setInputFiles('#fileUpload', tmpTxt);
    await page.waitForTimeout(150);
    const editorVal = await page.inputValue('#editor');
    console.log({ editorVal });
    if (editorVal !== "Uploaded plain text content for the public build test.") fail("expected the .txt content in the editor, got: " + editorVal);
    fs.unlinkSync(tmpTxt);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- PDF upload (re-check, real pdf.js against the live CDN) ---
  {
    const { browser, page, errors } = await openApp();
    console.log("=== PDF upload (public) ===");
    await page.setInputFiles('#fileUpload', path.resolve(__dirname, 'fixture_upload_test.pdf'));
    await page.waitForTimeout(5000);
    const editorVal = await page.inputValue('#editor');
    console.log({ editorVal });
    if (editorVal.indexOf('Hello from a test PDF upload') === -1) fail("expected the PDF's real text extracted, got: " + editorVal);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- JPG upload: hits worker.js's /ai endpoint with an image field (fetch stubbed) ---
  {
    const { browser, page, errors } = await openApp(FETCH_STUB);
    console.log("=== JPG upload -> worker vision call (public) ===");
    const tmpImg = path.join(os.tmpdir(), 'upload_test_public.jpg');
    fs.writeFileSync(tmpImg, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0]));
    await page.setInputFiles('#fileUpload', tmpImg);
    await page.waitForTimeout(300);
    const editorVal = await page.inputValue('#editor');
    const calls = await page.evaluate(() => window.__fetchCalls || []);
    const imageCall = calls.find(c => c.image);
    console.log({ editorVal, sawImageField: !!imageCall, modelRequested: imageCall && imageCall.model });
    if (editorVal !== "Transcribed photo text goes here.") fail("expected the stubbed vision transcription in the editor, got: " + editorVal);
    if (!imageCall) fail("expected the request to worker.js to carry an image field");
    if (imageCall && imageCall.model !== 'gpt-5-mini') fail("expected the vision call to request gpt-5-mini, got: " + (imageCall && imageCall.model));
    fs.unlinkSync(tmpImg);
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  // --- deeper AI check auto-limits to ~2000 words on a long document (public build) ---
  {
    const { browser, page, errors } = await openApp(FETCH_STUB);
    console.log("=== AI check auto-limit on long documents (public) ===");
    const longText = Array(2500).fill('word').join(' ');
    await page.fill('#editor', longText);
    await page.click('#btnCheck');
    await page.waitForTimeout(400);
    const banner = await page.textContent('#banners');
    const calls = await page.evaluate(() => window.__fetchCalls || []);
    const lastPromptLen = calls.length ? calls[calls.length - 1].prompt.length : -1;
    console.log({ banner: (banner||'').trim(), lastPromptLen });
    if (!/first ~2,000 words/.test(banner||'')) fail("expected a truncation notice for a >2000-word document, got: " + banner);
    if (lastPromptLen < 0) fail("expected the AI pass to have called the worker at all");
    if (errors.length) fail("page errors: " + errors.join('; '));
    await browser.close();
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
