# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based emulator of the Texas Instruments TI-30XS MultiView calculator. Built as a static site (no build step, no package manager) using vanilla HTML, CSS, and JavaScript. Math evaluation uses a custom shunting-yard / RPN evaluator (no external dependency).

## Running the App

Open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8080
```

There are no tests, no linting setup, and no build process.

## Architecture

The entire logic lives in three files:

- **`index.html`** — Calculator layout. Buttons use `data-action` attributes to communicate intent to JS. Buttons without a `data-action` are number keys. Some buttons are marked `class="NaN"` — used by the color-switcher, not to indicate non-functional state. Dual-function buttons have `<span class="primary-label">` and `<span class="second-label">` children; CSS hides the inactive one.

- **`javascript.js`** — Three main classes:
  - `CalcError` — typed error thrown by the evaluator.
  - `Evaluator` — static-only. Tokenizes, preprocesses (implicit multiplication), runs shunting-yard → RPN, evaluates. Also has `toFraction(x)` / `formatFraction(f)` for fraction display.
  - `Calculator` — state machine. Holds token list, angle mode (DEG/RAD/GRAD), history, `fracDisplay` flag, `rawValue` (last numeric result). Single delegated click listener on `.calculator-keys`; keyboard support for digits and common operators.
  - `DisplayManager` — reads `Calculator` state and updates the DOM.
  - `SECOND_MAP` — maps primary action → secondary action when 2nd is active.
  - `colorChanger(color)` — switches between "blue" and "pink" colorways via `data-colorway` CSS attribute.

- **`style.css`** — Layout and theming. Pink colorway uses `body[data-colorway="pink"]` selectors (no inline JS styles). Dual-label visibility controlled by `body.second-active`.

## Key Behaviors

- **Expression entry**: token-based (not string concatenation). Each button appends a typed token; `_tokensToString()` renders the expression for display.
- **Operators**: `×`→`*`, `÷`→`/` internally; display converts back.
- **π**: uses `Math.PI` exactly.
- **Fraction display**: on by default (`fracDisplay = true`). After calculation, if the result is a rational number with denominator ≤ 999, it is shown as `n/d` or `w n/d` (mixed number). Toggle with `2nd + n/d` (F↔D).
- **Angle mode**: cycled by `mode` button (DEG → RAD → GRAD). `2nd` functions: sin⁻¹, cos⁻¹, tan⁻¹, eˣ, 10ˣ, ∛.
- **History**: ↑/↓ arrows recall past expressions.
- **Second screen**: floating panel showing a larger view of the display.

## Not Implemented

- `left`/`right`/`forward`/`backward` — cursor navigation within expression (would need caret position tracking).
- `data` — statistics mode.
- `table` — table mode.
- True stacked fraction display (shows `a b/c` text instead).
