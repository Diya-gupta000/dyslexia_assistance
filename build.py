import json

wordlist = open('wordlist_js.txt').read().strip()

# Deliberately excludes high-frequency function words (to, of, was, are, no, from)
# even where they have a classic confusable partner (too/two, have, saw, our, know/now, form) --
# flagging a word that appears in nearly every sentence would bury the useful flags in noise.
# Kept groups pair genuine content-word confusions dyslexic writers report often.
confusable_groups = [
    ["their","there","they're"],
    ["too","two"],
    ["your","you're"],
    ["its","it's"],
    ["then","than"],
    ["were","where","we're","wear"],
    ["know","now"],
    ["who's","whose"],
    ["form","from"],
    ["quite","quiet"],
    ["though","thought","through"],
    ["loose","lose"],
    ["accept","except"],
    ["weather","whether"],
    ["affect","effect"],
    ["write","right"],
    ["here","hear"],
    ["new","knew"],
    ["break","brake"],
    ["piece","peace"],
    ["allowed","aloud"],
    ["board","bored"],
    ["past","passed"],
    ["principal","principle"],
    ["desert","dessert"],
    ["complement","compliment"],
    ["advice","advise"],
    ["led","lead"],
    ["chose","choose"],
    ["clothes","close"],
    ["angel","angle"],
]
confusable_json = json.dumps(confusable_groups, separators=(',',':'))

html = r"""<title>Second Look</title>
<meta name="description" content="A dyslexia-friendly writing checker that gives hints instead of fixes, reads suggestions aloud, and tracks a student's progress over time.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Baloo+2:wght@500;600;700;800&family=Lexend:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  /* Base text/background follow British Dyslexia Association guidance: dark charcoal on a
     warm off-white, never pure black-on-white, with contrast checked (not eyeballed) against
     WCAG AA 4.5:1 for every text/background pairing below -- the warn/info/special/confusable
     accents were specifically darkened from an earlier palette that measured under 4.5:1 when
     used as small badge/banner text on their own "-soft" backgrounds. */
  --bg:#FAF8F2; --surface:#FFFFFF; --surface-2:#F1EAD9; --border:#E4D9C3;
  --text:#2B2B2B; --text-muted:#6B6152;
  --accent:#2F6F63; --accent-strong:#245650; --accent-contrast:#FFFFFF; --accent-soft:#DCEEE9;
  --warn:#A74836; --warn-soft:#F6E1DC;
  --info:#38699E; --info-soft:#DEE9F4;
  --special:#7557A0; --special-soft:#EBE2F5;
  --confusable:#876019; --confusable-soft:#F3E7CB;
  --success:#2C774C; --success-soft:#DFF0E4;
  --shadow: rgba(43,38,32,0.10);
  /* reading settings -- adjustable font + size, applied to :root by applyReadPrefs() and
     persisted in localStorage so they survive a reload; --read-fs has an 18px floor even
     after "smaller" is pressed, since 18px is the accessibility minimum this pass is built
     around, not just its starting default. */
  --read-fs: 18px;
  --font-body: "Atkinson Hyperlegible","Lexend",system-ui,sans-serif;
}
:root[data-read-font="opendyslexic"]{
  --font-body: "OpenDyslexicShared","Atkinson Hyperlegible","Lexend",system-ui,sans-serif;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#1D1A15; --surface:#272319; --surface-2:#332C1F; --border:#463D2C;
    --text:#F2EBDA; --text-muted:#B8AD97;
    --accent:#5FBBA6; --accent-strong:#8AD3C2; --accent-contrast:#0F241F; --accent-soft:#23423A;
    --warn:#E28A75; --warn-soft:#3B2620;
    --info:#8DB8E6; --info-soft:#22344A;
    --special:#C4A9E8; --special-soft:#332A47;
    --confusable:#E0B75E; --confusable-soft:#3B301A;
    --success:#86D3A6; --success-soft:#1E3A2A;
    --shadow: rgba(0,0,0,0.45);
  }
}
:root[data-theme="dark"]{
  --bg:#1D1A15; --surface:#272319; --surface-2:#332C1F; --border:#463D2C;
  --text:#F2EBDA; --text-muted:#B8AD97;
  --accent:#5FBBA6; --accent-strong:#8AD3C2; --accent-contrast:#0F241F; --accent-soft:#23423A;
  --warn:#E28A75; --warn-soft:#3B2620;
  --info:#8DB8E6; --info-soft:#22344A;
  --special:#C4A9E8; --special-soft:#332A47;
  --confusable:#E0B75E; --confusable-soft:#3B301A;
  --success:#86D3A6; --success-soft:#1E3A2A;
  --shadow: rgba(0,0,0,0.45);
}

*{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:var(--font-body);
  font-size:var(--read-fs);
  line-height:1.5;
  letter-spacing:0.05em;
  text-align:left;
  -webkit-font-smoothing:antialiased;
}
/* Bold, never italics, for emphasis anywhere in the UI -- a belt-and-suspenders reset in
   case any future markup reaches for <em>/<i> without knowing this rule. */
em,i{font-style:normal; font-weight:600;}
h1,.brand{font-family:"Baloo 2","Lexend",system-ui,sans-serif;}
h2,h3{font-family:var(--font-body);}
h1,h2,h3{text-wrap:balance; margin:0;}
/* form controls don't inherit body's font by default in most browsers -- opt them back in
   so the reading-font/size choice actually reaches every button, tab and input, not just
   plain text. */
button,.tab,input,textarea{font-family:var(--font-body);}

.wrap{max-width:820px; margin:0 auto; padding:28px 20px 80px;}

header.top{
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  margin-bottom:22px; flex-wrap:wrap;
}
.brand{display:flex; align-items:center; gap:10px;}
.brand .mark{
  width:40px; height:40px; border-radius:12px; background:var(--accent);
  display:flex; align-items:center; justify-content:center; color:var(--accent-contrast);
  font-size:20px; flex:none; box-shadow:0 2px 6px var(--shadow);
}
.brand h1{font-size:22px; font-weight:700; letter-spacing:.2px;}
.brand p{margin:2px 0 0; font-size:13px; color:var(--text-muted);}

.tabs{display:flex; gap:6px; background:var(--surface-2); padding:4px; border-radius:12px; border:1px solid var(--border);}
.tab{
  border:none; background:transparent; color:var(--text-muted); padding:9px 16px; border-radius:9px;
  min-height:44px; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s,color .15s;
}
.tab[aria-selected="true"]{background:var(--accent); color:var(--accent-contrast);}
.tab:not([aria-selected="true"]):hover{color:var(--text);}

.card{
  background:var(--surface); border:1px solid var(--border); border-radius:18px;
  padding:22px; box-shadow:0 2px 10px var(--shadow);
}
.card + .card{margin-top:18px;}

.view{display:none;}
.view.active{display:block;}

/* --- write view --- */
.editor-toolbar{display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; flex-wrap:wrap;}
.editor-toolbar-actions{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.wordcount{font-size:12.5px; color:var(--text-muted); font-variant-numeric:tabular-nums;}

textarea#editor{
  width:100%; max-width:65ch; min-height:180px; resize:vertical; border-radius:14px; border:1.5px solid var(--border);
  background:var(--surface-2); color:var(--text); padding:16px 18px; font:inherit; font-size:var(--read-fs); line-height:1.65;
  letter-spacing:0.05em;
}
textarea#editor:focus{outline:2px solid var(--accent); outline-offset:1px;}

.reviewed{
  width:100%; max-width:65ch; min-height:180px; border-radius:14px; border:1.5px solid var(--border);
  background:var(--surface-2); color:var(--text); padding:16px 18px; font-size:var(--read-fs); line-height:1.9;
  letter-spacing:0.05em; white-space:pre-wrap;
}
.reviewed mark{
  background:transparent; color:inherit; cursor:pointer; padding:0 1px; border-radius:3px;
  border-bottom:3px solid var(--flag-color, var(--warn)); text-decoration:none;
  transition:background .12s;
}
.reviewed mark:hover{background:var(--flag-soft, var(--warn-soft));}
.reviewed mark:focus-visible, .reviewed .askword:focus-visible{outline:3px solid var(--accent); outline-offset:2px;}
.reviewed mark.resolved{border-bottom-style:dotted; opacity:.55;}
/* Underline STYLE differs per flag type, not just color -- so which kind of mistake this is
   doesn't rely on color perception alone (BDA guidance: never signal an error with color only). */
.reviewed mark.f-spelling{--flag-color:var(--warn); --flag-soft:var(--warn-soft); border-bottom-style:solid;}
.reviewed mark.f-grammar{--flag-color:var(--info); --flag-soft:var(--info-soft); border-bottom-style:dashed;}
.reviewed mark.f-punctuation{--flag-color:var(--special); --flag-soft:var(--special-soft); border-bottom-style:dotted;}
.reviewed mark.f-confusable, .reviewed mark.f-word_choice{--flag-color:var(--confusable); --flag-soft:var(--confusable-soft); border-bottom-style:double; border-bottom-width:4px;}
.reviewed mark.f-ask{--flag-color:var(--accent); --flag-soft:var(--accent-soft); border-bottom-style:solid;}
.reviewed .askword{cursor:pointer; border-radius:3px;}
.reviewed .askword:hover{background:var(--accent-soft);}

.btnrow{display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; align-items:center;}
button.btn{
  font-size:14.5px; font-weight:600; border-radius:11px; padding:11px 18px; min-height:44px; cursor:pointer;
  border:1.5px solid transparent; transition:transform .08s, background .15s, border-color .15s;
  display:inline-flex; align-items:center; gap:7px;
}
button.btn:active{transform:translateY(1px);}
button.btn.primary{background:var(--accent); color:var(--accent-contrast);}
button.btn.primary:hover{background:var(--accent-strong);}
button.btn.ghost{background:transparent; border-color:var(--border); color:var(--text);}
button.btn.ghost:hover{border-color:var(--accent); color:var(--accent);}
button.btn:disabled{opacity:.5; cursor:not-allowed;}
button.iconbtn{background:transparent;border:1.5px solid var(--border);border-radius:9px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);font-size:15px;}
button.iconbtn:hover{border-color:var(--accent); color:var(--accent);}
button.btn:focus-visible, button.iconbtn:focus-visible, .tab:focus-visible, .fb-link:focus-visible{
  outline:3px solid var(--accent); outline-offset:2px;
}

.optionrow{display:flex; align-items:center; gap:8px; font-size:13.5px; color:var(--text-muted); margin-top:10px;}
.optionrow input{accent-color:var(--accent);}

.status{font-size:13.5px; color:var(--text-muted); margin-top:10px; min-height:18px; display:flex; align-items:center; gap:8px;}
.status.busy::before{
  content:""; width:13px; height:13px; border-radius:50%; border:2px solid var(--border); border-top-color:var(--accent);
  animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg);}}
.banner{
  margin-top:12px; padding:10px 14px; border-radius:10px; font-size:13.5px; display:flex; gap:8px; align-items:flex-start;
}
.banner.warn{background:var(--warn-soft); color:var(--warn);}
.banner.info{background:var(--info-soft); color:var(--info);}

/* legend */
.legend{display:flex; gap:14px; flex-wrap:wrap; margin-top:14px; font-size:12.5px; color:var(--text-muted);}
.legend span{display:inline-flex; align-items:center; gap:6px;}
.legend i{width:14px; height:6px; border-radius:3px; display:inline-block;}

/* popover */
.overlay{position:fixed; inset:0; background:rgba(20,17,12,.32); display:none; align-items:flex-end; justify-content:center; z-index:40; padding:0;}
.overlay.show{display:flex;}
@media (min-width:640px){ .overlay{align-items:center;} }
.pop{
  background:var(--surface); border:1px solid var(--border); border-radius:20px 20px 0 0; width:100%; max-width:480px;
  padding:26px; box-shadow:0 -8px 30px var(--shadow); max-height:85vh; overflow:auto;
}
@media (min-width:640px){ .pop{border-radius:20px; margin-bottom:40px;} }
.pop .kind{
  display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.5px;
  padding:4px 10px; border-radius:999px; margin-bottom:14px;
}
.pop .original{font-size:calc(var(--read-fs) * 1.05); margin:4px 0 12px; font-weight:600;}
.pop .original s{color:var(--warn); text-decoration-color:var(--warn);}
.pop .explain{font-size:var(--read-fs); line-height:1.6; color:var(--text); margin-bottom:18px;}
.pop label{font-size:14px; color:var(--text-muted); display:block; margin-bottom:8px;}
.pop input[type=text]{
  width:100%; min-height:44px; padding:12px 14px; border-radius:11px; border:1.5px solid var(--border); background:var(--surface-2);
  color:var(--text); font-size:16px;
}
.pop input[type=text]:focus, .pop input[type=text]:focus-visible{outline:3px solid var(--accent); outline-offset:1px;}
.pop .feedback{margin-top:10px; font-size:14px; min-height:20px;}
.pop .feedback.good{color:var(--success);}
.pop .feedback.bad{color:var(--warn);}
.pop .popbtns{display:flex; gap:10px; margin-top:18px; flex-wrap:wrap;}
.pop .reveal-box{margin-top:14px; padding:12px 14px; background:var(--success-soft); border-radius:11px; font-size:15px; display:none;}
.pop .reveal-box.show{display:block;}
.pop .closebar{display:flex; justify-content:flex-end; margin-bottom:-6px;}
.pop .voice-hint{
  display:flex; align-items:center; gap:8px; margin-top:16px; padding:10px 12px;
  background:var(--accent-soft); border-radius:11px; font-size:13.5px; color:var(--accent-strong);
}
button.btn.mic.listening{background:var(--warn); border-color:var(--warn); color:#fff; animation:micpulse 1s ease-in-out infinite;}
@keyframes micpulse{0%,100%{opacity:1;}50%{opacity:.6;}}

/* "this looks wrong" flag feedback -- deliberately quiet so it never competes
   with the primary fix-checking action above it. Still gets the same 44px minimum
   tap target as every other popover control -- "quiet" is a visual choice (small
   type, muted color, dotted underline), not a smaller hit area. */
.pop .fb-footer{margin-top:16px; text-align:center;}
.fb-link{
  background:none; border:none; padding:6px 4px; min-height:44px; display:inline-flex; align-items:center;
  font-size:12.5px; color:var(--text-muted);
  text-decoration:underline; text-decoration-style:dotted; cursor:pointer;
}
.fb-link:hover{color:var(--accent-strong);}
.pop .fb-followup{
  margin-top:10px; padding:12px 14px; background:var(--surface-2); border-radius:11px;
}
.pop .fb-thanks{font-size:13.5px; color:var(--accent-strong); font-weight:600; margin-bottom:8px;}
.pop .fb-followup-row{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:6px;}
.pop .fb-followup-row input[type=text]{flex:1; min-width:120px; padding:9px 12px; font-size:14px;}
.pop .fb-followup .btn{padding:9px 12px; font-size:13px;}
.pop .fb-followup .fb-link{padding:6px 0; display:inline-block;}

/* progress view */
.stat-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:6px;}
.stat{background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:14px 16px;}
.stat .num{font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--accent-strong);}
.stat .lbl{font-size:12.5px; color:var(--text-muted); margin-top:2px;}
.chart-wrap{margin-top:8px;}
.chart-wrap h3, .breakdown h3{font-size:14px; margin-bottom:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.4px;}
.bars{display:flex; flex-direction:column; gap:10px;}
.bar-row{display:grid; grid-template-columns:100px 1fr 34px; align-items:center; gap:10px; font-size:13.5px;}
.bar-track{background:var(--surface-2); border-radius:999px; height:10px; overflow:hidden;}
.bar-fill{height:100%; border-radius:999px;}
.empty-state{color:var(--text-muted); font-size:14.5px; text-align:center; padding:30px 10px;}
.combo-list{display:flex; flex-direction:column; gap:10px;}
.combo-row{display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--surface-2); border-radius:12px; padding:10px 14px;}
.combo-pattern{font-size:15px; font-weight:700;}
.combo-pattern .arrow{color:var(--text-muted); font-weight:400; margin:0 6px;}
.combo-pattern em{color:var(--text-muted); font-style:normal; font-weight:600;}
.combo-examples{font-size:12.5px; color:var(--text-muted); margin-top:3px;}
.combo-count{font-size:13px; font-weight:700; color:var(--accent-strong); background:var(--surface); border-radius:999px; padding:4px 11px; white-space:nowrap;}
.feedback-list{display:flex; flex-direction:column; gap:8px;}
.feedback-row{display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--surface-2); border-radius:12px; padding:10px 14px; font-size:13.5px;}
.feedback-count{font-size:13px; font-weight:700; color:var(--accent-strong); background:var(--surface); border-radius:999px; padding:4px 11px; white-space:nowrap;}

/* --- practice-sentence generator (inside the spelling-patterns card) --- */
.practice-generator{margin-top:16px; padding-top:16px; border-top:1.5px solid var(--border);}
.practice-explainer{font-size:13px; color:var(--text-muted); margin-top:8px;}
.practice-caption{font-size:12.5px; color:var(--text-muted); margin-top:8px; font-style:normal;}
.practice-cards{display:flex; flex-direction:column; gap:14px; margin-top:14px;}
.practice-card{background:var(--surface-2); border-radius:14px; padding:16px 18px; border:1.5px solid var(--border);}
.practice-card.done{border-color:var(--success); background:var(--success-soft);}
.practice-card .tag{
  display:inline-flex; align-items:center; font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px;
  color:var(--confusable); background:var(--confusable-soft); border-radius:999px; padding:3px 10px; margin-bottom:10px;
}
.practice-card .sentence{font-size:var(--read-fs); line-height:1.6; margin-bottom:12px;}
.practice-card .blank{font-weight:700; color:var(--accent-strong); letter-spacing:.5px;}
.practice-card .practice-row{display:flex; gap:10px; flex-wrap:wrap; align-items:center;}
.practice-card input[type=text]{
  flex:1; min-width:140px; min-height:44px; padding:10px 14px; border-radius:11px; border:1.5px solid var(--border);
  background:var(--surface); color:var(--text); font-size:16px;
}
.practice-card input[type=text]:focus, .practice-card input[type=text]:focus-visible{outline:3px solid var(--accent); outline-offset:1px;}
.practice-card .feedback{margin-top:10px; font-size:14px; min-height:20px;}
.practice-card .feedback.good{color:var(--success);}
.practice-card .feedback.bad{color:var(--warn);}
.practice-summary{margin-top:14px; padding:12px 14px; background:var(--success-soft); border-radius:11px; font-size:14.5px; display:none;}

/* reading settings -- font + size control, kept as a small anchored panel (not the big
   word-flag overlay) so it never blocks the page underneath it while it's open. */
.rs-wrap{position:relative;}
.rs-panel{
  position:absolute; top:calc(100% + 8px); right:0; z-index:30; width:300px; max-width:calc(100vw - 40px);
  background:var(--surface); border:1px solid var(--border); border-radius:16px;
  padding:18px; box-shadow:0 8px 24px var(--shadow);
}
.rs-panel[hidden]{display:none;}
.rs-panel h4{font-size:13px; text-transform:uppercase; letter-spacing:.4px; color:var(--text-muted); font-weight:700; margin:0 0 10px;}
.rs-panel h4 + h4{margin-top:16px;}
.rs-row{display:flex; gap:8px; flex-wrap:wrap;}
.rs-option{
  flex:1; min-width:100px; min-height:44px; padding:8px 10px; border-radius:10px; border:1.5px solid var(--border);
  background:var(--surface-2); color:var(--text); cursor:pointer; font-size:14px; font-weight:600;
}
.rs-option[aria-pressed="true"]{background:var(--accent); border-color:var(--accent); color:var(--accent-contrast);}
.rs-sizerow{display:flex; align-items:center; gap:8px;}
.rs-sizerow button{
  width:44px; height:44px; border-radius:10px; border:1.5px solid var(--border); background:var(--surface-2);
  color:var(--text); font-size:18px; font-weight:700; cursor:pointer;
}
.rs-sizerow button:disabled{opacity:.4; cursor:not-allowed;}
.rs-sizerow button:hover:not(:disabled){border-color:var(--accent); color:var(--accent);}
.rs-sizeval{flex:1; text-align:center; font-size:14px; color:var(--text-muted); font-variant-numeric:tabular-nums;}
.rs-option:focus-visible, .rs-sizerow button:focus-visible{outline:3px solid var(--accent); outline-offset:2px;}

/* Respect a visitor's OS-level motion preference -- every non-essential transition and
   keyframe animation in the UI is switched off here rather than left to chance per-rule. */
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation-duration:0.001ms !important; animation-iteration-count:1 !important;
    transition-duration:0.001ms !important; scroll-behavior:auto !important;
  }
}

/* Hides a native file input without hiding it from assistive tech or keyboard focus --
   the visible, styled control is the <label for="..."> button next to it. Used by the
   Write tab's "Upload a file" control. */
.sr-only-file-input{
  position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
  clip:rect(0,0,0,0); white-space:nowrap; border:0;
}
.sr-only-file-input:focus-visible + label, label.btn:has(+ .sr-only-file-input:focus-visible){
  outline:3px solid var(--accent); outline-offset:2px;
}
</style>

<div class="wrap">
  <header class="top">
    <div class="brand">
      <div class="mark">✎</div>
      <div>
        <h1>Second Look</h1>
        <p>Catches mistakes, teaches you to fix them yourself.</p>
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" aria-selected="true" data-view="write">Write</button>
      <button class="tab" role="tab" aria-selected="false" data-view="progress">My Progress</button>
    </div>
    <div class="rs-wrap">
      <button class="iconbtn" id="btnReadingSettings" title="Reading settings" aria-label="Reading settings" aria-haspopup="true" aria-expanded="false">Aa</button>
      <div class="rs-panel" id="rsPanel" hidden>
        <h4 id="rsFontLabel">Font</h4>
        <div class="rs-row" role="group" aria-labelledby="rsFontLabel">
          <button type="button" class="rs-option" id="rsFontAtkinson" aria-pressed="true">Atkinson Hyperlegible</button>
          <button type="button" class="rs-option" id="rsFontOpenDyslexic" aria-pressed="false">OpenDyslexic</button>
        </div>
        <h4 id="rsSizeLabel">Text size</h4>
        <div class="rs-sizerow" role="group" aria-labelledby="rsSizeLabel">
          <button type="button" id="rsSizeDown" aria-label="Smaller text">A−</button>
          <span class="rs-sizeval" id="rsSizeVal">18px</span>
          <button type="button" id="rsSizeUp" aria-label="Larger text">A+</button>
        </div>
      </div>
    </div>
  </header>

  <div id="view-write" class="view active">
    <div class="card">
      <div class="editor-toolbar">
        <span class="wordcount" id="wordcount">0 words</span>
        <div class="editor-toolbar-actions">
          <label class="btn ghost" for="fileUpload" id="fileUploadLabel" tabindex="0">📄 Upload a file</label>
          <input type="file" id="fileUpload" class="sr-only-file-input" accept=".txt,text/plain,.pdf,application/pdf,.jpg,.jpeg,.png,image/jpeg,image/png">
          <button class="iconbtn" id="btnReadAloud" title="Read my paragraph aloud" aria-label="Read my paragraph aloud">🔊</button>
        </div>
      </div>
      <div id="uploadBanner"></div>

      <textarea id="editor" placeholder="Type or paste your paragraph here, or upload a .txt, PDF, or photo of a page above. When you're ready, press Check my writing." spellcheck="false"></textarea>
      <div id="reviewed" class="reviewed" style="display:none;" aria-live="polite"></div>

      <div class="btnrow">
        <button class="btn primary" id="btnCheck">🔎 Check my writing</button>
        <button class="btn ghost" id="btnEditAgain" style="display:none;">✏️ Edit again</button>
        <button class="btn ghost" id="btnFinish" style="display:none;">✅ Finish &amp; save progress</button>
      </div>

      <div class="optionrow">
        <input type="checkbox" id="useAI" checked>
        <label for="useAI">Use the deeper AI check for tricky mix-ups (uses a bit of your own Claude usage, takes up to a minute)</label>
      </div>

      <div class="status" id="status"></div>
      <div id="banners"></div>

      <div class="legend">
        <span><i style="background:var(--warn)"></i> Spelling</span>
        <span><i style="background:var(--info)"></i> Grammar</span>
        <span><i style="background:var(--special)"></i> Punctuation</span>
        <span><i style="background:var(--confusable)"></i> Wrong word</span>
      </div>
      <div class="legend" style="margin-top:6px;">
        <span>💡 Any word can be clicked — ask about one we didn't flag, then type or say what you meant.</span>
      </div>
    </div>
  </div>

  <div id="view-progress" class="view">
    <div class="card">
      <div class="stat-grid" id="statGrid"></div>
    </div>
    <div class="card chart-wrap">
      <h3>Self-correction rate over time</h3>
      <div id="chart"></div>
    </div>
    <div class="card breakdown">
      <h3>What tends to trip you up</h3>
      <div class="bars" id="bars"></div>
    </div>
    <div class="card breakdown">
      <h3>Spelling patterns you keep mixing up</h3>
      <div class="combo-list" id="comboPairs"></div>
      <div class="practice-generator" id="practiceGenerator">
        <button class="btn primary" id="btnGeneratePractice" type="button">Generate more practice sentences</button>
        <div class="practice-explainer" id="practiceExplainer" style="display:none;">Practice sentences unlock once you've corrected the same words a few times in the Write tab.</div>
        <div class="practice-caption" id="practiceCaption"></div>
        <div id="practiceBanner"></div>
        <div class="practice-cards" id="practiceCards"></div>
        <div class="practice-summary" id="practiceSummary"></div>
      </div>
    </div>
    <div class="card breakdown" id="feedbackCard" style="display:none;">
      <h3>Suggestions you reported</h3>
      <div class="feedback-list" id="feedbackSummary"></div>
    </div>
  </div>
</div>

<div class="overlay" id="overlay">
  <div class="pop" id="pop">
    <div class="closebar"><button class="iconbtn" id="popClose" aria-label="Close">✕</button></div>
    <span class="kind" id="popKind"></span>
    <div class="original" id="popOriginal"></div>
    <div class="explain" id="popExplain"></div>
    <label for="popInput">Type your fix, or say it out loud:</label>
    <input type="text" id="popInput" autocomplete="off">
    <div class="feedback" id="popFeedback"></div>
    <div class="reveal-box" id="popReveal"></div>
    <div class="voice-hint" id="popVoiceHint" style="display:none;">
      🎤 Not sure what word you meant? Press “Say it” and speak the word out loud — that often catches things spelling alone misses.
    </div>
    <div class="popbtns">
      <button class="btn primary" id="popTry">Check my fix</button>
      <button class="btn ghost mic" id="popMic">🎤 Say it</button>
      <button class="btn ghost" id="popHear">🔊 Hear it</button>
      <button class="btn ghost" id="popShow">Show me</button>
      <button class="btn ghost" id="popSkip">Skip</button>
    </div>
    <div class="fb-footer" id="popFbFooter">
      <button type="button" class="fb-link" id="popFlagWrong">⚑ This looks wrong</button>
    </div>
    <div class="fb-followup" id="popFlagFollowup" style="display:none;">
      <div class="fb-thanks">Thanks — noted. I'm still learning too.</div>
      <div class="fb-followup-row">
        <label for="popFlagCorrection" style="width:100%;margin:0 0 6px;">What's actually right? (totally optional)</label>
      </div>
      <div class="fb-followup-row">
        <input type="text" id="popFlagCorrection" placeholder="Type it here if you want…" autocomplete="off">
        <button type="button" class="btn ghost" id="popFlagSaveCorrection">Save</button>
      </div>
      <button type="button" class="fb-link" id="popFlagFineAsIs">The word was fine as-is</button>
    </div>
  </div>
</div>

<script>
(function(){
"use strict";

/* ---------------- data: local dictionary + confusable pairs ---------------- */
var DICTIONARY = __WORDLIST__;
var DICT_SET = new Set(DICTIONARY);
var CONFUSABLE_GROUPS = __CONFUSABLE__;
var CONFUSABLE_MAP = {};
CONFUSABLE_GROUPS.forEach(function(g){ g.forEach(function(w){ CONFUSABLE_MAP[w] = g; }); });

var BY_LENGTH = {};
DICTIONARY.forEach(function(w){
  var L = w.length;
  (BY_LENGTH[L] = BY_LENGTH[L] || []).push(w);
});

function phoneticKey(w){
  var s = w.toLowerCase().replace(/[^a-z]/g,'');
  s = s.replace(/ph/g,'f').replace(/wh/g,'w').replace(/qu/g,'kw')
       .replace(/ck/g,'k').replace(/gh/g,'g').replace(/kn/g,'n').replace(/wr/g,'r');
  s = s.replace(/[aeiouy]+/g,'a');
  s = s.replace(/(.)\1+/g,'$1');
  return s;
}
var PHONETIC_MAP = {};
DICTIONARY.forEach(function(w){
  var k = phoneticKey(w);
  (PHONETIC_MAP[k] = PHONETIC_MAP[k] || []).push(w);
});

/* Damerau-Levenshtein distance, capped */
function editDistance(a,b,max){
  max = max || 3;
  if (Math.abs(a.length-b.length) > max) return max+1;
  var al=a.length, bl=b.length;
  var d = [];
  for (var i=0;i<=al;i++){ d[i]=[i]; }
  for (var j=0;j<=bl;j++){ d[0][j]=j; }
  for (i=1;i<=al;i++){
    for (j=1;j<=bl;j++){
      var cost = a[i-1]===b[j-1] ? 0 : 1;
      var val = Math.min(
        d[i-1][j]+1,
        d[i][j-1]+1,
        d[i-1][j-1]+cost
      );
      if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]){
        val = Math.min(val, d[i-2][j-2]+1);
      }
      d[i][j]=val;
    }
  }
  return d[al][bl];
}

function bestLocalSuggestion(word){
  var lw = word.toLowerCase();
  if (DICT_SET.has(lw)) return null;
  var candidates = [];
  for (var dl=-2; dl<=2; dl++){
    var L = lw.length+dl;
    if (BY_LENGTH[L]) candidates = candidates.concat(BY_LENGTH[L]);
  }
  var best=null, bestDist=3;
  for (var i=0;i<candidates.length;i++){
    var dist = editDistance(lw, candidates[i], 2);
    if (dist < bestDist){ bestDist = dist; best = candidates[i]; if (dist<=1) break; }
  }
  if (best) return {suggestion:best, confidence: bestDist<=1?'high':'medium'};
  var key = phoneticKey(lw);
  var pool = PHONETIC_MAP[key];
  if (pool && pool.length){
    var pbest=null, pbestDist=99;
    for (i=0;i<pool.length;i++){
      var d2 = editDistance(lw, pool[i], 5);
      if (d2 < pbestDist){ pbestDist=d2; pbest=pool[i]; }
    }
    if (pbest) return {suggestion:pbest, confidence:'low'};
  }
  return {suggestion:null, confidence:'low'};
}

// bestLocalSuggestion() above only ever returns its single closest-edit-distance
// guess -- but a garbled spelling can have more than one valid fix (e.g. "spiyn"
// is genuinely close to both "spin" and "spine"). This checks a student's OWN
// different answer against the same closeness rules used to generate that one
// guess, instead of requiring an exact match to it -- so "Check my fix" doesn't
// tell a student they're wrong just because they landed on a different real,
// close-enough word than our algorithm's single pick.
function isPlausibleSpellingFix(original, candidate){
  var lc = candidate.trim().toLowerCase().replace(/[^a-z']/g,'');
  if (!lc || !DICT_SET.has(lc)) return false;
  var lo = original.toLowerCase().replace(/[^a-z']/g,'');
  // A flat "within 2 edits" allowance is fair for a longer word but far too loose
  // for a short one: 2 edits can rewrite most of a 3-4 letter word into almost
  // anything real-word-shaped (e.g. "ove" -> "ok" is only 2 edits away, but that's
  // not a fix -- it's a different, nonsensical word that happens to be short
  // enough for 2 edits to cover). Scale the allowance down for short originals so
  // a fix has to be genuinely close, not just short enough for the flat cap to
  // swallow the whole word.
  var maxDist = lo.length <= 4 ? 1 : 2;
  if (editDistance(lo, lc, maxDist) <= maxDist) return true;
  return phoneticKey(lo) === phoneticKey(lc);
}

// Trims the letters an original misspelling and its correction share at the start
// and end, leaving just the piece that actually changed (e.g. "liyt" -> "late" boils
// down to "iyt" -> "ate"; "sumer" -> "summer" boils down to a dropped "m"). This is
// what lets the progress tab show the STUDENT'S actual recurring mix-up -- the same
// kind of letter swap or drop showing up across different words -- instead of just
// listing every misspelled word once, which wouldn't reveal any pattern at all.
function extractSpellingPattern(original, corrected){
  var a = (original||'').toLowerCase().replace(/[^a-z]/g,'');
  var b = (corrected||'').toLowerCase().replace(/[^a-z]/g,'');
  if (!a || !b || a === b) return null;
  var i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  var j = 0;
  while (j < a.length-i && j < b.length-i && a[a.length-1-j] === b[b.length-1-j]) j++;
  var from = a.slice(i, a.length-j);
  var to = b.slice(i, b.length-j);
  if (!from && !to) return null;
  return { from: from, to: to };
}

// isPlausibleSpellingFix() above only catches fixes that are still "close" to the
// original garbled spelling -- in letters or in how it sounds. But a student sounding
// out a hard word can land on a real, correct word that's actually quite FAR from
// their misspelling both ways (e.g. writing "liyt" while meaning "late", not "lit" --
// close-ish in letters, but the wrong word for "...getting liyt, I should go to bed").
// When the local check can't confirm a fix and the deeper AI check is turned on, ask
// it to judge the candidate by whether it makes sense in the SENTENCE -- the same kind
// of judgment call already used for "Say it" -- instead of by spelling closeness alone.
//
// This runs on the fast/cheap "quick" model tier, and asking it to jump straight to a
// bare true/false verdict turned out to be genuinely unreliable -- repeated live testing
// with the EXACT SAME sentence and candidate word ("notest" -> "noticed", an unambiguous
// correct fix) came back true about half the time and false the other half, with nothing
// in the input changing between calls. Asking for one short phrase of reasoning BEFORE
// the verdict (classic chain-of-thought) fixed this completely in that same testing --
// forcing the model to actually articulate what the sentence means before answering
// makes the fast tier consistently get it right, instead of pattern-matching straight to
// a coin-flip verdict.
async function aiWordFitsContext(f, candidate){
  var sample = null;
  try { sample = await claude.use("sample"); } catch(e){ sample = null; }
  if (!sample) return false;
  try{
    var before = state.text.slice(Math.max(0,f.start-70), f.start);
    var after = state.text.slice(f.end, f.end+70);
    var prompt = "A student with dyslexia originally wrote \""+f.original+"\" in this sentence: \""+before+"["+f.original+"]"+after+"\". "+
      "They're now trying the word \""+candidate+"\" instead of \""+f.original+"\". First, in one short phrase, explain what the sentence is saying and whether \""+candidate+"\" fits grammatically and logically in that exact spot. Then give your final verdict. "+
      "Judge ONLY whether it fits the sentence, not how close it is in spelling or sound to their original attempt. "+
      "Reply with ONLY a JSON object like {\"reasoning\":\"one short phrase\",\"fits\":true} or {\"reasoning\":\"one short phrase\",\"fits\":false}.";
    var result = await sample.json(prompt, { modelTier: "quick" });
    return !!(result && result.fits === true);
  }catch(e){ return false; }
}

function matchCase(sample, target){
  if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return target.toUpperCase();
  if (sample[0] === sample[0].toUpperCase()) return target.charAt(0).toUpperCase()+target.slice(1);
  return target;
}

/* ---------------- local pass ---------------- */
function localCheck(text){
  var flags = [];
  var re = /[A-Za-z']+/g;
  var m;
  while ((m = re.exec(text))) {
    var word = m[0];
    var lw = word.toLowerCase();
    var start = m.index, end = start+word.length;
    if (!DICT_SET.has(lw)) {
      var sug = bestLocalSuggestion(word);
      flags.push({
        start:start, end:end, original:word,
        suggestion: sug && sug.suggestion ? matchCase(word, sug.suggestion) : null,
        type:'spelling', source:'local', confidence: sug?sug.confidence:'low',
        explanation: sug && sug.suggestion ? "This isn't a word I know — did you mean “"+sug.suggestion+"”?" : "This isn't a word I recognize — check the spelling."
      });
    } else if (CONFUSABLE_MAP[lw]) {
      flags.push({
        start:start, end:end, original:word,
        suggestion:null, type:'confusable', source:'local', confidence:'low',
        explanation: "Easy to mix up with “"+CONFUSABLE_MAP[lw].filter(function(x){return x!==lw;}).join('” / “')+"” — worth a second look."
      });
    }
  }
  return flags;
}

/* ---------------- LLM pass ---------------- */
function buildPrompt(text, localFlags){
  // Each hint carries what the free local spellchecker already guessed, and how sure it is --
  // not just the bare word. The local checker can't read the sentence, so its guess is often
  // wrong for exactly the mistakes that matter most here (a real word used in the wrong context,
  // like "liyt" -> "lit" instead of "late"); telling the model what that guess was, and that it
  // may well be wrong, lets it correct a bad local guess instead of independently reinventing
  // one -- or just as usefully, confirm a good one instead of leaving it un-vetted.
  var hints = localFlags.map(function(f){
    return { word: f.original, localGuess: f.suggestion || null, confidence: f.confidence || 'medium' };
  }).slice(0,40);
  return "You are a patient, encouraging writing tutor for a child with dyslexia. " +
    "Find genuine spelling, grammar, punctuation and word-choice mistakes in the paragraph below — " +
    "especially “real word” mistakes, where a word is spelled correctly but is the WRONG word for the sentence " +
    "(very common in dyslexic writing — e.g. writing “licker” instead of “like”, or “grader” instead of “garden”). " +
    "Use the rest of the paragraph to figure out what the writer meant — not just the one sentence a mistake is " +
    "in, but the sentences BEFORE and AFTER it too, since the real meaning is often only clear from what happens " +
    "next. IMPORTANT: the word that sounds most alike, or is the most common word, is NOT always the right fix — " +
    "when a phonetically-close word would contradict the surrounding story, pick the word that fits the story " +
    "instead, even if it sounds less similar to the misspelling. For example, in \"Its getting liyt. I shud go " +
    "to bed.\", the phonetically obvious guess is \"light\" (as in daylight) — but that CONTRADICTS the very next " +
    "sentence: nobody says \"it's getting light out\" right before going to bed, that's when it gets dark and " +
    "LATE. So the correct fix here is \"late\", not \"light\", precisely because it fits the story even though " +
    "\"light\" sounds closer to the misspelling. Always check that your fix stays consistent with the surrounding " +
    "story (time of day, sequence of events, who's doing what) — story logic beats sound-alike guessing.\n\n" +
    "A quick local spellchecker already flagged these spots as possibly wrong. Its \"localGuess\" is a " +
    "context-free guess based only on how the word is spelled (null if it had no guess at all) — it cannot " +
    "read the sentence, so it is often wrong, especially for a real word used in the wrong context. " +
    "\"confidence\" is how sure the local checker itself is. For EACH one, read the full paragraph (not just its " +
    "own sentence) and decide: " +
    "CONFIRM it (return it with the SAME suggestion as localGuess) if that guess is actually the right fix; " +
    "REPLACE it (return it with a DIFFERENT suggestion) if localGuess is wrong but you can tell what the writer meant; " +
    "or CLEAR it (leave it out of your reply entirely) if the original word is actually fine in context:\n" +
    JSON.stringify(hints) + "\n\n" +
    "Rules:\n" +
    "- Only include things that are genuinely wrong. Do not suggest style changes or make it fancier.\n" +
    "- \"original\" must be an EXACT short snippet (1-6 words) copied verbatim from the paragraph, matching spelling and case.\n" +
    "- \"suggestion\" is the corrected version of just that snippet.\n" +
    "- \"explanation\" is one short, warm, simple sentence (max 18 words) a child would understand, explaining WHY using the meaning of the sentence — not just “this is a typo”.\n" +
    "- \"type\" is one of: spelling, grammar, punctuation, word choice.\n" +
    "- You may also flag genuine mistakes the local checker's hints above didn't mention.\n" +
    "- Reply with ONLY a JSON array, no other text. Example:\n" +
    "[{\"original\":\"he are\",\"suggestion\":\"he is\",\"type\":\"grammar\",\"explanation\":\"Use 'is' when talking about one person.\"}]\n\n" +
    "Paragraph:\n\"\"\"\n" + text + "\n\"\"\"";
}

function locateSnippet(text, snippet, usedRanges){
  if (!snippet) return null;
  function tryFind(hay, needle){
    var from = 0;
    while (true){
      var idx = hay.indexOf(needle, from);
      if (idx === -1) return -1;
      var overlaps = usedRanges.some(function(r){ return idx < r.end && idx+needle.length > r.start; });
      if (!overlaps) return idx;
      from = idx+1;
    }
  }
  var idx = tryFind(text, snippet);
  if (idx === -1) idx = tryFind(text.toLowerCase(), snippet.toLowerCase());
  if (idx === -1) return null;
  return {start:idx, end:idx+snippet.length};
}

/* ---------------- reading settings (font + text size) ----------------
   A student's most basic accommodation -- which font renders the text, and how big it is --
   shouldn't be buried in a browser zoom control. This is a small, always-available "Aa" panel
   in the header, persisted the same way the request asked for (localStorage, in both build
   targets, regardless of whether progress itself uses localStorage or Claude's db for this
   particular build), and applied via CSS custom properties so one JS write updates every
   reading surface (editor, reviewed text, popover) at once. */
var READ_PREFS_KEY = "secondlook_reading_prefs_v1";
var READ_FS_MIN = 18, READ_FS_MAX = 32, READ_FS_STEP = 2, READ_FS_DEFAULT = 18;
var openDyslexicInjected = false;

function loadReadPrefs(){
  var prefs = { font: 'atkinson', size: READ_FS_DEFAULT };
  try{
    var raw = localStorage.getItem(READ_PREFS_KEY);
    if (raw){
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.font === 'atkinson' || parsed.font === 'opendyslexic')) prefs.font = parsed.font;
      if (parsed && typeof parsed.size === 'number' && parsed.size >= READ_FS_MIN && parsed.size <= READ_FS_MAX) prefs.size = parsed.size;
    }
  }catch(e){}
  return prefs;
}
function saveReadPrefs(prefs){
  try{ localStorage.setItem(READ_PREFS_KEY, JSON.stringify(prefs)); }catch(e){}
}

// OpenDyslexic isn't on Google Fonts, so it's loaded on demand from a public CDN mirror of
// the open-source typeface -- only when a student actually picks it, not on every page load.
// If a host environment's content policy blocks that external stylesheet (some sandboxed
// viewers only allow Google Fonts), the font-family fallback chain quietly lands back on
// Atkinson Hyperlegible instead of breaking anything -- a student never sees an error, just
// whichever legible font their environment actually let load.
function ensureOpenDyslexicLoaded(){
  if (openDyslexicInjected) return;
  openDyslexicInjected = true;
  try{
    var style = document.createElement('style');
    style.textContent =
      '@font-face{font-family:"OpenDyslexicShared";font-weight:400;font-style:normal;' +
      'src:url("https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/woff/OpenDyslexic-Regular.woff") format("woff");}' +
      '@font-face{font-family:"OpenDyslexicShared";font-weight:700;font-style:normal;' +
      'src:url("https://cdn.jsdelivr.net/gh/antijingoist/open-dyslexic@master/woff/OpenDyslexic-Bold.woff") format("woff");}';
    document.head.appendChild(style);
  }catch(e){}
}

var rsFontAtkinson = document.getElementById('rsFontAtkinson');
var rsFontOpenDyslexic = document.getElementById('rsFontOpenDyslexic');
var rsSizeVal = document.getElementById('rsSizeVal');
var rsSizeUp = document.getElementById('rsSizeUp');
var rsSizeDown = document.getElementById('rsSizeDown');
var readPrefs = loadReadPrefs();

function applyReadPrefs(){
  document.documentElement.style.setProperty('--read-fs', readPrefs.size + 'px');
  document.documentElement.setAttribute('data-read-font', readPrefs.font);
  if (readPrefs.font === 'opendyslexic') ensureOpenDyslexicLoaded();
  rsFontAtkinson.setAttribute('aria-pressed', String(readPrefs.font === 'atkinson'));
  rsFontOpenDyslexic.setAttribute('aria-pressed', String(readPrefs.font === 'opendyslexic'));
  rsSizeVal.textContent = readPrefs.size + 'px';
  rsSizeDown.disabled = readPrefs.size <= READ_FS_MIN;
  rsSizeUp.disabled = readPrefs.size >= READ_FS_MAX;
}
applyReadPrefs();

rsFontAtkinson.addEventListener('click', function(){
  readPrefs.font = 'atkinson'; saveReadPrefs(readPrefs); applyReadPrefs();
});
rsFontOpenDyslexic.addEventListener('click', function(){
  readPrefs.font = 'opendyslexic'; saveReadPrefs(readPrefs); applyReadPrefs();
});
rsSizeUp.addEventListener('click', function(){
  readPrefs.size = Math.min(READ_FS_MAX, readPrefs.size + READ_FS_STEP);
  saveReadPrefs(readPrefs); applyReadPrefs();
});
rsSizeDown.addEventListener('click', function(){
  readPrefs.size = Math.max(READ_FS_MIN, readPrefs.size - READ_FS_STEP);
  saveReadPrefs(readPrefs); applyReadPrefs();
});

var btnReadingSettings = document.getElementById('btnReadingSettings');
var rsPanel = document.getElementById('rsPanel');
function closeReadingSettings(){
  rsPanel.hidden = true;
  btnReadingSettings.setAttribute('aria-expanded', 'false');
}
btnReadingSettings.addEventListener('click', function(){
  var willOpen = rsPanel.hidden;
  rsPanel.hidden = !willOpen;
  btnReadingSettings.setAttribute('aria-expanded', String(willOpen));
});
document.addEventListener('click', function(e){
  if (!rsPanel.hidden && !rsPanel.contains(e.target) && e.target !== btnReadingSettings){
    closeReadingSettings();
  }
});
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && !rsPanel.hidden) closeReadingSettings();
});

/* ---------------- app state ---------------- */
var state = {
  text: "",
  flags: [],           // {start,end,original,suggestion,type,source,explanation,status:'open'|'fixed'|'revealed'|'skipped'}
  reviewing: false,
  sessions: [],
  feedback: [],          // {word,suggestion,sentence,layer,type,model,studentCorrection,wasFineAsIs,timestamp} -- see reportFlag()
  // Practice-sentence-generator additions (backwards-compatible: absent in any
  // progress doc saved before this feature, and every reader below defaults them
  // to {} / 0 rather than assuming they exist). wordErrors counts how many times
  // each misspelled word has been self-corrected; confusionErrors does the same
  // for a wrong-word pair, keyed "a/b" (alphabetical) so "their"/"there" always
  // lands under the same key regardless of which direction the mistake ran.
  wordErrors: {},        // { "<word>": <count> }
  confusionErrors: {},   // { "a/b": { correctCounts: {a:n,b:n}, total:n } }
  practiceStreaks: {},   // { "<target key>": <consecutive correct-in-practice count> } -- 3+ retires a target
  practiceSessions: 0,
  practiceRounds: []    // [{date, score}] -- score 0-100, first-try-correct rate; feeds the chart's practice-round points
};

var editor = document.getElementById('editor');
var reviewedEl = document.getElementById('reviewed');
var wordcountEl = document.getElementById('wordcount');
var statusEl = document.getElementById('status');
var bannersEl = document.getElementById('banners');
var btnCheck = document.getElementById('btnCheck');
var btnEditAgain = document.getElementById('btnEditAgain');
var btnFinish = document.getElementById('btnFinish');
var useAI = document.getElementById('useAI');

// General-purpose word counter -- used by the editor's live wordcount, the uploaded-file
// wordcount, and the AI-check length limit below. Kept as one shared function rather than
// three inline copies now that none of its callers are Read-tab-specific anymore.
function countWords(t){
  var trimmed = (t||'').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function updateEditorWordcount(){
  var words = countWords(editor.value);
  wordcountEl.textContent = words + (words===1?' word':' words');
}
editor.addEventListener('input', updateEditorWordcount);

document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(t){ t.setAttribute('aria-selected', t===tab ? 'true':'false'); });
    document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
    document.getElementById('view-'+tab.dataset.view).classList.add('active');
    if (tab.dataset.view === 'progress') renderProgress();
  });
});

function setStatus(msg, busy){
  statusEl.textContent = msg || "";
  statusEl.classList.toggle('busy', !!busy);
}
function showBanner(kind, msg){
  bannersEl.innerHTML = '<div class="banner '+kind+'">'+msg+'</div>';
}
function clearBanner(){ bannersEl.innerHTML = ""; }
function showUploadBanner(kind, msg){
  document.getElementById('uploadBanner').innerHTML = msg ? ('<div class="banner '+kind+'">'+msg+'</div>') : "";
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderReviewed(){
  var text = state.text;
  var flags = state.flags.slice().sort(function(a,b){ return a.start-b.start; });

  // Every other word is clickable too, so a word the checker missed or wasn't
  // sure about (like a real-word mix-up it never flagged) can still be asked about by hand.
  var askRanges = [];
  var re = /[A-Za-z']+/g, m;
  while ((m = re.exec(text))) {
    var s = m.index, e = s + m[0].length;
    var overlap = flags.some(function(f){ return s < f.end && e > f.start; });
    if (!overlap) askRanges.push({start:s, end:e});
  }
  var regions = flags.map(function(f,i){ return {start:f.start, end:f.end, kind:'flag', idx:i}; })
    .concat(askRanges.map(function(r){ return {start:r.start, end:r.end, kind:'ask'}; }));
  regions.sort(function(a,b){ return a.start-b.start; });

  var out = "";
  var pos = 0;
  regions.forEach(function(r){
    if (r.start < pos) return;
    out += escapeHtml(text.slice(pos, r.start));
    if (r.kind === 'flag'){
      var f = flags[r.idx];
      var cls = 'f-' + f.type.replace(' ','_');
      var resolvedCls = f.status !== 'open' ? ' resolved' : '';
      out += '<mark class="'+cls+resolvedCls+'" data-kind="flag" data-idx="'+r.idx+'">'+escapeHtml(text.slice(r.start,r.end))+'</mark>';
    } else {
      out += '<span class="askword" data-kind="ask" data-start="'+r.start+'" data-end="'+r.end+'">'+escapeHtml(text.slice(r.start,r.end))+'</span>';
    }
    pos = r.end;
  });
  out += escapeHtml(text.slice(pos));
  reviewedEl.innerHTML = out || "<span style=\"color:var(--text-muted)\">(empty)</span>";

  reviewedEl.querySelectorAll('mark').forEach(function(el){
    el.addEventListener('click', function(){
      var idx = +el.dataset.idx;
      openPopover(state.flags.indexOf(flags[idx]));
    });
  });
  reviewedEl.querySelectorAll('.askword').forEach(function(el){
    el.addEventListener('click', function(){
      var start = +el.dataset.start, end = +el.dataset.end;
      var already = state.flags.findIndex(function(f){ return f.start < end && f.end > start; });
      if (already > -1){ openPopover(already); return; }
      state.flags.push({
        start:start, end:end, original: state.text.slice(start,end), suggestion:null,
        type:'ask', source:'manual', status:'open',
        explanation:"Want help with this word? Type what you think it should be, or press “Say it” and speak it out loud."
      });
      openPopover(state.flags.length-1);
    });
  });
}

function spliceText(flagIndex, newWord){
  var f = state.flags[flagIndex];
  var oldStart = f.start, oldEnd = f.end;
  var delta = newWord.length - (oldEnd - oldStart);
  state.text = state.text.slice(0, oldStart) + newWord + state.text.slice(oldEnd);
  state.flags.forEach(function(other){
    if (other === f) return;
    if (other.start >= oldEnd){
      other.start += delta; other.end += delta;
    }
  });
  f.start = oldStart; f.end = oldStart + newWord.length;
}

/* ---------------- popover ---------------- */
var overlay = document.getElementById('overlay');
var popKind = document.getElementById('popKind');
var popOriginal = document.getElementById('popOriginal');
var popExplain = document.getElementById('popExplain');
var popInput = document.getElementById('popInput');
var popFeedback = document.getElementById('popFeedback');
var popReveal = document.getElementById('popReveal');
var currentFlagIndex = null;

var TYPE_LABEL = {spelling:'Spelling', grammar:'Grammar', punctuation:'Punctuation', confusable:'Wrong word', 'word choice':'Wrong word', ask:'Need help?'};
var TYPE_VAR = {spelling:'warn', grammar:'info', punctuation:'special', confusable:'confusable', 'word choice':'confusable', ask:'accent'};
var popVoiceHint = document.getElementById('popVoiceHint');

function openPopover(idx){
  currentFlagIndex = idx;
  var f = state.flags[idx];
  var v = TYPE_VAR[f.type] || 'warn';
  popKind.textContent = TYPE_LABEL[f.type] || f.type;
  popKind.style.background = v==='accent' ? 'var(--accent-soft)' : 'var(--'+v+'-soft)';
  popKind.style.color = v==='accent' ? 'var(--accent-strong)' : 'var(--'+v+')';
  popOriginal.innerHTML = f.type==='ask' ? '“'+escapeHtml(f.original)+'”' : '“<s>'+escapeHtml(f.original)+'</s>”';
  popExplain.textContent = f.explanation || "Take a look at this part.";
  popInput.value = f.status === 'open' ? "" : (f.userAnswer || "");
  popFeedback.textContent = "";
  popFeedback.className = "feedback";
  popReveal.classList.remove('show');
  popReveal.textContent = "";
  // nudge toward the mic whenever there's no confident suggestion to fall back on --
  // this is exactly the case (a real word used wrongly, like "licker" for "like") where
  // hearing the word said aloud catches things text-only checking misses.
  popVoiceHint.style.display = !f.suggestion ? 'flex' : 'none';
  resetFlagFeedbackUI(f);
  overlay.classList.add('show');
  setTimeout(function(){ popInput.focus(); }, 50);
}
function closePopover(){
  // an unresolved "ask" flag was just exploratory -- don't leave a permanent mark behind for it
  if (currentFlagIndex !== null){
    var f = state.flags[currentFlagIndex];
    if (f && f.type === 'ask' && f.status === 'open'){
      state.flags.splice(currentFlagIndex, 1);
      renderReviewed();
    }
  }
  overlay.classList.remove('show');
  currentFlagIndex = null;
}
document.getElementById('popClose').addEventListener('click', closePopover);
overlay.addEventListener('click', function(e){ if (e.target===overlay) closePopover(); });

function normalize(s){ return s.trim().toLowerCase().replace(/[.,!?;:"']/g,''); }

document.getElementById('popTry').addEventListener('click', async function(){
  var f = state.flags[currentFlagIndex];
  var val = popInput.value.trim();
  if (!val){ popFeedback.textContent = "Type your best guess first."; popFeedback.className="feedback"; return; }
  f.userAnswer = val;
  var target = f.suggestion;
  var exactMatch = target ? normalize(val) === normalize(target) : normalize(val) !== normalize(f.original);
  // A misspelled word can have more than one valid fix, but our local suggester
  // only ever offers its single closest guess -- don't reject a student's
  // different-but-also-correct answer (e.g. "spine" when we guessed "spin" for
  // "spiyn") just because it doesn't match that one guess verbatim.
  var altMatch = !exactMatch && f.type === 'spelling' && f.source === 'local' && isPlausibleSpellingFix(f.original, val);
  var accepted = exactMatch ? (target || val) : (altMatch ? val : null);
  // Still no match? If it's at least a real dictionary word and the deeper AI check is
  // on, don't reject it purely for being spelling-distant from the original garbled
  // word -- ask whether it actually makes sense in the sentence instead. This is what
  // catches "liyt" -> "late" (a real fix, but not spelling-close to "liyt" at all).
  //
  // A single garbled word can also need to become MORE than one real word to be right
  // (e.g. "froow" in "...in froow the door" was reaching for "front", but "front" alone
  // still leaves the sentence wrong -- the actual fix is the two-word "front of"). The
  // old check stripped every character that wasn't a letter or apostrophe, which also
  // strips the space between words -- so "front of" collapsed into "frontof", which of
  // course isn't in the dictionary, and a perfectly good multi-word fix was rejected
  // before the AI ever got a chance to judge it. Checking each word of the typed answer
  // against the dictionary (instead of the whole answer as one squashed-together string)
  // lets a real phrase through to the same AI judgment call a single real word already got.
  if (!accepted && f.type === 'spelling' && f.source === 'local' && useAI.checked){
    var candidateWords = val.toLowerCase().replace(/[^a-z' ]/g,'').trim().split(/\s+/).filter(Boolean);
    var isRealWordOrPhrase = candidateWords.length > 0 && candidateWords.every(function(w){ return DICT_SET.has(w); });
    if (isRealWordOrPhrase){
      popFeedback.textContent = "That's a real word — checking if it fits here…";
      popFeedback.className = "feedback";
      var fits = await aiWordFitsContext(f, val);
      if (fits) accepted = val;
    }
  }
  if (accepted){
    popFeedback.textContent = "✅ Nice fix!";
    popFeedback.className = "feedback good";
    f.status = 'fixed';
    spliceText(currentFlagIndex, accepted);
    speak(accepted);
    setTimeout(function(){ closePopover(); renderReviewed(); checkAllResolved(); }, 700);
  } else {
    popFeedback.textContent = "Not quite — want a hint? Try “Hear it” or “Show me”.";
    popFeedback.className = "feedback bad";
  }
});

document.getElementById('popHear').addEventListener('click', function(){
  var f = state.flags[currentFlagIndex];
  var target = f.suggestion || f.original;
  var before = state.text.slice(Math.max(0,f.start-40), f.start).split(' ').slice(-5).join(' ');
  var after = state.text.slice(f.end, f.end+40).split(' ').slice(0,5).join(' ');
  speak((before+' '+target+' '+after).trim());
});

/* ---------------- speak-it-instead-of-typing-it ----------------
   Text-only checking runs out of ideas fast on a real-word swap like
   "licker" for "like" -- there's no misspelling to fix, just the wrong
   word. Hearing the student say the word out loud gives a second,
   independent signal (how it SOUNDS) instead of only how it's spelled,
   so it catches cases the text-based passes are stuck on. */
var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
var recognizer = null;
var popMic = document.getElementById('popMic');
if (SpeechRec){
  try {
    recognizer = new SpeechRec();
    recognizer.lang = 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
  } catch(e){ recognizer = null; }
}
if (!recognizer) popMic.style.display = 'none';

var micListening = false;
var micTimeout = null;
var micBlockedForSession = false; // set once we get a non-retryable error, so we stop offering something that can't work here

function setMicListening(on){
  micListening = on;
  popMic.classList.toggle('listening', on);
  popMic.textContent = on ? '🎤 Listening…' : '🎤 Say it';
}

// Speech recognition needs microphone access, which some embedded/iframed views
// block for pages they didn't grant it to directly -- so failures here are reported
// explicitly instead of a generic "didn't catch that", since the real cause is
// usually "the mic never turned on at all", not "it misheard you".
function micErrorMessage(code){
  switch(code){
    case 'not-allowed':
    case 'permission-denied':
      return { text:"Microphone access was blocked or never prompted — look for a mic icon in your address bar, or open this page in its own browser tab instead of inside Claude, then try again.", retry:true };
    case 'no-speech':
      return { text:"I didn't hear anything — press “Say it” and speak right away.", retry:true };
    case 'audio-capture':
      return { text:"No microphone was found on this device.", retry:true };
    case 'network':
      return { text:"Voice input needs an internet connection to work.", retry:true };
    case 'service-not-allowed':
      return { text:"Voice input isn't allowed in this window (this can happen inside an embedded page) — try opening this artifact in its own browser tab, or just type your answer.", retry:false };
    case 'aborted':
      return { text:"Voice input stopped early — try again.", retry:true };
    default:
      return { text:"Voice input didn't work here (" + (code || "unknown error") + ") — type your answer instead.", retry:false };
  }
}

if (recognizer){
  recognizer.onresult = function(e){
    if (micTimeout) { clearTimeout(micTimeout); micTimeout = null; }
    var transcript = (e.results[0] && e.results[0][0] && e.results[0][0].transcript || '').trim();
    if (transcript) handleSpokenWord(transcript);
    else { popFeedback.textContent = "I didn't catch a word there — try again."; popFeedback.className = "feedback bad"; }
  };
  recognizer.onerror = function(e){
    if (micTimeout) { clearTimeout(micTimeout); micTimeout = null; }
    var info = micErrorMessage(e && e.error);
    popFeedback.textContent = info.text;
    popFeedback.className = "feedback bad";
    if (!info.retry){
      micBlockedForSession = true;
      popMic.disabled = true;
      popMic.title = "Voice input isn't available here — try typing instead.";
    }
  };
  recognizer.onend = function(){ setMicListening(false); };
}

popMic.addEventListener('click', function(){
  if (!recognizer || micListening) return;
  if (micBlockedForSession){
    popFeedback.textContent = "Voice input isn't available in this window — type your answer instead.";
    popFeedback.className = "feedback bad";
    return;
  }
  popFeedback.textContent = "";
  popFeedback.className = "feedback";
  setMicListening(true);
  // guard against the mic silently hanging (no onresult/onerror/onend at all) --
  // that reads to a student as "I said it and nothing happened".
  micTimeout = setTimeout(function(){
    if (micListening){
      try { recognizer.stop(); } catch(e){}
      setMicListening(false);
      popFeedback.textContent = "That took too long — the microphone may be blocked here. Try opening this artifact in its own browser tab, or just type your answer.";
      popFeedback.className = "feedback bad";
    }
  }, 8000);
  try {
    recognizer.start();
  } catch(e){
    if (micTimeout) { clearTimeout(micTimeout); micTimeout = null; }
    setMicListening(false);
    popFeedback.textContent = "Couldn't start the microphone (" + ((e && e.name) || "error") + ") — type your answer instead.";
    popFeedback.className = "feedback bad";
    micBlockedForSession = true;
    popMic.disabled = true;
  }
});

async function handleSpokenWord(transcript){
  var f = state.flags[currentFlagIndex];
  if (!f) return;
  var heard = transcript.replace(/[.,!?;:]+$/,'');
  popInput.value = heard;

  // already have a confident suggestion? just check what they said against it, like typing would.
  if (f.suggestion){
    popFeedback.textContent = "Heard “"+heard+"” — press “Check my fix” to see if that's it.";
    popFeedback.className = "feedback";
    return;
  }
  // no suggestion yet (the tricky case): if what they SAID is a real, known word, offer it right away --
  // no AI call needed, this is just the local dictionary confirming a real word was spoken.
  var lw = heard.toLowerCase().replace(/[^a-z']/g,'');
  if (DICT_SET.has(lw)){
    var cased = matchCase(f.original, lw);
    f.suggestion = cased;
    f.explanation = "You said “"+heard+"” — that fits! Press “Check my fix” to use it.";
    popExplain.textContent = f.explanation;
    popInput.value = cased;
    popFeedback.textContent = "";
    popVoiceHint.style.display = 'none';
    return;
  }
  // otherwise ask Claude to combine the spelling AND how it sounded -- a small, fast, targeted
  // call (not the full paragraph pass), since this is one word with one extra clue, not a re-check.
  popFeedback.textContent = "Thinking about how that sounds…";
  popFeedback.className = "feedback";
  var sample = null;
  try { sample = await claude.use("sample"); } catch(e){ sample = null; }
  if (!sample){
    popFeedback.textContent = "Heard “"+heard+"” — type it in if that's what you meant.";
    return;
  }
  try{
    var before = state.text.slice(Math.max(0,f.start-70), f.start);
    var after = state.text.slice(f.end, f.end+70);
    var prompt = "A student with dyslexia wrote the word \""+f.original+"\" in this sentence: \""+before+"["+f.original+"]"+after+"\". "+
      "It might be wrong. They just said the word out loud to help explain what they meant, and it sounded like \""+heard+"\". "+
      "Using BOTH how they spelled it and how it sounded, figure out the one correctly-spelled English word that fits the sentence. "+
      "Reply with ONLY a JSON object like {\"suggestion\":\"garden\",\"explanation\":\"one short, warm sentence a child would understand\"}.";
    var result = await sample.json(prompt, { modelTier: "quick" });
    if (result && typeof result.suggestion === 'string'){
      f.suggestion = matchCase(f.original, result.suggestion);
      f.explanation = result.explanation || ("Based on how you said it, this should be “"+result.suggestion+"”.");
      f.type = f.type === 'ask' ? 'word choice' : f.type;
      popExplain.textContent = f.explanation;
      popInput.value = f.suggestion;
      popFeedback.textContent = "";
      popVoiceHint.style.display = 'none';
    } else {
      popFeedback.textContent = "Heard “"+heard+"” — type it in if that's what you meant.";
    }
  }catch(e){
    popFeedback.textContent = "Heard “"+heard+"” — type it in if that's what you meant.";
  }
}

document.getElementById('popShow').addEventListener('click', function(){
  var f = state.flags[currentFlagIndex];
  if (f.suggestion){
    // Only a suggestion the AI actually double-checked in context (verifiedByAI) earns the
    // confident "The fix" phrasing. A local-only guess -- including one the AI was told about
    // but never confirmed or replaced -- gets a softer, honest wording instead, so a kid never
    // gets told "this is the fix" for something nobody actually verified against the sentence.
    popReveal.textContent = f.verifiedByAI
      ? "The fix: “"+f.suggestion+"”"
      : "My best guess is “"+f.suggestion+"” — I haven't double-checked it in your sentence.";
    popReveal.classList.add('show');
    popInput.value = f.suggestion;
  } else {
    popReveal.textContent = "Try sounding it out slowly, letter by letter.";
    popReveal.classList.add('show');
  }
});

document.getElementById('popSkip').addEventListener('click', function(){
  var f = state.flags[currentFlagIndex];
  f.status = 'skipped';
  closePopover();
  renderReviewed();
  checkAllResolved();
});

function checkAllResolved(){
  var open = state.flags.filter(function(f){ return f.status === 'open'; }).length;
  if (open === 0 && state.flags.length){
    setStatus("All spots checked! Press “Finish & save progress” when you're ready.");
  }
}

/* ---------------- "this looks wrong" flag feedback ----------------
   A wrong suggestion delivered with total confidence is the worst dynamic for a
   dyslexic student who already doubts their own instincts -- the app should be
   able to say "I might be wrong here" as easily as the student can. One tap is
   the whole requirement (never gated behind typing); an optional second step
   lets them add what they think is actually right, or say the flag itself
   shouldn't have fired at all. Every report doubles as real signal: which
   layer (local dictionary vs. AI) and, for AI catches, which model produced
   the miss -- exactly what's needed to spot a recurring bad pattern later. */
function sentenceAround(text, start, end){
  var left = Math.max(text.lastIndexOf('.', start-1), text.lastIndexOf('?', start-1), text.lastIndexOf('!', start-1));
  var from = left === -1 ? 0 : left+1;
  var candidates = ['.','?','!'].map(function(ch){ return text.indexOf(ch, end); }).filter(function(i){ return i !== -1; });
  var to = candidates.length ? Math.min.apply(null, candidates)+1 : text.length;
  return text.slice(from, to).trim();
}

var popFlagWrong = document.getElementById('popFlagWrong');
var popFbFooter = document.getElementById('popFbFooter');
var popFlagFollowup = document.getElementById('popFlagFollowup');
var popFlagCorrection = document.getElementById('popFlagCorrection');

function resetFlagFeedbackUI(f){
  popFlagCorrection.value = "";
  if (f.type === 'ask'){
    // a self-initiated lookup isn't a suggestion the app made -- nothing to flag as wrong
    popFbFooter.style.display = 'none';
    popFlagFollowup.style.display = 'none';
    return;
  }
  popFbFooter.style.display = 'block';
  if (f.feedbackIdx != null){
    // already reported this flag earlier in this same session -- keep the thank-you
    // showing (and still allow adding/editing an optional correction) instead of
    // letting a re-open of the same popover log a second, duplicate report.
    popFbFooter.style.display = 'none';
    popFlagFollowup.style.display = 'block';
    var existing = state.feedback[f.feedbackIdx];
    if (existing && existing.studentCorrection) popFlagCorrection.value = existing.studentCorrection;
  } else {
    popFlagFollowup.style.display = 'none';
  }
}

function reportFlag(flagIndex){
  var f = state.flags[flagIndex];
  if (f.feedbackIdx != null) return; // already logged; the follow-up UI just edits it from here
  var record = {
    word: f.original,
    suggestion: f.suggestion || null,
    sentence: sentenceAround(state.text, f.start, f.end),
    layer: f.source,             // 'local' or 'ai'
    type: f.type,
    model: f.source === 'ai' ? (f.model || null) : null,
    studentCorrection: null,
    wasFineAsIs: false,
    timestamp: new Date().toISOString()
  };
  state.feedback.push(record);
  f.feedbackIdx = state.feedback.length - 1;
  saveFeedback();
}

popFlagWrong.addEventListener('click', function(){
  reportFlag(currentFlagIndex);
  popFbFooter.style.display = 'none';
  popFlagFollowup.style.display = 'block';
});

document.getElementById('popFlagSaveCorrection').addEventListener('click', function(){
  var f = state.flags[currentFlagIndex];
  if (f.feedbackIdx == null) return;
  var val = popFlagCorrection.value.trim();
  state.feedback[f.feedbackIdx].studentCorrection = val || null;
  state.feedback[f.feedbackIdx].wasFineAsIs = false;
  saveFeedback();
});

document.getElementById('popFlagFineAsIs').addEventListener('click', function(){
  var f = state.flags[currentFlagIndex];
  if (f.feedbackIdx == null) return;
  state.feedback[f.feedbackIdx].wasFineAsIs = true;
  state.feedback[f.feedbackIdx].studentCorrection = null;
  saveFeedback();
});

/* ---------------- speech ---------------- */
function speak(t){
  try{
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
document.getElementById('btnReadAloud').addEventListener('click', function(){
  var t = state.reviewing ? state.text : editor.value;
  if (t.trim()) speak(t);
});

/* ---------------- check flow ---------------- */
btnCheck.addEventListener('click', function(){
  var text = editor.value.trim();
  if (!text){ setStatus("Write a paragraph first."); return; }
  clearBanner();
  state.text = text;
  var localFlags = localCheck(text);
  localFlags.forEach(function(f){ f.status='open'; });
  state.flags = localFlags;
  state.reviewing = true;
  editor.style.display = 'none';
  reviewedEl.style.display = 'block';
  btnCheck.style.display = 'none';
  btnEditAgain.style.display = 'inline-flex';
  btnFinish.style.display = 'inline-flex';
  renderReviewed();

  if (!useAI.checked){
    setStatus(localFlags.length ? ("Instant check found "+localFlags.length+" spot"+(localFlags.length===1?"":"s")+" to look at.") : "Instant check found nothing — nice work!");
    return;
  }
  setStatus("Instant check found "+localFlags.length+" possible spot"+(localFlags.length===1?"":"s")+". Asking Claude for a deeper look…", true);
  runAIPass(text, localFlags);
});

// There's no length cap on what a student can put in the editor (an uploaded PDF or photo
// can turn into a very long paragraph), so the deeper AI pass -- unlike the free local
// check just above it, which always runs on the full text -- only reads roughly the first
// AI_CHECK_MAX_WORDS words. That keeps one huge upload from becoming a giant, slow prompt.
// Plain string/regex work with nothing build-target-specific in it, so this same function
// (unlike the sample.json/callAI split right below it) carries over unmodified into the
// public build.
var AI_CHECK_MAX_WORDS = 2000;
function truncateForAICheck(text){
  var re = /\S+/g, match, count = 0, cutIndex = -1;
  while ((match = re.exec(text)) !== null){
    count++;
    if (count === AI_CHECK_MAX_WORDS){ cutIndex = match.index + match[0].length; break; }
  }
  if (cutIndex === -1) return { text: text, truncated: false };
  return { text: text.slice(0, cutIndex), truncated: true };
}

async function runAIPass(text, localFlags){
  var sample = null;
  try { sample = await claude.use("sample"); } catch(e){ sample = null; }
  if (!sample){
    setStatus("Deeper AI check isn't available right now — showing the instant results only.");
    showBanner('info', "AI checking isn't available in this view, so only the instant spelling check ran.");
    return;
  }
  var aiCheck = truncateForAICheck(text);
  var aiText = aiCheck.text;
  try{
    var hintFlags = localFlags.filter(function(f){ return f.end <= aiText.length; });
    var prompt = buildPrompt(aiText, hintFlags);
    var result = await sample.json(prompt, { modelTier: "complex" });
    if (!Array.isArray(result)) throw new Error("bad shape");
    // Starts empty on purpose, NOT seeded from the existing local flags: a local flag's
    // own span is exactly where an AI item upgrading that same spot needs to be found,
    // and for a word that appears only once in the paragraph (the common case), seeding
    // this with the local flags' spans made that single occurrence look "already used"
    // before the AI item ever got a chance to claim it -- so locateSnippet() would
    // always fail to relocate it, and the AI's (often more informative) catch would
    // silently vanish with no error, looking exactly like "the AI check isn't doing
    // anything". Each item's own loc is still pushed in below, so two AI items in the
    // same pass still can't both claim the identical occurrence of a repeated word.
    var used = [];
    var aiLocs = []; // exact spans the AI actually confirmed, for precise per-occurrence noise reduction below
    var added = 0, upgraded = 0;
    // The AI can return more than one item touching the SAME spot -- e.g. a broad
    // catch covering a whole clause ("Even no she will never amite to it.") and a
    // narrower one nested inside it ("amite" alone). Without tracking which flags
    // this pass has already claimed, the second item would silently overwrite the
    // first at the same array slot, and whichever came first (often the more
    // informative, broader catch) would just vanish with no error or trace --
    // exactly the kind of thing that looks like "the AI check isn't doing anything"
    // even though it genuinely found and returned both issues. Each existing flag
    // may be upgraded by at most one AI item per pass; anything else that would
    // land on an already-claimed spot becomes its own additional flag instead of
    // clobbering it, so no genuine catch is thrown away.
    var claimedIdx = {};
    result.forEach(function(item){
      if (!item || typeof item.original !== 'string' || typeof item.suggestion !== 'string') return;
      var loc = locateSnippet(aiText, item.original, used);
      if (!loc) return;
      used.push(loc);
      aiLocs.push(loc);
      // does this overlap an existing, not-yet-claimed local flag? if so, upgrade it
      var overlapIdx = -1;
      state.flags.forEach(function(f,i){ if (!claimedIdx[i] && f.start < loc.end && f.end > loc.start) overlapIdx = i; });
      var type = (item.type||'spelling').toLowerCase().indexOf('word')===0 ? 'word choice' : item.type;
      if (['spelling','grammar','punctuation','word choice'].indexOf(type)===-1) type = 'grammar';
      if (overlapIdx > -1){
        var f = state.flags[overlapIdx];
        f.start = loc.start; f.end = loc.end; f.original = item.original;
        f.suggestion = item.suggestion; f.type = type; f.source='ai'; f.model='ai-pass'; f.explanation = item.explanation || f.explanation;
        f.verifiedByAI = true; f.aiVerdict = 'confirmed';
        claimedIdx[overlapIdx] = true;
        upgraded++;
      } else {
        state.flags.push({
          start:loc.start, end:loc.end, original:item.original, suggestion:item.suggestion,
          type:type, source:'ai', model:'ai-pass', status:'open', explanation: item.explanation || ("This should be “"+item.suggestion+"”."),
          verifiedByAI: true, aiVerdict: 'confirmed'
        });
        claimedIdx[state.flags.length-1] = true;
        added++;
      }
    });
    // Every hint told the AI where the local checker already thought something was wrong.
    // Anything still sitting there with its original local guess, untouched by the loop above,
    // is one the AI never backed up -- either it looked and decided the word was actually fine
    // (a CLEAR), or it just didn't get to it. Either way, keep the local guess (it's often still
    // useful) but mark it so the popover can be honest that nothing double-checked it in context,
    // instead of presenting an unvetted guess with the same confidence as an AI-verified one.
    hintFlags.forEach(function(f){
      if (f.source === 'local' && !f.verifiedByAI) f.aiVerdict = 'unconfirmed';
    });
    // drop local-only spelling flags the AI looked at but didn't confirm (reduce noise),
    // but only when AI actually returned results (already inside try) and only for LOW-confidence local guesses.
    // Checked by exact span overlap against what the AI actually confirmed (aiLocs) rather than a text-wide
    // substring search -- a word like "its" can appear more than once in a paragraph, correctly one place and
    // wrongly another, and a substring match can't tell those occurrences apart.
    state.flags = state.flags.filter(function(f){
      if (f.source === 'local' && f.confidence === 'low' && f.type==='confusable') {
        return aiLocs.some(function(loc){ return loc.start < f.end && loc.end > f.start; });
      }
      return true;
    });
    renderReviewed();
    var aiBannerMsgs = [];
    if (aiCheck.truncated){
      aiBannerMsgs.push("This document is long, so the deeper AI check only looked at the first ~2,000 words — the instant check above covered the whole thing.");
    }
    if (result.partial){
      aiBannerMsgs.push("Some of the deeper check's results may be incomplete — a fresh check can help fill in the rest.");
    }
    if (aiBannerMsgs.length) showBanner('info', aiBannerMsgs.join(' '));
    setStatus("Deeper check complete — "+state.flags.filter(function(f){return f.status==='open';}).length+" spot"+(state.flags.length===1?"":"s")+" to look at.");
  }catch(e){
    var code = e && e.code;
    if (code === 'not_granted'){
      showBanner('info', "AI checking needs your permission — showing the instant results only for now.");
    } else if (code === 'rate_limited'){
      showBanner('warn', "You've used a lot of AI checks right now — try again in a bit. Instant results are still shown.");
    } else if (code === 'cancelled'){
      // no-op
    } else {
      showBanner('warn', "The deeper check hit a snag — showing the instant results only.");
    }
    setStatus("");
  }
}

btnEditAgain.addEventListener('click', function(){
  editor.value = state.text;
  editor.style.display = 'block';
  reviewedEl.style.display = 'none';
  btnCheck.style.display = 'inline-flex';
  btnEditAgain.style.display = 'none';
  btnFinish.style.display = 'none';
  state.reviewing = false;
  setStatus("");
  clearBanner();
  editor.dispatchEvent(new Event('input'));
});

// A wrong-word confusion is keyed by its two members joined alphabetically ("their/there"),
// so the mistake reads the same key whichever direction the student actually got it wrong --
// one running tally per pair, not two that never talk to each other.
function confusionPairKey(a, b){
  var lo = [a.toLowerCase(), b.toLowerCase()].sort();
  return lo[0] + '/' + lo[1];
}
// Practice-target selection breaks a count tie by "most recent first" (spec section 2),
// but wordErrors/confusionErrors are specced as flat {key: count} / {key: {...}} maps with
// no separate timestamp field. Deleting a key before re-setting it moves it to the end of
// the object's own (spec-preserving) insertion order, so "most recently touched" falls out
// of plain Object.keys() iteration order for free, with no extra field on the wire.
function bumpToMostRecent(map, key, value){
  delete map[key];
  map[key] = value;
}
function recordConfusionCorrect(pairKey, correctWord){
  var entry = state.confusionErrors[pairKey] || { correctCounts: {}, total: 0 };
  entry.correctCounts[correctWord] = (entry.correctCounts[correctWord] || 0) + 1;
  entry.total++;
  bumpToMostRecent(state.confusionErrors, pairKey, entry);
}

btnFinish.addEventListener('click', function(){
  var byType = {spelling:0, grammar:0, punctuation:0, 'word choice':0};
  var fixed=0, revealed=0, skipped=0, helpRequests=0;
  var spellingPairs = [];
  state.flags.forEach(function(f){
    if (f.type === 'ask'){ helpRequests++; return; } // self-initiated lookups aren't counted as "errors"
    byType[f.type] = (byType[f.type]||0)+1;
    if (f.status==='fixed') fixed++;
    else if (f.status==='skipped') skipped++;
    else revealed++; // open or revealed both count as "not self-fixed" for honesty
    // Track (misspelling -> correct word) pairs for local spelling flags only -- these
    // are the garbled-word type where the "correct" word is unambiguous, unlike a
    // word-choice/grammar catch where "correct" depends on meaning, not letters.
    if (f.type === 'spelling' && f.source === 'local'){
      var corrected = (f.status === 'fixed' && f.userAnswer) ? f.userAnswer : f.suggestion;
      if (corrected && corrected.toLowerCase() !== f.original.toLowerCase()){
        spellingPairs.push({o: f.original, c: corrected});
        var wkey = f.original.toLowerCase();
        bumpToMostRecent(state.wordErrors, wkey, (state.wordErrors[wkey] || 0) + 1);
      }
    }
    // Wrong-word confusions (their/there, bet/but, ...) come from the AI "word choice"
    // layer. Only a clean single-word-for-single-word swap becomes a practice target --
    // an occasional multi-word AI suggestion isn't a "pair" a fill-in-the-blank quiz
    // can represent, so those are left out of confusionErrors entirely.
    if (f.type === 'word choice'){
      var wcCorrected = (f.status === 'fixed' && f.userAnswer) ? f.userAnswer : f.suggestion;
      if (wcCorrected && f.original && wcCorrected.toLowerCase() !== f.original.toLowerCase() &&
          !/\s/.test(wcCorrected.trim()) && !/\s/.test(f.original.trim())){
        recordConfusionCorrect(confusionPairKey(f.original, wcCorrected), wcCorrected.toLowerCase());
      }
    }
  });
  var words = state.text.trim().length ? state.text.trim().split(/\s+/).length : 0;
  var errorFlagCount = state.flags.length - helpRequests;
  var record = {
    date: new Date().toISOString(), words:words,
    spelling: byType.spelling, grammar: byType.grammar, punctuation: byType.punctuation, wordChoice: byType['word choice'],
    total: errorFlagCount, selfFixed: fixed, revealed: revealed, skipped: skipped, helpRequests: helpRequests,
    aiUsed: useAI.checked, spellingPairs: spellingPairs
  };
  state.sessions.push(record);
  if (state.sessions.length > 100) state.sessions = state.sessions.slice(-100);
  saveProgress();
  showBanner('info', "Saved! Check “My Progress” to see how you're doing over time.");
  setStatus("Nice work — "+fixed+" of "+errorFlagCount+" spot"+(errorFlagCount===1?"":"s")+" fixed on your own.");
});

/* ---------------- progress / db ---------------- */
var dbReady = null;
async function getDb(){
  if (dbReady === null){
    try { dbReady = await claude.use("db"); } catch(e){ dbReady = null; }
  }
  return dbReady;
}
async function loadProgress(){
  var db = await getDb();
  if (!db) return;
  try{
    var snap = await db.doc("progress/summary").get();
    var data = snap.exists && snap.data();
    if (data && Array.isArray(data.sessions)){
      state.sessions = data.sessions;
    }
    // These four are all additive fields from the practice-sentence generator --
    // absent entirely in any doc saved before this feature shipped, so each one
    // falls back to its already-set default from the state object above rather
    // than assuming it exists.
    if (data && data.wordErrors && typeof data.wordErrors === 'object') state.wordErrors = data.wordErrors;
    if (data && data.confusionErrors && typeof data.confusionErrors === 'object') state.confusionErrors = data.confusionErrors;
    if (data && data.practiceStreaks && typeof data.practiceStreaks === 'object') state.practiceStreaks = data.practiceStreaks;
    if (data && typeof data.practiceSessions === 'number') state.practiceSessions = data.practiceSessions;
    if (data && Array.isArray(data.practiceRounds)) state.practiceRounds = data.practiceRounds;
  }catch(e){}
  renderProgress();
}
async function saveProgress(){
  var db = await getDb();
  renderProgress();
  if (!db) return;
  try{
    await db.doc("progress/summary").set({
      sessions: state.sessions,
      wordErrors: state.wordErrors, confusionErrors: state.confusionErrors,
      practiceStreaks: state.practiceStreaks, practiceSessions: state.practiceSessions,
      practiceRounds: state.practiceRounds,
      updatedAt: new Date().toISOString() });
  }catch(e){}
}

/* Kept in a separate doc from progress/summary on purpose -- this is a much
   smaller, differently-shaped record (raw reports, not session stats), and
   keeping it separate means neither can accidentally clobber the other. */
async function loadFeedback(){
  var db = await getDb();
  if (!db) return;
  try{
    var snap = await db.doc("progress/feedback").get();
    if (snap.exists && snap.data() && Array.isArray(snap.data().feedback)){
      state.feedback = snap.data().feedback;
    }
  }catch(e){}
  renderProgress();
}
async function saveFeedback(){
  var db = await getDb();
  renderProgress();
  if (!db) return;
  try{
    await db.doc("progress/feedback").set({ feedback: state.feedback, updatedAt: new Date().toISOString() });
  }catch(e){}
}

function renderFeedbackSummary(){
  var card = document.getElementById('feedbackCard');
  var list = document.getElementById('feedbackSummary');
  var fb = state.feedback;
  if (!fb || !fb.length){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  // group by (layer + type) so a pattern like "AI word-choice flags reported
  // wrong: 7" surfaces on its own -- exactly the kind of aggregate that's a
  // real prompt-tuning signal if one bucket keeps growing.
  var groups = {};
  fb.forEach(function(r){
    var layerLabel = r.layer === 'ai' ? 'AI' : (r.layer === 'manual' ? 'Self-asked' : 'Local');
    var typeLabel = TYPE_LABEL[r.type] || r.type;
    var key = layerLabel + ' ' + typeLabel;
    groups[key] = (groups[key]||0) + 1;
  });
  var rows = Object.keys(groups).sort(function(a,b){ return groups[b]-groups[a]; });
  list.innerHTML = rows.map(function(k){
    return '<div class="feedback-row"><span>'+escapeHtml(k)+' flags reported wrong</span><span class="feedback-count">'+groups[k]+'</span></div>';
  }).join('') + '<div class="empty-state" style="padding:10px 0 0;font-size:12.5px;">'+fb.length+' total report'+(fb.length===1?'':'s')+' — thanks for helping make this better.</div>';
}

function renderProgress(){
  renderFeedbackSummary();
  updatePracticeGeneratorState(); // manages its own button/explainer visibility, independent of the early return below
  var grid = document.getElementById('statGrid');
  var chart = document.getElementById('chart');
  var bars = document.getElementById('bars');
  var combo = document.getElementById('comboPairs');
  var s = state.sessions;
  if (!s.length){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No sessions yet — finish a check on the Write tab to start tracking progress.</div>';
    chart.innerHTML = '';
    bars.innerHTML = '';
    combo.innerHTML = '';
    return;
  }
  var totalWords = s.reduce(function(a,r){return a+r.words;},0);
  var totalErrors = s.reduce(function(a,r){return a+r.total;},0);
  var totalFixed = s.reduce(function(a,r){return a+r.selfFixed;},0);
  var rate = totalErrors ? Math.round(100*totalFixed/totalErrors) : 100;
  grid.innerHTML =
    stat(s.length, s.length===1?'paragraph checked':'paragraphs checked') +
    stat(totalWords, 'words written') +
    stat(rate+'%', 'self-corrected') +
    stat(totalErrors, 'spots found total');

  function stat(num,lbl){ return '<div class="stat"><div class="num">'+num+'</div><div class="lbl">'+lbl+'</div></div>'; }

  // chart: self-correction rate per session (line), scaled 0-100 -- practice rounds share
  // this same chart (spec section 3.2 #6) rather than getting a chart of their own, merged
  // into chronological order by date and marked with their own diamond shape/color so they
  // read as a different KIND of point, never mistakable for a paragraph point.
  var w=720,h=180,pad=28;
  var paragraphPts = s.map(function(r){ return { rate: r.total ? Math.round(100*r.selfFixed/r.total) : 100, date: r.date, practice:false }; });
  var practicePts = (state.practiceRounds||[]).map(function(r){ return { rate: r.score||0, date: r.date, practice:true }; });
  var allPts = paragraphPts.concat(practicePts).sort(function(a,b){ return new Date(a.date).getTime() - new Date(b.date).getTime(); });
  var pts = allPts.map(function(p){ return p.rate; });
  var n = pts.length;
  var stepX = n>1 ? (w-2*pad)/(n-1) : 0;
  function xy(i){ return [pad+i*stepX, h-pad-(pts[i]/100)*(h-2*pad)]; }
  var path = pts.map(function(p,i){ var xy_=xy(i); return (i===0?'M':'L')+xy_[0].toFixed(1)+','+xy_[1].toFixed(1); }).join(' ');
  var first = xy(0), last = xy(n-1);
  var firstIsPractice = allPts.length && allPts[0].practice;
  var lastIsPractice = allPts.length && allPts[n-1].practice;
  var practiceMarkers = allPts.map(function(p,i){
    if (!p.practice) return '';
    var xy_ = xy(i), size = 8;
    return '<rect x="'+(xy_[0]-size/2).toFixed(1)+'" y="'+(xy_[1]-size/2).toFixed(1)+'" width="'+size+'" height="'+size+'" ' +
      'transform="rotate(45 '+xy_[0].toFixed(1)+' '+xy_[1].toFixed(1)+')" fill="var(--special)" stroke="var(--surface)" stroke-width="1.5">' +
      '<title>Practice round: '+p.rate+'%</title></rect>';
  }).join('');
  var svg = '<svg viewBox="0 0 '+w+' '+h+'" width="100%" style="max-width:'+w+'px;display:block;" role="img" aria-label="Self-correction rate over time, including practice rounds">'+
    '<line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="var(--border)" stroke-width="1"/>' +
    '<line x1="'+pad+'" y1="'+pad+'" x2="'+(w-pad)+'" y2="'+pad+'" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,4"/>' +
    '<text x="'+pad+'" y="'+(pad-8)+'" font-size="11" fill="var(--text-muted)">100%</text>' +
    '<text x="'+pad+'" y="'+(h-pad+16)+'" font-size="11" fill="var(--text-muted)">0%</text>' +
    '<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    (firstIsPractice ? '' : '<circle cx="'+first[0]+'" cy="'+first[1]+'" r="4" fill="var(--accent)"/>') +
    (lastIsPractice ? '' : '<circle cx="'+last[0]+'" cy="'+last[1]+'" r="4.5" fill="var(--accent-strong)"/>') +
    practiceMarkers +
    '<text x="'+last[0]+'" y="'+(last[1]-10)+'" font-size="12" font-weight="700" fill="var(--accent-strong)" text-anchor="end">'+pts[n-1]+'%</text>' +
    '</svg>';
  var chartLegend = practicePts.length ? '<div class="legend"><span><i style="background:var(--special);"></i>practice round</span></div>' : '';
  chart.innerHTML = svg + chartLegend + '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">each point = one checked paragraph (♦ = a practice round), oldest to newest</div>';

  var typeTotals = {spelling:0, grammar:0, punctuation:0, wordChoice:0};
  s.forEach(function(r){ typeTotals.spelling+=r.spelling||0; typeTotals.grammar+=r.grammar||0; typeTotals.punctuation+=r.punctuation||0; typeTotals.wordChoice+=r.wordChoice||0; });
  var maxT = Math.max(1, typeTotals.spelling, typeTotals.grammar, typeTotals.punctuation, typeTotals.wordChoice);
  var labels = [['Spelling','spelling','warn'],['Grammar','grammar','info'],['Punctuation','punctuation','special'],['Wrong word','wordChoice','confusable']];
  bars.innerHTML = labels.map(function(l){
    var val = typeTotals[l[1]];
    var pct = Math.round(100*val/maxT);
    return '<div class="bar-row"><span>'+l[0]+'</span><div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var(--'+l[2]+')"></div></div><span style="text-align:right;">'+val+'</span></div>';
  }).join('');

  // Aggregate every session's (misspelling -> correction) pairs into shared letter-level
  // patterns, so a kid can see e.g. that they keep mixing up "iyt"/"ate" across several
  // different words, not just a list of one-off typos.
  var patternMap = {};
  s.forEach(function(r){
    (r.spellingPairs||[]).forEach(function(p){
      var pat = extractSpellingPattern(p.o, p.c);
      if (!pat) return;
      var key = pat.from+'→'+pat.to;
      if (!patternMap[key]) patternMap[key] = {from:pat.from, to:pat.to, count:0, examples:[]};
      patternMap[key].count++;
      var ex = p.o.toLowerCase()+'→'+p.c.toLowerCase();
      if (patternMap[key].examples.indexOf(ex) === -1 && patternMap[key].examples.length < 3){
        patternMap[key].examples.push(ex);
      }
    });
  });
  var patterns = Object.keys(patternMap).map(function(k){ return patternMap[k]; })
    .filter(function(p){ return p.count >= 2; }) // "consistency" means it happened more than once
    .sort(function(a,b){ return b.count - a.count; })
    .slice(0, 6);
  if (!patterns.length){
    combo.innerHTML = '<div class="empty-state">No repeat patterns yet — once the same kind of letter mix-up (like swapping two letters or dropping one) shows up more than once, it’ll appear here.</div>';
  } else {
    combo.innerHTML = patterns.map(function(p){
      var fromDisp = p.from ? '“'+escapeHtml(p.from)+'”' : '<em>(missing letter)</em>';
      var toDisp = p.to ? '“'+escapeHtml(p.to)+'”' : '<em>(extra letter)</em>';
      return '<div class="combo-row">'+
        '<div><div class="combo-pattern">'+fromDisp+'<span class="arrow">→</span>'+toDisp+'</div>'+
        '<div class="combo-examples">e.g. '+escapeHtml(p.examples.join(', '))+'</div></div>'+
        '<div class="combo-count">'+p.count+'×</div></div>';
    }).join('');
  }
}

/* ---------------- Practice-sentence generator (My Progress tab) ----------------
   Targets the specific words/pairs a student most often gets wrong, generates short
   fill-in-the-blank quizzes for them, and checks answers entirely locally -- the only
   part of this feature that ever costs anything is the sentence-writing step itself,
   and even that degrades to a $0 template bank the moment it's unavailable. */
var PRACTICE_STREAK_RETIRE = 3;   // 3 correct rounds in a row "retires" a target -- it's learned
var PRACTICE_ROUND_SIZE = 5;
var PRACTICE_LAST_BATCH_KEY = "secondlook_practice_last_batch_v1"; // sessionStorage: dedupe vs the immediately-previous round

var btnGeneratePractice = document.getElementById('btnGeneratePractice');
var practiceExplainerEl = document.getElementById('practiceExplainer');
var practiceCaptionEl = document.getElementById('practiceCaption');
var practiceBannerEl = document.getElementById('practiceBanner');
var practiceCardsEl = document.getElementById('practiceCards');
var practiceSummaryEl = document.getElementById('practiceSummary');

var practiceRound = null;      // { targets, items:[{target,full,blanked,source}], cardStates:[{done,firstTry}] }
var practiceGenerating = false;

function loadLastPracticeBatch(){
  try{
    var raw = JSON.parse(sessionStorage.getItem(PRACTICE_LAST_BATCH_KEY));
    if (Array.isArray(raw)) return raw;
  }catch(e){}
  return [];
}
function saveLastPracticeBatch(sentences){
  try{ sessionStorage.setItem(PRACTICE_LAST_BATCH_KEY, JSON.stringify(sentences)); }catch(e){}
}

/* -------- target selection (spec section 2) -------- */
function targetKeyFor(t){ return t.type === 'spelling' ? ('spelling:'+t.word) : ('confusion:'+t.pairKey); }
function targetWordOf(t){ return t.type === 'spelling' ? t.word : t.correct; }

function selectPracticeTargets(){
  var candidates = [];
  // Object key order tracks recency within EACH map (bumpToMostRecent keeps the most
  // recently-touched key last), so within spelling or within confusion targets, a count
  // tie really does break "most recent first". There's no shared clock between the two
  // maps, so a tie split across types just falls back to spelling-before-confusion --
  // a minor, harmless simplification rather than adding a whole extra timestamp field
  // to a schema the spec pins down as plain {key: count} maps.
  Object.keys(state.wordErrors).forEach(function(w, i){
    candidates.push({ type:'spelling', word: w, count: state.wordErrors[w], order: i });
  });
  Object.keys(state.confusionErrors).forEach(function(pk, i){
    var entry = state.confusionErrors[pk];
    var members = pk.split('/');
    var correct = (entry.correctCounts[members[1]]||0) > (entry.correctCounts[members[0]]||0) ? members[1] : members[0];
    candidates.push({ type:'confusion', pairKey: pk, pair: members, correct: correct, count: entry.total, order: i });
  });
  candidates.forEach(function(c){ c.key = targetKeyFor(c); });
  candidates = candidates.filter(function(c){ return (state.practiceStreaks[c.key]||0) < PRACTICE_STREAK_RETIRE; });
  candidates.sort(function(a,b){ return (b.count - a.count) || (b.order - a.order); });
  return candidates.slice(0, PRACTICE_ROUND_SIZE);
}

function updatePracticeGeneratorState(){
  var hasTargets = selectPracticeTargets().length > 0;
  btnGeneratePractice.disabled = !hasTargets || practiceGenerating;
  practiceExplainerEl.style.display = hasTargets ? 'none' : 'block';
}

/* -------- $0 local template fallback (spec section 5) -------- */
var PRACTICE_SPELLING_FRAMES = [
  "I had to write the word {word} twice to get it right.",
  "The teacher asked the class to spell {word}.",
  "My notebook has the word {word} on the first page.",
  "She practiced the word {word} until it felt easy.",
  "Our vocabulary list this week includes the word {word}.",
  "He circled the word {word} to remember it for later.",
  "The word {word} showed up twice in today's reading.",
  "I want to use {word} correctly in my next paragraph.",
  "Can you use the word {word} in a sentence for me?",
  "The word {word} tripped me up on my last quiz.",
  "We added {word} to our spelling list for practice.",
  "It took a few tries before {word} looked right on the page.",
  "The word {word} is worth remembering for next time.",
  "I wrote {word} on a flashcard to study later.",
  "Everyone in class had trouble with the word {word} at first."
];
// Each frame here is written for one SPECIFIC known pair, which is what lets it read as
// a natural sentence instead of a generic fill-in-the-blank. A pair the student actually
// mixes up that isn't one of these (very possible -- confusionErrors can hold any pair
// the AI ever flagged) falls through to genericConfusionFrame() below instead, so the
// feature still works for it, just without a hand-written sentence.
var PRACTICE_CONFUSION_FRAMES = [
  { pairKey:'their/there', correct:'their', frame:"____ book is on the table, not mine." },
  { pairKey:'their/there', correct:'their', frame:"They packed up ____ things before lunch." },
  { pairKey:'their/there', correct:'there', frame:"Put the keys over ____ by the door." },
  { pairKey:'their/there', correct:'there', frame:"We left the bikes right ____ yesterday." },
  { pairKey:'bet/but', correct:'but', frame:"I wanted to go, ____ it started raining." },
  { pairKey:'bet/but', correct:'but', frame:"She tried her best, ____ the test was hard." },
  { pairKey:'to/too', correct:'too', frame:"I would like to come ____." },
  { pairKey:'to/too', correct:'to', frame:"We walked ____ the store after school." }
];
function genericConfusionFrame(other){
  return "The right word here is ____, not " + other + ".";
}
function generateTemplateItems(targets){
  var usedSpellingFrames = [], usedConfusionFrameIdx = [];
  return targets.map(function(t){
    if (t.type === 'spelling'){
      var pool = PRACTICE_SPELLING_FRAMES.filter(function(f){ return usedSpellingFrames.indexOf(f) === -1; });
      if (!pool.length) pool = PRACTICE_SPELLING_FRAMES;
      var frame = pool[Math.floor(Math.random()*pool.length)];
      usedSpellingFrames.push(frame);
      return { target:t, full: frame.replace('{word}', t.word), blanked: frame.replace('{word}', '____'), source:'template' };
    }
    var other = t.pair[0].toLowerCase() === t.correct.toLowerCase() ? t.pair[1] : t.pair[0];
    var matchIdx = PRACTICE_CONFUSION_FRAMES.map(function(f,i){ return i; }).filter(function(i){
      var f = PRACTICE_CONFUSION_FRAMES[i];
      return f.pairKey === t.pairKey && f.correct.toLowerCase() === t.correct.toLowerCase() && usedConfusionFrameIdx.indexOf(i) === -1;
    });
    var blanked;
    if (matchIdx.length){
      var chosen = matchIdx[Math.floor(Math.random()*matchIdx.length)];
      usedConfusionFrameIdx.push(chosen);
      blanked = PRACTICE_CONFUSION_FRAMES[chosen].frame;
    } else {
      blanked = genericConfusionFrame(other);
    }
    return { target:t, full: blanked.replace('____', t.correct), blanked: blanked, source:'template' };
  });
}

/* -------- AI generation validation (shared by both build targets) -------- */
function sentenceContainsWord(sentence, word){
  var re = new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b', 'i');
  return re.test(sentence);
}
function blankWordInSentence(sentence, word){
  var re = new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b', 'i');
  return sentence.replace(re, '____');
}
function isValidGeneratedSentence(sentence, target){
  if (typeof sentence !== 'string') return false;
  var trimmed = sentence.trim();
  if (!trimmed) return false;
  var wc = trimmed.split(/\s+/).length;
  if (wc < 5 || wc > 30) return false;
  return sentenceContainsWord(trimmed, targetWordOf(target));
}
function buildPracticePrompt(targets){
  var targetList = targets.map(function(t, i){
    return t.type === 'spelling'
      ? { index:i, type:'spelling', word:t.word }
      : { index:i, type:'confusion', pair:t.pair, correct:t.correct };
  });
  return "You write short practice sentences for a dyslexic high-school student. " +
    "For spelling words, use the word spelled correctly in a natural sentence. " +
    "For confusing word pairs, write a sentence where the context makes it unambiguous which word is correct. " +
    "Reading level grades 6-8. Neutral, encouraging topics. No proper nouns that are hard to spell.\n\n" +
    "Targets:\n" + JSON.stringify(targetList) + "\n\n" +
    "Write one sentence per target, 8-20 words each, using the target's correct word/pair member naturally in context. " +
    "Reply with ONLY JSON: {\"sentences\":[{\"target\":<index>,\"sentence\":\"...\"}]}";
}
// Validates and builds AI-sourced items where possible, falling back to a template item
// for any single target the reply didn't cover -- a malformed or missing item for ONE
// target shouldn't throw away four other perfectly good AI sentences (spec 4 + TC-11).
function buildItemsFromAiReply(result, targets, priorBatch){
  if (!result || !Array.isArray(result.sentences)) return null;
  var byIndex = {};
  result.sentences.forEach(function(item){
    if (item && typeof item.target === 'number') byIndex[item.target] = item.sentence;
  });
  var seen = priorBatch.slice();
  var anyAi = false;
  var items = targets.map(function(t, i){
    var raw = byIndex[i];
    if (isValidGeneratedSentence(raw, t)){
      var full = raw.trim();
      if (seen.indexOf(full) === -1){
        seen.push(full);
        anyAi = true;
        return { target:t, full: full, blanked: blankWordInSentence(full, targetWordOf(t)), source:'ai' };
      }
    }
    return null; // filled in from templates below
  });
  var fallbackNeeded = items.map(function(it,i){ return it ? null : targets[i]; }).filter(Boolean);
  if (fallbackNeeded.length){
    var fallbackItems = generateTemplateItems(fallbackNeeded);
    var fi = 0;
    items = items.map(function(it){ return it || fallbackItems[fi++]; });
  }
  return { items: items, anyAi: anyAi, anyTemplate: fallbackNeeded.length > 0 };
}

/* -------- generation entry point (build.py: claude.use("sample"), $0, no budget) --------
   build_public.py mechanically swaps this function's body for one that calls the
   Cloudflare Worker with gpt-5-nano and the shared $0.20 session budget instead --
   mirroring exactly how runAIPass() already differs between the two build targets, since
   this build has no Worker/dollar-cost concept for anything else either. */
async function runPracticeGeneration(targets){
  var priorBatch = loadLastPracticeBatch();
  var sample = null;
  try { sample = await claude.use("sample"); } catch(e){ sample = null; }
  if (!sample){
    return { items: generateTemplateItems(targets), source: 'template', note: null };
  }
  try{
    var prompt = buildPracticePrompt(targets);
    var result = await sample.json(prompt, { modelTier: "quick" });
    var built = buildItemsFromAiReply(result, targets, priorBatch);
    if (!built) throw new Error("bad AI reply shape");
    return { items: built.items, source: built.anyTemplate ? (built.anyAi ? 'mixed' : 'template') : 'ai', note: null };
  }catch(e){
    return { items: generateTemplateItems(targets), source: 'template', note: "Couldn't reach the sentence writer — using built-in templates." };
  }
}

/* -------- round lifecycle: generate, render, check, complete -------- */
function practiceCaptionFor(source){
  if (source === 'ai') return "Sentences written with AI.";
  if (source === 'mixed') return "Some sentences written with AI; others from built-in templates.";
  return "AI unavailable — sentences made from built-in templates.";
}

async function generatePracticeRound(){
  if (practiceGenerating) return; // guards against a double-click firing two requests (TC-12)
  var targets = selectPracticeTargets();
  if (!targets.length) return;
  practiceGenerating = true;
  btnGeneratePractice.disabled = true;
  var originalLabel = btnGeneratePractice.textContent;
  btnGeneratePractice.textContent = "Writing sentences...";
  practiceBannerEl.innerHTML = '';
  practiceSummaryEl.style.display = 'none';
  practiceSummaryEl.innerHTML = '';
  practiceCardsEl.innerHTML = '';
  try{
    var result = await runPracticeGeneration(targets);
    practiceRound = {
      targets: targets,
      items: result.items,
      cardStates: result.items.map(function(){ return { done:false, firstTry:null }; })
    };
    saveLastPracticeBatch(result.items.map(function(it){ return it.full; }));
    renderPracticeCards();
    practiceCaptionEl.textContent = practiceCaptionFor(result.source);
    if (result.note) practiceBannerEl.innerHTML = '<div class="banner info">'+escapeHtml(result.note)+'</div>';
  } finally {
    practiceGenerating = false;
    btnGeneratePractice.textContent = originalLabel;
    updatePracticeGeneratorState();
  }
}
btnGeneratePractice.addEventListener('click', generatePracticeRound);

function renderPracticeCards(){
  practiceCardsEl.innerHTML = practiceRound.items.map(function(item, i){
    var tag = item.target.type === 'confusion'
      ? '<span class="tag">Tricky pair: '+escapeHtml(item.target.pair[0])+' / '+escapeHtml(item.target.pair[1])+'</span>'
      : '';
    var sentenceHtml = escapeHtml(item.blanked).replace('____', '<span class="blank">____</span>');
    return '<div class="practice-card" data-idx="'+i+'">' + tag +
      '<div class="sentence">'+sentenceHtml+'</div>' +
      '<div class="practice-row">' +
      '<input type="text" class="practice-answer" autocomplete="off" spellcheck="false" aria-label="Your answer">' +
      '<button class="btn primary practice-check" type="button">Check</button>' +
      '<button class="btn ghost practice-hear" type="button">\uD83D\uDD0A Hear it</button>' +
      '</div><div class="feedback"></div></div>';
  }).join('');
}

function handlePracticeHear(cardEl){
  var idx = parseInt(cardEl.getAttribute('data-idx'), 10);
  var item = practiceRound.items[idx];
  if (item) speak(item.full); // reuses the Write tab's existing speak() helper unchanged, per spec 3.2 #4
}

function maybeCompleteRound(){
  if (!practiceRound || !practiceRound.cardStates.every(function(c){ return c.done; })) return;
  var total = practiceRound.cardStates.length;
  var firstTryCorrect = practiceRound.cardStates.filter(function(c){ return c.firstTry === true; }).length;
  var scorePct = total ? Math.round(100*firstTryCorrect/total) : 100;
  state.practiceSessions = (state.practiceSessions||0) + 1;
  state.practiceRounds = state.practiceRounds || [];
  state.practiceRounds.push({ date: new Date().toISOString(), score: scorePct });
  if (state.practiceRounds.length > 100) state.practiceRounds = state.practiceRounds.slice(-100);
  // A target only advances its "learned" streak on a ROUND where it was gotten right
  // first try -- needing a retry means it isn't quite learned yet, so the streak (and
  // the eventual 3-in-a-row retirement) resets rather than crediting a struggle as mastery.
  practiceRound.targets.forEach(function(t, i){
    if (practiceRound.cardStates[i].firstTry === true) state.practiceStreaks[t.key] = (state.practiceStreaks[t.key]||0) + 1;
    else state.practiceStreaks[t.key] = 0;
  });
  saveProgress();
  practiceSummaryEl.style.display = 'block';
  practiceSummaryEl.innerHTML = '<div>'+firstTryCorrect+' for '+total+' — nice.</div>' +
    '<button class="btn ghost" id="btnPracticeAgain" type="button" style="margin-top:10px;">Practice again</button>';
  document.getElementById('btnPracticeAgain').addEventListener('click', function(){
    practiceSummaryEl.style.display = 'none';
    generatePracticeRound();
  });
}

function handlePracticeCheck(cardEl){
  var idx = parseInt(cardEl.getAttribute('data-idx'), 10);
  var item = practiceRound.items[idx];
  var cardState = practiceRound.cardStates[idx];
  if (!item || cardState.done) return;
  var input = cardEl.querySelector('.practice-answer');
  var feedbackEl = cardEl.querySelector('.feedback');
  var answer = input.value.trim();
  if (!answer) return;
  var correct;
  if (item.target.type === 'confusion'){
    // Exact match ONLY -- the tolerant phonetic/edit-distance checker used for spelling
    // cards would happily accept "there" when the answer is "their" (they're phonetically
    // identical), which is exactly the mistake this card exists to catch (spec 3.2, TC-7).
    correct = answer.toLowerCase() === item.target.correct.toLowerCase();
  } else {
    // Same tolerant "check my fix" acceptance the Write tab's popover already uses --
    // no new logic, no new AI call, $0 either way.
    correct = isPlausibleSpellingFix(item.target.word, answer) || answer.toLowerCase() === item.target.word.toLowerCase();
  }
  if (cardState.firstTry === null) cardState.firstTry = correct;
  if (correct){
    cardState.done = true;
    cardEl.classList.add('done');
    input.disabled = true;
    cardEl.querySelector('.practice-check').disabled = true;
    feedbackEl.textContent = "That's it — " + targetWordOf(item.target) + ".";
    feedbackEl.className = 'feedback good';
    maybeCompleteRound();
  } else {
    feedbackEl.textContent = "Not quite — try again.";
    feedbackEl.className = 'feedback bad';
  }
}

practiceCardsEl.addEventListener('click', function(e){
  var checkBtn = e.target.closest && e.target.closest('.practice-check');
  var hearBtn = e.target.closest && e.target.closest('.practice-hear');
  if (checkBtn) handlePracticeCheck(checkBtn.closest('.practice-card'));
  else if (hearBtn) handlePracticeHear(hearBtn.closest('.practice-card'));
});
practiceCardsEl.addEventListener('keydown', function(e){
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('practice-answer')){
    e.preventDefault();
    handlePracticeCheck(e.target.closest('.practice-card'));
  }
});

/* ---------------- Write tab: upload a file (.txt / PDF / photo) ----------------
   Lets a student load a paragraph from a file instead of typing or pasting it, straight
   into the same editor -- overwriting whatever was already there, deliberately silently
   (no confirmation step), same as every other "load text into the editor" action in this
   app. There's no length limit here (the old 2000-word cap was Read-tab-only and left with
   that tab), so a long document is fine -- see AI_CHECK_MAX_WORDS above for how the deeper
   AI check handles a very long one. */
function readFileAsText(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result || '')); };
    reader.onerror = function(){ reject(new Error("Couldn't read that file — try a different one.")); };
    reader.readAsText(file);
  });
}
function readFileAsDataURL(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result || '')); };
    reader.onerror = function(){ reject(new Error("Couldn't read that file — try a different one.")); };
    reader.readAsDataURL(file);
  });
}

/* PDF text extraction via pdf.js, loaded from a CDN on first use -- the same tradeoff
   already made for the OpenDyslexic font: works well on the real public site, but this
   Artifact preview's sandbox may block loading a script from a CDN, in which case this
   throws and the student sees a plain "PDF reading isn't available here" message instead
   of the upload silently doing nothing. */
var pdfjsLoadPromise = null;
function ensurePdfJsLoaded(){
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = new Promise(function(resolve, reject){
    if (window.pdfjsLib){ resolve(window.pdfjsLib); return; }
    var script = document.createElement('script');
    // Pinned to 3.11.174 deliberately -- it's the newest cdnjs release that still ships the
    // classic pdf.min.js/pdf.worker.min.js pair a plain <script> tag can load. Newer pdf.js
    // releases dropped that build and only ship ES modules (.mjs), which this simple
    // create-a-<script>-tag loader can't consume directly.
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = function(){
      try{
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      }catch(e){ reject(e); }
    };
    script.onerror = function(){ reject(new Error("PDF reading isn't available here — try a .txt file instead, or paste the text directly.")); };
    document.head.appendChild(script);
  });
  return pdfjsLoadPromise;
}
async function extractPdfText(file){
  var pdfjsLib = await ensurePdfJsLoaded();
  var buf = await file.arrayBuffer();
  var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  var pages = [];
  for (var i = 1; i <= pdf.numPages; i++){
    var page = await pdf.getPage(i);
    var content = await page.getTextContent();
    pages.push(content.items.map(function(it){ return it.str; }).join(' ').trim());
  }
  var text = pages.join('\n\n').trim();
  if (!text) throw new Error("Couldn't find any text in that PDF — it might be a scanned image with no text layer.");
  return text;
}

/* Photo (JPG/PNG) text extraction via AI vision -- reuses the same claude.use("sample")
   call the deeper writing check uses, just asking it to transcribe a photo instead of judge
   a paragraph. Honest caveat: every other use of sample.json() in this app sends it a plain
   text prompt -- this is the first place that also hands it an image, and whether this
   Artifact runtime's sample call actually accepts one (and in this shape) hasn't been
   confirmed. If it doesn't, this throws and the student sees a clear "photo reading isn't
   available here" message rather than a silent failure. */
async function extractImageText(file){
  var sample = null;
  try { sample = await claude.use("sample"); } catch(e){ sample = null; }
  if (!sample) throw new Error("Photo reading isn't available here — try a .txt file or PDF instead.");
  var dataUrl = await readFileAsDataURL(file);
  var prompt = "Read every word of text visible in this photo of a page and transcribe it exactly as written, correcting nothing. " +
    "Reply with ONLY a JSON object like {\"text\":\"the transcribed text here\"}. If a word is impossible to make out, use [?] in its place.";
  var result;
  try{
    result = await sample.json(prompt, { modelTier: "complex", image: dataUrl });
  }catch(e){
    throw new Error("Photo reading isn't available here — try a .txt file or PDF instead.");
  }
  var text = result && typeof result.text === 'string' ? result.text : null;
  if (!text) throw new Error("Couldn't read any text from that photo — try a clearer picture.");
  return text;
}

function setUploadedText(text){
  editor.value = text;
  updateEditorWordcount();
  editor.focus();
}

async function handleFileUpload(file){
  var name = (file.name || '').toLowerCase();
  var type = file.type || '';
  showUploadBanner('info', 'Reading “' + file.name + '”…');
  try{
    var text;
    if (type === 'text/plain' || /\.txt$/.test(name)){
      text = await readFileAsText(file);
    } else if (type === 'application/pdf' || /\.pdf$/.test(name)){
      text = await extractPdfText(file);
    } else if (/^image\//.test(type) || /\.(jpe?g|png)$/.test(name)){
      text = await extractImageText(file);
    } else {
      showUploadBanner('warn', "That file type isn't supported yet — try a .txt file, a PDF, or a photo (.jpg/.png).");
      return;
    }
    setUploadedText(text);
    showUploadBanner('info', 'Loaded “' + file.name + '” (' + countWords(text) + (countWords(text)===1?' word':' words') + ').');
  }catch(e){
    showUploadBanner('warn', (e && e.message) ? e.message : ('Couldn’t read "' + file.name + '" — try a different file.'));
  }
}

var fileUploadEl = document.getElementById('fileUpload');
fileUploadEl.addEventListener('change', function(){
  var file = fileUploadEl.files && fileUploadEl.files[0];
  fileUploadEl.value = ''; // reset so choosing the same file again still fires 'change'
  if (!file) return;
  handleFileUpload(file);
});

loadProgress();
loadFeedback();
})();
</script>
"""

html = html.replace("__WORDLIST__", wordlist).replace("__CONFUSABLE__", confusable_json)
open("second_look.html","w").write(html)
print("bytes:", len(html))
