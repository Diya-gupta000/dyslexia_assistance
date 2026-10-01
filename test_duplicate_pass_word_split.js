// Regression test for a real bug found live on the deployed site: when BOTH independent AI
// passes correctly agree on the same short, real-word mistake (e.g. "no" -> "know"), the old
// locateSnippet() had no way to tell "this is a second pass confirming the SAME occurrence" from
// "this is a flag for a different, later occurrence of the same word". After the first "no" was
// claimed, it kept scanning for the next literal "no" ANYWHERE in the text -- including as a bare
// substring buried inside an unrelated word like "not" -- and happily split that word with a bogus
// underline ("dus <mark>no</mark>t" instead of leaving "not" alone). Confirmed against the live
// deployed site: checking "Luna is a lot like her mom. Even no she will never amite to it. ...
// She dus not have a girly bone..." produced a stray "no" mark carved out of "not".
//
// The fix enforces a whole-word boundary in locateSnippet()'s substring search, so a short
// snippet can never land mid-word. A duplicate confirmation that has nowhere legitimate left to
// go is now correctly dropped (silently, same as any other "couldn't relocate this" case) instead
// of mis-landing inside a different word.
const { chromium } = require('playwright');
const path = require('path');

const TEXT = "Luna is a lot like her mom. Even no she will never amite to it. She dus not have a girly bone in her body.";
// Both concurrent passes agreeing on the exact same real occurrence -- this is the GOOD,
// intended outcome of running two passes (redundant confirmation), not a bug in the AI's reply.
const AI_ITEM = { original: "no", suggestion: "know", type: "word choice",
  explanation: "'No' sounds like 'know' is missing here -- she will never admit it, even though she knows it." };
const AI_RESULT = [AI_ITEM];

async function runForFile(label, fileRelPath){
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let allOk = true;

  if (fileRelPath === 'second_look.html') {
    await page.addInitScript((mock) => {
      window.claude = { use: async function(name){
        if (name === 'sample') return { json: async function(){ return mock; } };
        if (name === 'db') return { doc: function(){ return { get: async()=>({exists:false}), set: async()=>{} }; } };
        return null;
      }};
    }, AI_RESULT);
    await page.goto('file://' + path.resolve(__dirname, fileRelPath));
  } else {
    await page.addInitScript((mock) => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async function(url, opts){
        if (typeof url === 'string' && url.indexOf('/ai') !== -1){
          return new Response(JSON.stringify({
            text: JSON.stringify(mock),
            usage: { prompt_tokens: 300, completion_tokens: 60 },
            model: "gpt-5-mini"
          }), {status:200});
        }
        return realFetch(url, opts);
      };
    }, AI_RESULT);
    let html = require('fs').readFileSync(path.resolve(__dirname, fileRelPath), 'utf8');
    html = html.replace('https://second-look-ai.diya2010gupta.workers.dev', 'https://fake-worker.example.workers.dev');
    const tmpPath = path.resolve(__dirname, '_test_dup_tmp.html');
    require('fs').writeFileSync(tmpPath, html);
    await page.goto('file://' + tmpPath);
  }

  await page.waitForTimeout(200);
  await page.fill('#editor', TEXT);
  await page.click('#btnCheck');
  await page.waitForTimeout(500);

  const marks = await page.$$eval('#reviewed mark', els => els.map(e => e.textContent));
  console.log(`\n=== ${label}: two passes agreeing on one "no" must not split "not" elsewhere ===`);
  console.log("flagged marks:", marks);

  // The real occurrence ("Even no") should still be caught exactly once.
  const noCount = marks.filter(m => m.trim().toLowerCase() === 'no').length;
  // "not" must never be torn into "no" + "t".
  const hasPhantomSplit = marks.some(m => m.trim().toLowerCase() === 'no') &&
    (await page.$$eval('#reviewed', els => els[0].textContent)).indexOf('not') !== -1 &&
    (await page.$eval('#reviewed', el => el.innerHTML)).indexOf('>no</mark>t') !== -1;

  if (noCount < 1) {
    console.log("FAIL: the real 'Even no' occurrence wasn't flagged at all");
    allOk = false;
  }
  if (noCount > 1) {
    console.log("FAIL: duplicate confirmation produced more than one 'no' mark (expected exactly 1)");
    allOk = false;
  }
  if (hasPhantomSplit) {
    console.log("FAIL: the bug reproduced -- 'not' got split into a bogus 'no' + 't' (the original live bug)");
    allOk = false;
  }
  if (!hasPhantomSplit && noCount === 1) {
    console.log("OK: single clean 'no' flag, 'not' left untouched");
  }
  if (errors.length){ console.log("PAGE ERRORS:", errors); allOk = false; }

  await page.close();
  await browser.close();
  if (fileRelPath !== 'second_look.html') { require('fs').unlinkSync(path.resolve(__dirname, '_test_dup_tmp.html')); }
  return allOk;
}

(async () => {
  const okArtifact = await runForFile("second_look.html", "second_look.html");
  const okPublic = await runForFile("public_index.html", "public_index.html");
  const allOk = okArtifact && okPublic;
  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
  process.exit(allOk ? 0 : 1);
})();
