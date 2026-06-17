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
  - `Evaluator` — static-only. Tokenizes, preprocesses (implicit multiplication), runs shunting-yard → RPN, evaluates. Also has exact-form helpers used for display: `toFraction`/`formatFractionHTML`, `toPiMultiple`/`formatPiHTML` (π multiples), `toSqrtForm`/`formatSqrtHTML` (surds).
  - `Calculator` — state machine. Holds token list, `cursorPos` (caret index between tokens), angle mode (DEG/RAD/GRAD), history, `fracDisplay`/`fracMixed` flags, `rawValue` (last numeric result). Single delegated click listener on `.calculator-keys`; keyboard support for digits and common operators.
  - `DisplayManager` — reads `Calculator` state and updates the DOM. `_tokensToStringHTML` renders the expression with a blinking caret, stacked fractions, superscript exponents, and radicals; `_renderResult` shows results in exact form (fraction / π multiple / surd) unless `fracDisplay` is off.
  - `SECOND_MAP` — maps primary action → secondary action when 2nd is active.
  - `colorChanger(color)` — switches between "blue" and "pink" colorways via `data-colorway` CSS attribute.

- **`style.css`** — Layout and theming. Pink colorway uses `body[data-colorway="pink"]` selectors (no inline JS styles). Dual-label visibility controlled by `body.second-active`.

## Key Behaviors

- **Expression entry**: token-based (not string concatenation). Each button appends a typed token; `_tokensToString()` renders the expression for display.
- **Operators**: `×`→`*`, `÷`→`/` internally; display converts back.
- **π**: uses `Math.PI` exactly.
- **Exact-form display**: on by default (`fracDisplay = true`). After calculation the result is shown in exact form when possible — a fraction with denominator ≤ 999 (`n/d`), a π multiple (`5π`), or a simplified surd (`5√2`). Improper fractions are the default; `fracMixed` switches to mixed numbers (`w n/d`), toggled by `2nd + n/d` (`U n/d`). The `< >` key (`toggle-display`) flips between this exact form and the decimal approximation.
- **Fraction entry (`n/d`)**: never reuses `Ans`. Pressing `n/d` enters fraction mode — with a numerator already typed to its left it becomes the bar (the rest goes in the denominator box); otherwise it inserts an empty `▯/▯` template with the caret in the numerator. Operators typed inside a box stay in that box (so `5 n/d 2 + 6` = `5/(2+6)`), and the same applies to the `^` exponent box.
- **Cursor**: `left`/`right` (and the `‹`/`›` forward/backward keys before a result) move the caret one token at a time; `right` exits a fraction box. Inside a fraction template, `↓` moves from the numerator to the denominator and `↑` moves back (matching the real MathPrint key flow `n/d` → numerator → `↓` → denominator → `→` exits); outside a template, `↑`/`↓` recall history. After a result, the forward/backward keys toggle the exact/decimal display.
- **Angle mode**: cycled by `mode` button (DEG → RAD → GRAD). `2nd` functions: sin⁻¹, cos⁻¹, tan⁻¹, eˣ, 10ˣ, ∛.
- **History**: ↑/↓ arrows recall past expressions.
- **Second screen**: floating panel showing a larger view of the display.

## Not Implemented

- `data` — statistics mode.
- `table` — table mode.
- `INS` (`2nd + del`) — insert mode within an expression.
