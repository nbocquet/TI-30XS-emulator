# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based emulator of the Texas Instruments TI-30XS MultiView calculator. Built as a static site (no build step, no package manager) using vanilla HTML, CSS, and JavaScript. Math expression evaluation is delegated to [math.js](https://mathjs.org/), loaded from CDN.

## Running the App

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8080
```

There are no tests, no linting setup, and no build process.

## Architecture

The entire logic lives in three files:

- **`index.html`** — Calculator layout. Buttons use `data-action` attributes (e.g. `data-action="calculate"`, `data-action="sin"`) to communicate intent to JS. Buttons without a `data-action` are number keys; their `textContent` is appended directly to the display. Some buttons are marked `class="NaN"` — this class is used by the color-switcher for targeting, not to indicate non-functional state.

- **`javascript.js`** — All behavior via a single delegated `click` listener on `.calculator-keys`. The display (`.calculator-display`) holds a raw expression string that gets passed to `math.evaluate()` on "enter". The `colorChanger(color)` function is called inline from HTML; it switches between "blue" (default, resets inline styles) and "pink" colorways by applying inline styles to `.NaN` buttons and a few named elements.

- **`style.css`** — Pure CSS layout and theming. The default colorway is defined here; the pink colorway overrides via inline styles set by JS.

## Key Behaviors and Limitations

- Expression building: JS concatenates strings onto `.calculator-display` for each button press. `math.js` parses the final string on "enter".
- `multiplication` and `division` actions translate `×` → `*` and `÷` → `/` before appending, since math.js requires standard operators.
- `π` is hardcoded as `3.14` (not `math.PI`).
- Many buttons (navigation arrows, `2nd`, `mode`, `table`, `data`, `probability`, `ln`, `n/d`, `sqrt` partially, etc.) have no JS implementation — they are present for design fidelity only.
- The colorway event listeners for hover/press states are re-attached inside the loop every time `colorChanger` is called, accumulating duplicate listeners over multiple switches.
- Display is capped at 20 characters; no error handling around `math.evaluate()` failures.
