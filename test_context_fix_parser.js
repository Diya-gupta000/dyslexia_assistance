// TC-4 from fix_AI.md: pure-JS unit tests for the new incremental parseJsonLoose() (S1),
// extracted directly from the generated public_index.html so this exercises the actual shipped
// code rather than a hand-copied reimplementation of it. No browser needed -- parseJsonLoose
// only exists in the public build (build_public.py); the Artifact build gets JSON parsing for
// free from claude.use("sample").json(), which is why this test has no _public-paired sibling
// (and no non-public sibling either -- see test_context_fix.js / test_context_fix_public.js for
// the browser-level TCs).
const fs = require('fs');
const path = require('path');

function extractParseJsonLoose(){
  const html = fs.readFileSync(path.resolve(__dirname, 'public_index.html'), 'utf8');
  const start = html.indexOf('function parseJsonLoose(text){');
  const end = html.indexOf('async function callAI(prompt, model, maxTokens, image){');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("couldn't find parseJsonLoose (and the callAI that follows it) in public_index.html -- did build_public.py run?");
  }
  const src = html.slice(start, end);
  const mod = { exports: {} };
  new Function('module', 'exports', src + '\nmodule.exports.parseJsonLoose = parseJsonLoose;')(mod, mod.exports);
  return mod.exports.parseJsonLoose;
}

let allOk = true;
function check(name, fn){
  try { fn(); console.log("PASS:", name); }
  catch (e) { console.log("FAIL:", name, "--", e.message); allOk = false; }
}
function assertEq(a, b, msg){
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || "mismatch") + ": got " + JSON.stringify(a) + " want " + JSON.stringify(b));
}

const parseJsonLoose = extractParseJsonLoose();

// (a) clean array
check("(a) clean array -- all items recovered, not marked partial", () => {
  const r = parseJsonLoose('[{"original":"liyt","suggestion":"late","type":"spelling","explanation":"x"}]');
  assertEq(r.length, 1);
  assertEq(r[0].suggestion, "late");
  if (r.partial) throw new Error("a clean reply should not be marked partial");
});

// (b) fenced in ```json
check("(b) fenced array -- fence stripped, all items recovered", () => {
  const r = parseJsonLoose('```json\n[{"original":"liyt","suggestion":"late","type":"spelling","explanation":"x"}]\n```');
  assertEq(r.length, 1);
  assertEq(r[0].original, "liyt");
  if (r.partial) throw new Error("a clean fenced reply should not be marked partial");
});

// (c) truncated tail -- complete items recovered, the cut-off fragment counted as skipped
check("(c) truncated tail -- complete items recovered, fragment counted", () => {
  const truncated = '[{"original":"liyt","suggestion":"late","type":"spelling","explanation":"a"},{"original":"whas","suggesti';
  const r = parseJsonLoose(truncated);
  assertEq(r.length, 1, "should recover the one complete item");
  assertEq(r[0].suggestion, "late");
  if (!r.partial) throw new Error("truncated input should be marked partial");
  if (!(r.skippedCount >= 1)) throw new Error("expected the truncated tail to be counted as skipped");
});

// (d) garbage between items -- items recovered, garbage skipped
check("(d) garbage between items -- good items survive, garbage skipped", () => {
  const messy = '[{"original":"liyt","suggestion":"late","type":"spelling","explanation":"a"},' +
                '{"original":"bad" "suggestion":"oops"},' + // missing comma -- malformed
                '{"original":"scery","suggestion":"scary","type":"spelling","explanation":"b"}]';
  const r = parseJsonLoose(messy);
  assertEq(r.length, 2);
  assertEq(r[0].suggestion, "late");
  assertEq(r[1].suggestion, "scary");
  if (!r.partial) throw new Error("input with a bad fragment should be marked partial");
  if (!(r.skippedCount >= 1)) throw new Error("expected the malformed fragment to be counted as skipped");
});

// (e) empty string -- throws a catchable error the existing callers already handle
check("(e) empty string -- throws", () => {
  let threw = false;
  try { parseJsonLoose(""); } catch (e) { threw = true; }
  if (!threw) throw new Error("empty input should throw, not silently return something");
});

// Backward compatibility: object-shaped replies (handleSpokenWord, aiWordFitsContext,
// extractImageText) must keep going through the plain strict path, untouched by the new
// array-recovery logic -- this is the constraint that shaped S1's whole design.
check("object-shaped replies are unaffected by the array-recovery path", () => {
  const r = parseJsonLoose('{"suggestion":"garden","explanation":"warm sentence"}');
  assertEq(r.suggestion, "garden");
  if (Array.isArray(r)) throw new Error("an object-shaped reply should not come back as an array");
  let threw = false;
  try { parseJsonLoose('{"suggestion":"garden"'); } catch (e) { threw = true; } // truncated object
  if (!threw) throw new Error("a truncated OBJECT reply should still throw -- recovery is array-only");
});

console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"));
process.exit(allOk ? 0 : 1);
