# Second Look — Read + Count

**An early-learning accessibility platform for children who process words or numbers differently.** Second Look now pairs the original dyslexia-friendly writing checker with an adaptive number-sense experience.

- **Words** catches misspellings and harder real-word mix-ups, then gives hints so the student fixes the writing themselves.
- **Numbers** offers a short Number Check, a four-skill Number Sense Map, explainable adaptive practice, three playable interventions, and a parent/teacher dashboard.

The Numbers mode records in-app accuracy, response time, and number-line error patterns across dot sense, symbolic magnitude, quantity–numeral mapping, and number-line estimation. It never reports a dyscalculia probability or presents itself as a diagnostic instrument.

**Live site:** [diya-gupta000.github.io/dyslexia_assistance](https://diya-gupta000.github.io/dyslexia_assistance/)

Instead of silently fixing an answer, Second Look helps the learner notice a pattern and try again — the goal is building the learner's own skill, not replacing it.

## Numbers experience

- A home choice between Words and Numbers, with the original writing experience intact.
- A working 12-trial Number Check spanning four foundational numerical processes.
- A Number Sense Map with child-safe observations: Strong, Developing, and Needs practice.
- An inspectable adaptation rule that recommends the activity connected to the learner's lowest relative skill.
- Three complete practice loops: Number Trail, Number Line Adventure, and Quantity Battle.
- An adult dashboard with skill metrics, pattern summaries, session history, and change over time.
- On-device persistence, a sample-data tour, responsive design, keyboard focus states, and reduced-motion support.
- A research explainer with primary-source links and explicit non-diagnostic boundaries.

---

## How it works

Every check runs in two layers:

1. **Instant, local, and free.** A dictionary and phonetic/edit-distance matcher run entirely in the browser, catching words that aren't real words at all (like "spiyn" or "froow") and offering a best-guess correction. No network call, no cost, runs on every check.
2. **Optional, AI-powered.** Checking "Use the deeper AI check" sends the paragraph to a small Cloudflare Worker, which calls OpenAI (`gpt-5-mini`) to catch real-word-but-wrong-word errors that a dictionary structurally cannot catch. A cheaper single-word check (`gpt-5-nano`) also powers "Say it" — speaking a word out loud instead of typing it.

Flagged words open a popup with two hint levels ("Hear it" reads it aloud, "Show me" gives a stronger hint) plus a box to type a fix. Progress across sessions is tracked locally so a student can see improvement over time.

```
┌─────────────┐      always      ┌──────────────────────┐
│   Browser   │ ───────────────▶ │  Local spelling check │  (free, instant)
│  (index.html)│                 └──────────────────────┘
│             │   only if "deeper AI check" is on
│             │ ───────────────▶ ┌──────────────────────┐
│             │                  │  Cloudflare Worker     │
│             │ ◀─────────────── │      (worker.js)       │
└─────────────┘                  └──────────┬───────────┘
                                             │
                                             ▼
                                     OpenAI API (gpt-5-mini / gpt-5-nano)
```

## Repository contents

| File | What it is |
|---|---|
| `index.html` | The generated public site shell and the complete Words experience. |
| `numbers.css` | Shared platform launcher and responsive Numbers-mode visual system. |
| `numbers-domain.js` | Pure scoring, skill-map, and recommendation logic. |
| `numbers.js` | Number Check, practice games, dashboard, research view, and local persistence. |
| `worker.js` | The Cloudflare Worker backend. Holds the OpenAI API key server-side and proxies the AI check; the browser never sees the key. |
| `wrangler.toml` | Cloudflare Worker config (used by the `wrangler` CLI to deploy `worker.js`). |
| `README-deploy.md` | Full step-by-step deployment guide — get an OpenAI key, deploy the Worker, point the site at it, and host the static file. Start here if you want to run your own copy. |

## Running it yourself

The Numbers mode and local spelling check work with no backend or API key. Run `python3 -m http.server 8000` and open `http://localhost:8000`, or use `npm run check` to rebuild the generated files and run the scoring tests. The deeper Words AI check needs the existing Cloudflare Worker and OpenAI API key; see **[README-deploy.md](README-deploy.md)**.

## Cost & abuse guardrails

Because the AI check is a paid, unauthenticated public endpoint, several layers keep a stray click (or a bad actor) from running up a real bill:

- A real, dollar-denominated **per-browser-session cap** ($0.20 by default), computed from OpenAI's own billed token counts — once hit, the AI layer turns itself off gracefully and the free local check keeps working.
- A **server-side model allow-list** in the Worker, so a direct request can't ask for a pricier model than the app intends to use.
- **Character and token ceilings** on every single request/response, independent of the session cap.

None of this is a hard security boundary — the Worker's CORS is restricted to the site's own origin (so other sites can't quietly ride on the API key through a browser), but there's still no server-side rate limit, and CORS doesn't stop a direct curl/script call at all. See **Caveats** below and `README-deploy.md`'s "Cost safeguards" section for what's still open and how to tighten it further before sharing at real scale.

## Caveats

- The AI layer is a judgment call, not a guaranteed-correct answer — it can be confidently wrong, and there's currently no way for a student to flag a bad suggestion.
- This is a practice tool, not a diagnostic or clinical instrument.
- Progress is stored in that one browser's `localStorage` only — it doesn't sync across devices and is lost if site data is cleared.
- The AI check depends on the site owner's own OpenAI budget and shuts off per-session once the cap is hit.

The full engineering write-up — every bug hit, how each was actually diagnosed against the live system (not just asserted from reading code), the design tradeoffs behind the cost guardrails, and the complete caveats list — is in the project's lifecycle notes (kept alongside this project's working docs, not in this repo).

## Tech stack

Vanilla HTML/CSS/JS on the frontend, a small Python generation step for the Words bundle, a Cloudflare Worker for the optional writing AI proxy, and GitHub Pages hosting. The Numbers scoring and adaptation logic are deterministic and run entirely in the browser.

## Credits

Built by Diya. Developed with [Claude](https://claude.com) as an AI coding assistant — the project's direction, testing, and final design decisions are the owner's.
