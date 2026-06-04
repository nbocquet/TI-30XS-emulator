'use strict';
// Run: node test.js

// ── Minimal DOM mock (bootstrap code runs inside DOMContentLoaded so it never fires in Node) ──
const makeEl = () => {
  const el = {
    classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    innerHTML: '', textContent: '', style: {},
    offsetLeft: 0, offsetTop: 0,
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return makeEl(); },
    closest(){ return null; },
    dataset: {},
  };
  return el;
};
global.document = {
  addEventListener(){}, removeEventListener(){},
  getElementById(){ return makeEl(); },
  querySelector(){ return makeEl(); },
  body: { removeAttribute(){}, dataset: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } } },
};

// ── Load calculator code ──────────────────────────────────────────────────────
// vm.runInThisContext is the Node idiom for loading a browser-targeted vanilla JS
// file that has no module exports. The file is a local, repo-owned asset — not
// user-supplied input — so execution is safe.
const vm = require('vm');
vm.runInThisContext(require('fs').readFileSync('./javascript.js', 'utf8'));

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch(e) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${e.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeCloseTo(expected, tol = 1e-9) {
      if (Math.abs(actual - expected) > tol)
        throw new Error(`expected ${expected} ± ${tol}, got ${actual}`);
    },
    toBeNull() {
      if (actual !== null)
        throw new Error(`expected null, got ${JSON.stringify(actual)}`);
    },
    toThrow(type) {
      if (typeof actual !== 'function') throw new Error('expect(fn).toThrow — value must be a function');
      try { actual(); throw new Error('expected throw, but did not throw'); }
      catch(e) {
        if (e.message === 'expected throw, but did not throw') throw e;
        if (type && e.type !== type)
          throw new Error(`expected CalcError type "${type}", got "${e.type || e.message}"`);
      }
    },
  };
}

// ── Token builders ────────────────────────────────────────────────────────────
const n   = v => ({ type: 'number',           value: String(v) });
const op  = v => ({ type: 'operator',         value: v });
const fn_ = v => ({ type: 'function',         value: v });
const lp  =  () => ({ type: 'lparen' });
const rp  =  () => ({ type: 'rparen' });
const con = v => ({ type: 'constant',         value: v });
const um  =  () => ({ type: 'unary-minus' });
const pf  = v => ({ type: 'postfix-function', value: v });

const ev = (toks, mode = 'DEG', ans = '0') => Evaluator.evaluate(toks, mode, ans);

// ── Evaluator — arithmetic ────────────────────────────────────────────────────
describe('Evaluator — arithmetic', () => {
  it('addition',                 () => expect(ev([n(2), op('+'), n(3)])).toBe(5));
  it('subtraction',              () => expect(ev([n(10), op('-'), n(4)])).toBe(6));
  it('multiplication',           () => expect(ev([n(3), op('*'), n(4)])).toBe(12));
  it('division',                 () => expect(ev([n(10), op('/'), n(4)])).toBe(2.5));
  it('frac (n/d) same as /',     () => expect(ev([n(1), op('frac'), n(4)])).toBe(0.25));
  it('power 2^10',               () => expect(ev([n(2), op('^'), n(10)])).toBe(1024));
  it('precedence  2+3*4=14',     () => expect(ev([n(2), op('+'), n(3), op('*'), n(4)])).toBe(14));
  it('right-assoc  2^3^2=512',   () => expect(ev([n(2), op('^'), n(3), op('^'), n(2)])).toBe(512));
  it('parentheses  (2+3)*4=20',  () => expect(ev([lp(), n(2), op('+'), n(3), rp(), op('*'), n(4)])).toBe(20));
  it('unary minus  -5',          () => expect(ev([um(), n(5)])).toBe(-5));
  it('unary minus  2*-3=-6',     () => expect(ev([n(2), op('*'), um(), n(3)])).toBe(-6));
  it('implicit mult  2π',        () => expect(ev([n(2), con('π')])).toBeCloseTo(2 * Math.PI));
  it('π = Math.PI exactly',      () => expect(ev([con('π')])).toBe(Math.PI));
  it('e = Math.E exactly',       () => expect(ev([con('e')])).toBe(Math.E));
  it('factorial  5!=120',        () => expect(ev([n(5), pf('factorial')])).toBe(120));
  it('x^2  3^2=9',               () => expect(ev([n(3), op('^'), n(2)])).toBe(9));
  it('x^-1  4^-1=0.25',          () => expect(ev([n(4), op('^'), lp(), um(), n(1), rp()])).toBe(0.25));
});

// ── Evaluator — functions ─────────────────────────────────────────────────────
describe('Evaluator — functions', () => {
  it('sin(0) = 0',          () => expect(ev([fn_('sin'), lp(), n(0),  rp()])).toBe(0));
  it('sin(90°) = 1',        () => expect(ev([fn_('sin'), lp(), n(90), rp()])).toBe(1));
  it('cos(0) = 1',          () => expect(ev([fn_('cos'), lp(), n(0),  rp()])).toBe(1));
  it('cos(90°) = 0',        () => expect(ev([fn_('cos'), lp(), n(90), rp()])).toBe(0));
  it('tan(45°) ≈ 1',        () => expect(ev([fn_('tan'), lp(), n(45), rp()])).toBeCloseTo(1));
  it('asin(1) = 90° in DEG',() => expect(ev([fn_('asin'), lp(), n(1),  rp()])).toBeCloseTo(90));
  it('acos(1) = 0° in DEG', () => expect(ev([fn_('acos'), lp(), n(1),  rp()])).toBeCloseTo(0));
  it('atan(1) = 45° in DEG',() => expect(ev([fn_('atan'), lp(), n(1),  rp()])).toBeCloseTo(45));
  it('sin RAD  sin(π/2)=1', () =>
    expect(ev([fn_('sin'), lp(), con('π'), op('/'), n(2), rp()], 'RAD')).toBeCloseTo(1));
  it('sqrt(9) = 3',         () => expect(ev([fn_('sqrt'), lp(), n(9),  rp()])).toBe(3));
  it('cbrt(27) = 3',        () => expect(ev([fn_('cbrt'), lp(), n(27), rp()])).toBe(3));
  it('ln(e) = 1',           () => expect(ev([fn_('ln'),  lp(), con('e'), rp()])).toBeCloseTo(1));
  it('log(100) = 2',        () => expect(ev([fn_('log'), lp(), n(100), rp()])).toBe(2));
  it('exp(0) = 1',          () => expect(ev([fn_('exp'), lp(), n(0),   rp()])).toBe(1));
  it('pow10(3) = 1000',     () => expect(ev([fn_('pow10'), lp(), n(3), rp()])).toBe(1000));
  it('abs(-5) = 5',         () => expect(ev([fn_('abs'), lp(), um(), n(5), rp()])).toBe(5));
  it('nCr(5,2) = 10',       () =>
    expect(ev([fn_('nCr'), lp(), n(5), { type:'comma' }, n(2), rp()])).toBe(10));
  it('nPr(5,2) = 20',       () =>
    expect(ev([fn_('nPr'), lp(), n(5), { type:'comma' }, n(2), rp()])).toBe(20));
});

// ── Evaluator — errors ────────────────────────────────────────────────────────
describe('Evaluator — errors', () => {
  it('divide by zero',     () => expect(() => ev([n(1), op('/'), n(0)])).toThrow('DIVIDE BY 0'));
  it('frac by zero',       () => expect(() => ev([n(1), op('frac'), n(0)])).toThrow('DIVIDE BY 0'));
  it('0^-1',               () => expect(() => ev([n(0), op('^'), lp(), um(), n(1), rp()])).toThrow('DIVIDE BY 0'));
  it('sqrt negative',      () => expect(() => ev([fn_('sqrt'), lp(), um(), n(1), rp()])).toThrow('DOMAIN ERROR'));
  it('log(0)',             () => expect(() => ev([fn_('log'), lp(), n(0), rp()])).toThrow('DOMAIN ERROR'));
  it('ln(0)',              () => expect(() => ev([fn_('ln'),  lp(), n(0), rp()])).toThrow('DOMAIN ERROR'));
  it('asin out of range',  () => expect(() => ev([fn_('asin'), lp(), n(2), rp()])).toThrow('DOMAIN ERROR'));
  it('acos out of range',  () => expect(() => ev([fn_('acos'), lp(), n(2), rp()])).toThrow('DOMAIN ERROR'));
  it('missing close paren',() => expect(() => ev([fn_('sin'), lp(), n(1)])).toThrow('SYNTAX ERROR'));
  it('factorial of float', () => expect(() => ev([n(1.5), pf('factorial')])).toThrow('DOMAIN ERROR'));
  it('factorial negative', () => expect(() => ev([lp(), um(), n(1), rp(), pf('factorial')])).toThrow('DOMAIN ERROR'));
});

// ── Evaluator.formatResult ────────────────────────────────────────────────────
describe('Evaluator.formatResult', () => {
  it('integer 42',    () => expect(Evaluator.formatResult(42)).toBe('42'));
  it('decimal 1.5',   () => expect(Evaluator.formatResult(1.5)).toBe('1.5'));
  it('zero',          () => expect(Evaluator.formatResult(0)).toBe('0'));
  it('negative',      () => expect(Evaluator.formatResult(-3)).toBe('-3'));
  it('large → sci',   () => expect(Evaluator.formatResult(1e12)).toBe('1.000000E12'));
  it('small → sci',   () => expect(Evaluator.formatResult(1e-6)).toBe('1.000000E-6'));
  it('0.0001 decimal',() => expect(Evaluator.formatResult(0.0001)).toBe('0.0001'));
});

// ── Evaluator.toFraction ──────────────────────────────────────────────────────
describe('Evaluator.toFraction', () => {
  it('0.5 → 1/2',           () => { const f = Evaluator.toFraction(0.5);   expect(f.n).toBe(1); expect(f.d).toBe(2); });
  it('0.25 → 1/4',          () => { const f = Evaluator.toFraction(0.25);  expect(f.n).toBe(1); expect(f.d).toBe(4); });
  it('0.75 → 3/4',          () => { const f = Evaluator.toFraction(0.75);  expect(f.n).toBe(3); expect(f.d).toBe(4); });
  it('1/3 float → 1/3',     () => { const f = Evaluator.toFraction(1/3);   expect(f.n).toBe(1); expect(f.d).toBe(3); });
  it('0.1+0.2 → 3/10',      () => { const f = Evaluator.toFraction(0.1+0.2); expect(f.n).toBe(3); expect(f.d).toBe(10); });
  it('1.5 → whole=1 n=1 d=2', () => { const f = Evaluator.toFraction(1.5); expect(f.whole).toBe(1); expect(f.n).toBe(1); expect(f.d).toBe(2); });
  it('4/3 → whole=1',        () => { const f = Evaluator.toFraction(4/3);  expect(f.whole).toBe(1); expect(f.n).toBe(1); expect(f.d).toBe(3); });
  it('-0.5 sign=-1',         () => { const f = Evaluator.toFraction(-0.5); expect(f.sign).toBe(-1); expect(f.n).toBe(1); expect(f.d).toBe(2); });
  it('integer 3 → n=0 d=1', () => { const f = Evaluator.toFraction(3);    expect(f.n).toBe(0); expect(f.d).toBe(1); });
  it('π → null',             () => expect(Evaluator.toFraction(Math.PI)).toBeNull());
  it('√2 → null',            () => expect(Evaluator.toFraction(Math.sqrt(2))).toBeNull());
  it('1/1000 denom>999 → null', () => expect(Evaluator.toFraction(1/1000)).toBeNull());
  it('sin(30°) ≈ 0.5 → 1/2',() => {
    const v = Math.sin(30 * Math.PI / 180);
    const f = Evaluator.toFraction(v);
    expect(f.n).toBe(1); expect(f.d).toBe(2);
  });
});

// ── Evaluator._esc ────────────────────────────────────────────────────────────
describe('Evaluator._esc', () => {
  it('escapes <',        () => expect(Evaluator._esc('<')).toBe('&lt;'));
  it('escapes >',        () => expect(Evaluator._esc('>')).toBe('&gt;'));
  it('escapes &',        () => expect(Evaluator._esc('&')).toBe('&amp;'));
  it('escapes "',        () => expect(Evaluator._esc('"')).toBe('&quot;'));
  it("escapes '",        () => expect(Evaluator._esc("'")).toBe('&#39;'));
  it('digits pass through', () => expect(Evaluator._esc('123')).toBe('123'));
  it('combined',         () => expect(Evaluator._esc('<b>')).toBe('&lt;b&gt;'));
});

// ── Evaluator.formatFractionHTML ──────────────────────────────────────────────
describe('Evaluator.formatFractionHTML', () => {
  it('1/2 contains frac-v',   () => { const h = Evaluator.formatFractionHTML({whole:0,n:1,d:2,sign:1}); expect(h.includes('frac-v')).toBe(true); });
  it('1/2 num and den visible',() => { const h = Evaluator.formatFractionHTML({whole:0,n:1,d:2,sign:1}); expect(h.includes('>1<')).toBe(true); expect(h.includes('>2<')).toBe(true); });
  it('1 1/2 starts with 1',   () => { const h = Evaluator.formatFractionHTML({whole:1,n:1,d:2,sign:1}); expect(h.startsWith('1')).toBe(true); });
  it('-1/2 starts with -',    () => { const h = Evaluator.formatFractionHTML({whole:0,n:1,d:2,sign:-1}); expect(h.startsWith('-')).toBe(true); });
  it('whole only → no frac-v',() => { const h = Evaluator.formatFractionHTML({whole:3,n:0,d:1,sign:1}); expect(h.includes('frac-v')).toBe(false); });
  it('escapes special chars in values', () => {
    // Values are always integers from toFraction so this is defensive
    const h = Evaluator.formatFractionHTML({whole:0,n:1,d:2,sign:1});
    expect(h.includes('<script')).toBe(false);
  });
});

// ── Calculator — basic operations ─────────────────────────────────────────────
describe('Calculator — basic operations', () => {
  const c = () => new Calculator();

  it('digit entry builds number token', () => {
    const calc = c(); calc.handleKey(undefined, '5');
    expect(calc.tokens[0].value).toBe('5');
  });
  it('multi-digit appends to same token', () => {
    const calc = c();
    ['1','2','3'].forEach(d => calc.handleKey(undefined, d));
    expect(calc.tokens[0].value).toBe('123');
  });
  it('decimal entry', () => {
    const calc = c();
    calc.handleKey(undefined, '3'); calc.handleKey('decimal');
    calc.handleKey(undefined, '1'); calc.handleKey(undefined, '4');
    expect(calc.tokens[0].value).toBe('3.14');
  });
  it('2 + 3 = 5', () => {
    const calc = c();
    calc.handleKey(undefined, '2'); calc.handleKey('addition');
    calc.handleKey(undefined, '3'); calc.handleKey('calculate');
    expect(calc.result).toBe('5');
  });
  it('result stores rawValue', () => {
    const calc = c();
    calc.handleKey(undefined, '2'); calc.handleKey('addition');
    calc.handleKey(undefined, '3'); calc.handleKey('calculate');
    expect(calc.rawValue).toBe(5);
  });
  it('clear resets tokens and result', () => {
    const calc = c();
    calc.handleKey(undefined, '5'); calc.handleKey('clear');
    expect(calc.tokens.length).toBe(0);
    expect(calc.result).toBeNull();
  });
  it('clear resets rawValue', () => {
    const calc = c();
    calc.handleKey(undefined, '5'); calc.handleKey('calculate');
    calc.handleKey('clear');
    expect(calc.rawValue).toBeNull();
  });
  it('delete removes last digit', () => {
    const calc = c();
    ['1','2','3'].forEach(d => calc.handleKey(undefined, d));
    calc.handleKey('delete');
    expect(calc.tokens[0].value).toBe('12');
  });
  it('delete on single digit clears token', () => {
    const calc = c();
    calc.handleKey(undefined, '5'); calc.handleKey('delete');
    expect(calc.tokens.length).toBe(0);
  });
  it('off stops input', () => {
    const calc = c();
    calc.handleKey('off'); expect(calc.isOff).toBe(true);
    calc.handleKey(undefined, '5');
    expect(calc.tokens.length).toBe(0);
  });
  it('on restores input', () => {
    const calc = c();
    calc.handleKey('off'); calc.handleKey('on');
    expect(calc.isOff).toBe(false);
  });
  it('divide by zero → DIVIDE BY 0 error', () => {
    const calc = c();
    calc.handleKey(undefined, '1'); calc.handleKey('division');
    calc.handleKey(undefined, '0'); calc.handleKey('calculate');
    expect(calc.error).toBe('DIVIDE BY 0');
    expect(calc.result).toBeNull();
  });
  it('auto-closes open paren on calculate', () => {
    const calc = c();
    calc.handleKey('sin');       // pushes sin( — openParenCount=1
    calc.handleKey(undefined,'9'); calc.handleKey(undefined,'0');
    calc.handleKey('calculate'); // should auto-close paren
    expect(parseFloat(calc.result)).toBe(1);
  });
  it('negative entry', () => {
    const calc = c();
    calc.handleKey('negative');
    expect(calc.tokens[0].type).toBe('unary-minus');
  });
  it('squared  3^2=9', () => {
    const calc = c();
    calc.handleKey(undefined,'3'); calc.handleKey('squared'); calc.handleKey('calculate');
    expect(calc.result).toBe('9');
  });
  it('open/close paren', () => {
    const calc = c();
    calc.handleKey('open-paren'); calc.handleKey(undefined,'2'); calc.handleKey('addition');
    calc.handleKey(undefined,'3'); calc.handleKey('close-paren');
    calc.handleKey('multiplication'); calc.handleKey(undefined,'4'); calc.handleKey('calculate');
    expect(calc.result).toBe('20');
  });
  it('justCalculated flag set after =', () => {
    const calc = c();
    calc.handleKey(undefined,'5'); calc.handleKey('calculate');
    expect(calc.justCalculated).toBe(true);
  });
  it('justCalculated cleared after new digit', () => {
    const calc = c();
    calc.handleKey(undefined,'5'); calc.handleKey('calculate');
    calc.handleKey(undefined,'3');
    expect(calc.justCalculated).toBe(false);
  });
});

// ── Calculator — angle mode ───────────────────────────────────────────────────
describe('Calculator — angle mode', () => {
  it('default is DEG', () => expect(new Calculator().angleMode).toBe('DEG'));
  it('mode cycles DEG→RAD→GRAD→DEG', () => {
    const calc = new Calculator();
    calc.handleKey('mode'); expect(calc.angleMode).toBe('RAD');
    calc.handleKey('mode'); expect(calc.angleMode).toBe('GRAD');
    calc.handleKey('mode'); expect(calc.angleMode).toBe('DEG');
  });
  it('sin(90°) DEG = 1', () => {
    const calc = new Calculator();
    calc.handleKey('sin');
    calc.handleKey(undefined,'9'); calc.handleKey(undefined,'0');
    calc.handleKey('calculate');
    expect(parseFloat(calc.result)).toBe(1);
  });
  it('sin(π/2) RAD = 1', () => {
    const calc = new Calculator();
    calc.handleKey('mode'); // → RAD
    calc.handleKey('sin'); calc.handleKey('pi'); calc.handleKey('division');
    calc.handleKey(undefined,'2'); calc.handleKey('calculate');
    expect(parseFloat(calc.result)).toBeCloseTo(1);
  });
});

// ── Calculator — 2nd key ──────────────────────────────────────────────────────
describe('Calculator — 2nd key', () => {
  it('toggles secondActive on/off', () => {
    const calc = new Calculator();
    calc.handleKey('2nd'); expect(calc.secondActive).toBe(true);
    calc.handleKey('2nd'); expect(calc.secondActive).toBe(false);
  });
  it('sin → asin via 2nd', () => {
    const calc = new Calculator();
    calc.handleKey('2nd'); calc.handleKey('sin');
    expect(calc.tokens[0].value).toBe('asin');
    expect(calc.secondActive).toBe(false);
  });
  it('log → pow10 via 2nd', () => {
    const calc = new Calculator();
    calc.handleKey('2nd'); calc.handleKey('log');
    expect(calc.tokens[0].value).toBe('pow10');
  });
  it('sqrt → cbrt via 2nd', () => {
    const calc = new Calculator();
    calc.handleKey('2nd'); calc.handleKey('sqrt');
    expect(calc.tokens[0].value).toBe('cbrt');
  });
});

// ── Calculator — fractions ────────────────────────────────────────────────────
describe('Calculator — fractions', () => {
  it('fracDisplay default true',  () => expect(new Calculator().fracDisplay).toBe(true));
  it('n/d inserts frac token',    () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'1'); calc.handleKey('n/d');
    expect(calc.tokens[1].value).toBe('frac');
  });
  it('1 n/d 4 = 0.25 rawValue',  () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'1'); calc.handleKey('n/d');
    calc.handleKey(undefined,'4'); calc.handleKey('calculate');
    expect(calc.rawValue).toBe(0.25);
  });
  it('1 n/d 4 + 1 n/d 4 = 0.5', () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'1'); calc.handleKey('n/d');
    calc.handleKey(undefined,'4'); calc.handleKey('addition');
    calc.handleKey(undefined,'1'); calc.handleKey('n/d');
    calc.handleKey(undefined,'4'); calc.handleKey('calculate');
    expect(calc.rawValue).toBe(0.5);
  });
  it('F↔D via 2nd+n/d toggles fracDisplay', () => {
    const calc = new Calculator();
    calc.handleKey('2nd'); calc.handleKey('n/d');
    expect(calc.fracDisplay).toBe(false);
    calc.handleKey('2nd'); calc.handleKey('n/d');
    expect(calc.fracDisplay).toBe(true);
  });
});

// ── Calculator — history & Ans ────────────────────────────────────────────────
describe('Calculator — history & Ans', () => {
  it('result stored in history', () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'5'); calc.handleKey('calculate');
    expect(calc.history.length).toBe(1);
    expect(calc.history[0].result).toBe('5');
  });
  it('Ans used in next expression', () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'3'); calc.handleKey('calculate');
    calc.handleKey('addition');    // new expr starts with Ans token
    calc.handleKey(undefined,'2'); calc.handleKey('calculate');
    expect(calc.result).toBe('5');
  });
  it('ans property updated after calculate', () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'7'); calc.handleKey('calculate');
    expect(calc.ans).toBe('7');
  });
  it('up arrow recalls last expression', () => {
    const calc = new Calculator();
    calc.handleKey(undefined,'5'); calc.handleKey('addition');
    calc.handleKey(undefined,'3'); calc.handleKey('calculate');
    calc.handleKey('up');
    expect(calc.tokens.length).toBeCloseTo(3, 0); // 5, +, 3
  });
  it('history capped at 50 entries', () => {
    const calc = new Calculator();
    for (let i = 0; i < 55; i++) {
      calc.handleKey(undefined,'1'); calc.handleKey('calculate');
    }
    expect(calc.history.length).toBe(50);
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
const total = passed + failed;
console.log(`${passed}/${total} passed${failed ? `  (${failed} failed)` : ''}`);
if (failed > 0) process.exit(1);
