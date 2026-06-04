// ============================================================
// SECTION 1: CalcError
// ============================================================

class CalcError extends Error {
  constructor(type) {
    super(type);
    this.type = type;
  }
}

// ============================================================
// SECTION 2: Evaluator (Shunting-Yard → RPN)
// ============================================================

class Evaluator {
  static OPERATORS = {
    '+':    { precedence: 1, assoc: 'L' },
    '-':    { precedence: 1, assoc: 'L' },
    '*':    { precedence: 2, assoc: 'L' },
    '/':    { precedence: 2, assoc: 'L' },
    'frac': { precedence: 2, assoc: 'L' }, // n/d fraction bar — same as /
    '^':    { precedence: 4, assoc: 'R' },
  };
  static UNARY_PREC = 3; // between * (2) and ^ (4), right-associative
  static TWO_ARG_FUNCS = new Set(['nthroot', 'nPr', 'nCr', 'round', 'min', 'max', 'gcd', 'lcm', 'remainder', 'randint']);

  // ----- Angle conversion -----

  static _toRad(x, mode) {
    if (mode === 'DEG')  return x * Math.PI / 180;
    if (mode === 'GRAD') return x * Math.PI / 200;
    return x;
  }

  static _fromRad(x, mode) {
    if (mode === 'DEG')  return x * 180 / Math.PI;
    if (mode === 'GRAD') return x * 200 / Math.PI;
    return x;
  }

  // ----- Arithmetic helpers -----

  static _factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 69) throw new CalcError('DOMAIN ERROR');
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  static _nPr(n, r) {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n)
      throw new CalcError('DOMAIN ERROR');
    return Evaluator._factorial(n) / Evaluator._factorial(n - r);
  }

  static _nCr(n, r) {
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n)
      throw new CalcError('DOMAIN ERROR');
    return Evaluator._factorial(n) / (Evaluator._factorial(r) * Evaluator._factorial(n - r));
  }

  static _applyOperator(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
      case 'frac':
        if (b === 0) throw new CalcError('DIVIDE BY 0');
        return a / b;
      case '^':
        if (a === 0 && b < 0)           throw new CalcError('DIVIDE BY 0');
        if (a < 0 && !Number.isInteger(b)) throw new CalcError('DOMAIN ERROR');
        return Math.pow(a, b);
      default:
        throw new CalcError('SYNTAX ERROR');
    }
  }

  static _applyFunction(name, args, mode) {
    const [a, b] = args;
    const trig = v => Math.abs(v) < 1e-10 ? 0 : v;

    switch (name) {
      case 'sin':      return trig(Math.sin(Evaluator._toRad(a, mode)));
      case 'cos':      return trig(Math.cos(Evaluator._toRad(a, mode)));
      case 'tan': {
        const r = Evaluator._toRad(a, mode);
        if (Math.abs(Math.cos(r)) < 1e-10) throw new CalcError('DOMAIN ERROR');
        return trig(Math.tan(r));
      }
      case 'asin':
        if (Math.abs(a) > 1) throw new CalcError('DOMAIN ERROR');
        return Evaluator._fromRad(Math.asin(a), mode);
      case 'acos':
        if (Math.abs(a) > 1) throw new CalcError('DOMAIN ERROR');
        return Evaluator._fromRad(Math.acos(a), mode);
      case 'atan':     return Evaluator._fromRad(Math.atan(a), mode);
      case 'sinh':     return Math.sinh(a);
      case 'cosh':     return Math.cosh(a);
      case 'tanh':     return Math.tanh(a);
      case 'asinh':    return Math.asinh(a);
      case 'acosh':
        if (a < 1) throw new CalcError('DOMAIN ERROR');
        return Math.acosh(a);
      case 'atanh':
        if (Math.abs(a) >= 1) throw new CalcError('DOMAIN ERROR');
        return Math.atanh(a);
      case 'ln':
        if (a <= 0) throw new CalcError('DOMAIN ERROR');
        return Math.log(a);
      case 'log':
        if (a <= 0) throw new CalcError('DOMAIN ERROR');
        return Math.log10(a);
      case 'sqrt':
        if (a < 0) throw new CalcError('DOMAIN ERROR');
        return Math.sqrt(a);
      case 'cbrt':     return Math.cbrt(a);
      case 'abs':      return Math.abs(a);
      case 'exp':      return Math.exp(a);
      case 'pow10':    return Math.pow(10, a);
      case 'factorial': return Evaluator._factorial(a);
      case 'nthroot':
        if (a === 0) throw new CalcError('DOMAIN ERROR');
        if (b < 0 && !Number.isInteger(a)) throw new CalcError('DOMAIN ERROR');
        return Math.pow(b, 1 / a);
      case 'nPr':      return Evaluator._nPr(a, b);
      case 'nCr':      return Evaluator._nCr(a, b);
      case 'percent':  return a / 100;
      case 'iPart':    return Math.trunc(a);
      case 'fPart':    return a - Math.trunc(a);
      case 'round':    return Math.round(a * Math.pow(10, b)) / Math.pow(10, b);
      case 'min':      return Math.min(a, b);
      case 'max':      return Math.max(a, b);
      case 'gcd': {
        const ga = Math.round(Math.abs(a)), gb = Math.round(Math.abs(b));
        return Evaluator._gcd(ga, gb);
      }
      case 'lcm': {
        const la = Math.round(Math.abs(a)), lb = Math.round(Math.abs(b));
        const g = Evaluator._gcd(la, lb);
        return g === 0 ? 0 : (la * lb) / g;
      }
      case 'remainder':
        if (b === 0) throw new CalcError('DIVIDE BY 0');
        return a - Math.trunc(a / b) * b;
      case 'randint':
        if (!Number.isInteger(a) || !Number.isInteger(b) || a > b) throw new CalcError('DOMAIN ERROR');
        return Math.floor(Math.random() * (b - a + 1)) + a;
      default:
        throw new CalcError('SYNTAX ERROR');
    }
  }

  // ----- Preprocessing -----

  static _preprocess(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = out[out.length - 1];

      // Implicit multiplication: value followed by ( | function | constant
      if (prev) {
        const prevIsVal = prev.type === 'number' || prev.type === 'constant' || prev.type === 'rparen';
        const currNeedMul = t.type === 'lparen' || t.type === 'function' || t.type === 'constant';
        if (prevIsVal && currNeedMul) {
          out.push({ type: 'operator', value: '*' });
        }
      }
      out.push(t);
    }
    return out;
  }

  // ----- Shunting-Yard -----

  static _toRPN(tokens) {
    const output = [];
    const ops = [];

    const topPrec = () => {
      const top = ops[ops.length - 1];
      if (!top) return -Infinity;
      if (top.type === 'operator')    return Evaluator.OPERATORS[top.value].precedence;
      if (top.type === 'unary-minus') return Evaluator.UNARY_PREC;
      return -Infinity;
    };

    const shouldPop = (inPrec, inAssoc) => {
      const top = ops[ops.length - 1];
      if (!top || top.type === 'lparen' || top.type === 'function') return false;
      const tp = topPrec();
      return tp > inPrec || (tp === inPrec && inAssoc === 'L');
    };

    for (const t of tokens) {
      if (t.type === 'number' || t.type === 'constant') {
        output.push(t);
      } else if (t.type === 'function') {
        ops.push(t);
      } else if (t.type === 'unary-minus') {
        while (shouldPop(Evaluator.UNARY_PREC, 'R')) output.push(ops.pop());
        ops.push(t);
      } else if (t.type === 'operator') {
        const { precedence, assoc } = Evaluator.OPERATORS[t.value];
        while (shouldPop(precedence, assoc)) output.push(ops.pop());
        ops.push(t);
      } else if (t.type === 'lparen') {
        ops.push(t);
      } else if (t.type === 'rparen') {
        while (ops.length && ops[ops.length - 1].type !== 'lparen') {
          output.push(ops.pop());
        }
        if (!ops.length) throw new CalcError('SYNTAX ERROR');
        ops.pop(); // discard (
        if (ops.length && ops[ops.length - 1].type === 'function') {
          output.push(ops.pop());
        }
      } else if (t.type === 'comma') {
        while (ops.length && ops[ops.length - 1].type !== 'lparen') {
          output.push(ops.pop());
        }
        if (!ops.length) throw new CalcError('SYNTAX ERROR');
      } else if (t.type === 'postfix-function') {
        output.push(t);
      }
    }

    while (ops.length) {
      if (ops[ops.length - 1].type === 'lparen') throw new CalcError('SYNTAX ERROR');
      output.push(ops.pop());
    }

    return output;
  }

  // ----- RPN Evaluation -----

  static _evalRPN(rpn, mode, ans, memory = {}) {
    const stack = [];

    for (const t of rpn) {
      if (t.type === 'number') {
        const v = parseFloat(t.value);
        if (isNaN(v)) throw new CalcError('SYNTAX ERROR');
        stack.push(v);
      } else if (t.type === 'constant') {
        switch (t.value) {
          case 'π':   stack.push(Math.PI); break;
          case 'e':   stack.push(Math.E);  break;
          case 'Ans': stack.push(parseFloat(ans) || 0); break;
          default:
            if (t.value in memory) { stack.push(memory[t.value]); break; }
            throw new CalcError('SYNTAX ERROR');
        }
      } else if (t.type === 'operator') {
        if (stack.length < 2) throw new CalcError('SYNTAX ERROR');
        const b = stack.pop(), a = stack.pop();
        stack.push(Evaluator._applyOperator(t.value, a, b));
      } else if (t.type === 'unary-minus') {
        if (!stack.length) throw new CalcError('SYNTAX ERROR');
        stack.push(-stack.pop());
      } else if (t.type === 'function') {
        if (Evaluator.TWO_ARG_FUNCS.has(t.value)) {
          if (stack.length < 2) throw new CalcError('SYNTAX ERROR');
          const b = stack.pop(), a = stack.pop();
          stack.push(Evaluator._applyFunction(t.value, [a, b], mode));
        } else {
          if (!stack.length) throw new CalcError('SYNTAX ERROR');
          stack.push(Evaluator._applyFunction(t.value, [stack.pop()], mode));
        }
      } else if (t.type === 'postfix-function') {
        if (!stack.length) throw new CalcError('SYNTAX ERROR');
        stack.push(Evaluator._applyFunction(t.value, [stack.pop()], mode));
      }
    }

    if (stack.length !== 1) throw new CalcError('SYNTAX ERROR');
    return stack[0];
  }

  // ----- Public API -----

  static evaluate(tokens, angleMode, ansValue, memory = {}) {
    if (!tokens || !tokens.length) throw new CalcError('SYNTAX ERROR');
    const pre = Evaluator._preprocess(tokens);
    const rpn = Evaluator._toRPN(pre);
    const result = Evaluator._evalRPN(rpn, angleMode, ansValue, memory);
    if (!isFinite(result)) throw new CalcError('OVERFLOW');
    if (isNaN(result))     throw new CalcError('DOMAIN ERROR');
    return result;
  }

  static formatResult(value) {
    if (!isFinite(value)) throw new CalcError('OVERFLOW');
    if (isNaN(value))     throw new CalcError('DOMAIN ERROR');

    const rounded = parseFloat(value.toPrecision(10));
    if (rounded === 0) return '0';

    const abs = Math.abs(rounded);
    if (abs >= 1e10 || abs < 1e-4) {
      return rounded.toExponential(6).toUpperCase().replace('E+', 'E');
    }
    return String(rounded);
  }

  static _gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  // Returns { whole, n, d, sign } or null if no clean fraction with denom ≤ maxDenom
  static toFraction(x, maxDenom = 999) {
    const EPS = 5e-9;
    if (!isFinite(x) || isNaN(x)) return null;

    const sign  = x < 0 ? -1 : 1;
    const ax    = Math.abs(x);
    const whole = Math.floor(ax + EPS);
    let   frac  = ax - whole;

    if (frac < EPS || frac > 1 - EPS) {
      return { whole: sign * Math.round(ax), n: 0, d: 1, sign };
    }

    // Continued-fractions search
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = frac, n = 0, d = 1;
    for (let i = 0; i < 64; i++) {
      const a  = Math.floor(b);
      const h  = a * h1 + h2;
      const k  = a * k1 + k2;
      if (k > maxDenom) break;
      [h2, h1] = [h1, h]; [k2, k1] = [k1, k];
      n = h1; d = k1;
      if (Math.abs(frac - h1 / k1) < EPS) break;
      const rem = b - a;
      if (Math.abs(rem) < EPS) break;
      b = 1 / rem;
    }

    if (Math.abs(frac - n / d) > EPS * 10) return null;

    const g = Evaluator._gcd(n, d);
    return { whole, n: n / g, d: d / g, sign };
  }

  static formatFraction({ whole, n, d, sign }) {
    const neg = sign < 0 ? '-' : '';
    if (n === 0) return neg + whole;
    if (whole === 0) return neg + n + '/' + d;
    return neg + whole + ' ' + n + '/' + d;
  }

  static _esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  static toDMS(degrees) {
    const sign = degrees < 0 ? -1 : 1;
    const d = Math.abs(degrees);
    const deg = Math.floor(d);
    const minF = (d - deg) * 60;
    const min = Math.floor(minF);
    const sec = parseFloat(((minF - min) * 60).toPrecision(8));
    return (sign < 0 ? '-' : '') + deg + '°' + min + "'" + sec + '"';
  }

  static formatFractionHTML({ whole, n, d, sign }) {
    const e   = Evaluator._esc;
    const neg = sign < 0 ? '-' : '';
    const fv  = (a, b) =>
      `<span class="frac-v"><span class="frac-n">${e(a)}</span><span class="frac-d">${e(b)}</span></span>`;
    if (n === 0) return neg + e(whole);
    if (whole === 0) return neg + fv(n, d);
    return neg + e(whole) + fv(n, d);
  }
}

// ============================================================
// SECTION 3: Calculator (state machine)
// ============================================================

const SECOND_MAP = {
  sin:           'asin',
  cos:           'acos',
  tan:           'atan',
  ln:            'exp',
  log:           'pow10',
  sqrt:          'cbrt',
  'n/d':         'und',
  'table':       'F↔D',
  'open-paren':  'percent',
  'close-paren': 'topercent',
  'negative':    'ans',
  'probability': 'angle-menu',
  'delete':      'ins',
  'data':        'rcl',
  'decimal':     'comma',
  pi:            'hyp',
  power:         'xroot',
  mode:          'quit',
  squared:       'sqrt',
};

class Calculator {
  constructor() {
    this.tokens         = [];
    this.result         = null;
    this.error          = null;
    this.ans            = '0';
    this.angleMode      = 'DEG';
    this.secondActive   = false;
    this.hypActive      = false;
    this.justCalculated = false;
    this.openParenCount = 0;
    this.history        = [];
    this.historyIndex   = -1;
    this.memory         = { x: 0, y: 0, z: 0, t: 0, a: 0, b: 0, c: 0 };
    this.isOff          = false;
    this.rawValue       = null;
    this.cursorPos      = 0;
    this.fracDisplay    = true;
    this.fracMixed      = true;
    this.dmsMode        = false;
    this.menuState      = null;
    this.displayManager = null;
    this.secondScreen   = null;
  }

  // ----- Main dispatch -----

  handleKey(action, raw) {
    if (this.isOff && action !== 'on') return;

    if (this.menuState) { this._handleMenuKey(action, raw); return; }

    if (!action) {
      const d = (raw || '').trim();
      if (/^\d$/.test(d)) this._inputDigit(d);
      return;
    }

    const effective = (this.secondActive && SECOND_MAP[action]) ? SECOND_MAP[action] : action;

    if (this.secondActive && action !== '2nd') {
      this.secondActive = false;
      document.body.classList.remove('second-active');
      const btn = document.getElementById('secondBtn');
      if (btn) btn.classList.remove('active');
    }

    // HYP mode: redirect trig functions to their hyperbolic equivalents
    let dispatched = effective;
    if (this.hypActive && effective !== 'hyp') {
      const HYP_MAP = { sin: 'sinh', cos: 'cosh', tan: 'tanh', asin: 'asinh', acos: 'acosh', atan: 'atanh' };
      if (HYP_MAP[effective]) {
        dispatched = HYP_MAP[effective];
        this.hypActive = false;
      }
    }

    this._dispatch(dispatched, raw);
  }

  _dispatch(action) {
    switch (action) {
      case 'on':               this._on();                          break;
      case 'off':              this._off();                         break;
      case 'clear':            this.clear();                        break;
      case 'delete':           this._delete();                      break;
      case 'calculate':        this._calculate();                   break;
      case '2nd':              this._toggleSecond();                break;
      case 'mode':             this._cycleAngleMode();              break;
      case 'up':               this._navigateHistory('up');         break;
      case 'down':             this._navigateHistory('down');       break;
      case 'left':             this._cursorLeft();                  break;
      case 'right':            this._cursorRight();                 break;
      case 'forward':          this._cursorLeft();                  break;
      case 'backward':         this._cursorRight();                 break;
      case 'percent':          this._inputPostfix('percent');       break;
      case 'topercent':        this._toPercent();                   break;
      case 'ans':              this._inputConstant('Ans');          break;
      case 'und':              this._toggleFracMixed();             break;
      case 'ins':              /* INS not yet implemented */        break;
      case 'quit':             this.menuState = null; this._notify(); break;
      case 'comma':            this._inputComma();                  break;
      case 'data':             this._openStoMenu();                 break;
      case 'rcl':              this._openRclMenu();                 break;
      case 'angle-menu':       this._openAngleMenu();               break;
      case 'addition':         this._inputOperator('+');            break;
      case 'subtraction':      this._inputOperator('-');            break;
      case 'multiplication':   this._inputOperator('*');            break;
      case 'division':         this._inputOperator('/');            break;
      case 'n/d':              this._inputOperator('frac');         break;
      case 'power':            this._inputOperator('^');            break;
      case 'open-paren':       this._inputParen('(');              break;
      case 'close-paren':      this._inputParen(')');              break;
      case 'decimal':          this._inputDecimal();                break;
      case 'negative':         this._inputNegative();               break;
      case 'squared':          this._inputSquared();                break;
      case 'negative-exponent':this._inputInverse();                break;
      case 'exponent':         this._inputExponent();               break;
      case 'sin':              this._inputFunction('sin');          break;
      case 'cos':              this._inputFunction('cos');          break;
      case 'tan':              this._inputFunction('tan');          break;
      case 'asin':             this._inputFunction('asin');         break;
      case 'acos':             this._inputFunction('acos');         break;
      case 'atan':             this._inputFunction('atan');         break;
      case 'ln':               this._inputFunction('ln');           break;
      case 'log':              this._inputFunction('log');          break;
      case 'exp':              this._inputFunction('exp');          break;
      case 'pow10':            this._inputFunction('pow10');        break;
      case 'sqrt':             this._inputFunction('sqrt');         break;
      case 'cbrt':             this._inputFunction('cbrt');         break;
      case 'pi':               this._inputConstant('π');            break;
      case 'probability':      this._openPrbMenu();                 break;
      case 'F↔D':             this._toggleFracDisplay();           break;
      case 'hyp':              this._toggleHyp();                  break;
      case 'xroot':            this._inputXRoot();                  break;
      case 'sinh':             this._inputFunction('sinh');         break;
      case 'cosh':             this._inputFunction('cosh');         break;
      case 'tanh':             this._inputFunction('tanh');         break;
      case 'asinh':            this._inputFunction('asinh');        break;
      case 'acosh':            this._inputFunction('acosh');        break;
      case 'atanh':            this._inputFunction('atanh');        break;
      default: break;
    }
  }

  // ----- Input methods -----

  _inputDigit(d) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = []; this.result = null; this.justCalculated = false; this.cursorPos = 0;
    }

    const prev = this.tokens[this.cursorPos - 1];
    const next = this.tokens[this.cursorPos];

    if (prev && prev.type === 'unary-minus') {
      this.tokens.splice(this.cursorPos - 1, 1, { type: 'number', value: '-' + d });
      // cursorPos unchanged: removed 1, inserted 1 at same index, cursor stays after it
    } else if (prev && prev.type === 'number') {
      if (prev.value === '0') prev.value = d;
      else prev.value += d;
    } else if (next && next.type === 'number') {
      // Prepend to following number to avoid adjacent-number-token evaluation error;
      // advance cursor past the merged token so subsequent digits append normally.
      next.value = d + next.value;
      this.cursorPos++;
    } else {
      this.tokens.splice(this.cursorPos, 0, { type: 'number', value: d });
      this.cursorPos++;
    }
    this._notify();
  }

  _inputOperator(op) {
    if (this.error) { this.error = null; this._notify(); return; }

    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
      this.cursorPos = 1;
    }

    if (!this.tokens.length) {
      if (op === '-') {
        this.tokens.splice(this.cursorPos, 0, { type: 'unary-minus' });
        this.cursorPos++;
        this._notify();
      }
      return;
    }

    const prev = this.tokens[this.cursorPos - 1];
    if (prev && prev.type === 'operator') {
      prev.value = op;
      this._notify();
      return;
    }

    this.tokens.splice(this.cursorPos, 0, { type: 'operator', value: op });
    this.cursorPos++;
    this._notify();
  }

  _inputFunction(name) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = []; this.result = null; this.justCalculated = false; this.cursorPos = 0;
    }
    this.tokens.splice(this.cursorPos, 0, { type: 'function', value: name }, { type: 'lparen' });
    this.cursorPos += 2;
    this._notify();
  }

  _inputConstant(name) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = []; this.result = null; this.justCalculated = false; this.cursorPos = 0;
    }
    this.tokens.splice(this.cursorPos, 0, { type: 'constant', value: name });
    this.cursorPos++;
    this._notify();
  }

  _inputParen(which) {
    if (this.error) this.clear();
    if (which === '(') {
      if (this.justCalculated) {
        this.tokens = []; this.result = null; this.justCalculated = false; this.cursorPos = 0;
      }
      this.tokens.splice(this.cursorPos, 0, { type: 'lparen' });
      this.cursorPos++;
    } else {
      // Only allow closing if there's an unmatched open paren to the left of cursor
      const openLeft = this.tokens.slice(0, this.cursorPos).reduce(
        (n, t) => t.type === 'lparen' ? n + 1 : t.type === 'rparen' ? n - 1 : n, 0
      );
      if (openLeft <= 0) return;
      this.tokens.splice(this.cursorPos, 0, { type: 'rparen' });
      this.cursorPos++;
    }
    this._notify();
  }

  _inputDecimal() {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [{ type: 'number', value: '0.' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
      this._notify();
      return;
    }
    const prev = this.tokens[this.cursorPos - 1];
    if (prev && prev.type === 'number') {
      if (!prev.value.includes('.')) prev.value += '.';
    } else {
      this.tokens.splice(this.cursorPos, 0, { type: 'number', value: '0.' });
      this.cursorPos++;
    }
    this._notify();
  }

  _inputNegative() {
    if (this.error) this.clear();

    if (this.justCalculated) {
      this.tokens = [{ type: 'unary-minus' }, { type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 2;
      this._notify();
      return;
    }

    const prev = this.tokens[this.cursorPos - 1];
    if (prev && prev.type === 'number') {
      prev.value = prev.value.startsWith('-') ? prev.value.slice(1) : '-' + prev.value;
      this._notify();
      return;
    }
    this.tokens.splice(this.cursorPos, 0, { type: 'unary-minus' });
    this.cursorPos++;
    this._notify();
  }

  _inputSquared() {
    if (!this.tokens.length && !this.justCalculated) return;
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
    }
    this.tokens.splice(this.cursorPos, 0, { type: 'operator', value: '^' }, { type: 'number', value: '2' });
    this.cursorPos += 2;
    this._notify();
  }

  _inputInverse() {
    if (!this.tokens.length && !this.justCalculated) return;
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
    }
    this.tokens.splice(this.cursorPos, 0, { type: 'operator', value: '^' }, { type: 'number', value: '-1' });
    this.cursorPos += 2;
    this._notify();
  }

  _inputExponent() {
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
    }
    this.tokens.splice(this.cursorPos, 0,
      { type: 'operator', value: '*' },
      { type: 'number', value: '10' },
      { type: 'operator', value: '^' }
    );
    this.cursorPos += 3;
    this._notify();
  }

  _inputPostfix(name) {
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
    }
    const prev = this.tokens[this.cursorPos - 1];
    if (!prev) return;
    const validPrev = prev.type === 'number' || prev.type === 'rparen' || prev.type === 'constant' || prev.type === 'postfix-function';
    if (!validPrev) return;
    this.tokens.splice(this.cursorPos, 0, { type: 'postfix-function', value: name });
    this.cursorPos++;
    this._notify();
  }

  // ----- Calculator operations -----

  _toggleFracDisplay() {
    this.fracDisplay = !this.fracDisplay;
    this._notify();
  }

  _toggleHyp() {
    this.hypActive = !this.hypActive;
    this._notify();
  }

  _inputXRoot() {
    if (this.justCalculated) {
      // Ans becomes the radicand; cursor placed inside (1/ ) so user types the index.
      this.tokens = [
        { type: 'constant', value: 'Ans' },
        { type: 'operator', value: '^' },
        { type: 'lparen' },
        { type: 'number',   value: '1' },
        { type: 'operator', value: '/' },
        { type: 'rparen' },
      ];
      this.result = null; this.justCalculated = false; this.cursorPos = 5;
      this._notify();
      return;
    }
    // Take the index (already typed before cursor), restructure as radicand^(1/index)
    // Cursor moves to 0 so the user types the radicand first.
    const indexTokens = this.tokens.splice(0, this.cursorPos);
    const afterTokens  = this.tokens.splice(0);
    this.tokens = [
      ...afterTokens,
      { type: 'operator', value: '^' },
      { type: 'lparen' },
      { type: 'number',   value: '1' },
      { type: 'operator', value: '/' },
      ...indexTokens,
      { type: 'rparen' },
    ];
    this.cursorPos = 0;
    this._notify();
  }

  _calculate() {
    if (this.error) { this.error = null; this._notify(); return; }
    if (!this.tokens.length) return;

    // Auto-close open parens
    const toks = [...this.tokens];
    const openCount = this._countOpenParens();
    for (let i = 0; i < openCount; i++) toks.push({ type: 'rparen' });

    try {
      const value  = Evaluator.evaluate(toks, this.angleMode, this.ans, this.memory);
      const result = Evaluator.formatResult(value);

      this.history.push({ tokens: JSON.parse(JSON.stringify(this.tokens)), result });
      if (this.history.length > 50) this.history.shift();
      this.historyIndex   = -1;
      this.ans            = result;
      this.result         = result;
      this.rawValue       = value;
      this.error          = null;
      this.openParenCount = 0;
      this.cursorPos      = this.tokens.length;
      this.justCalculated = true;
    } catch (e) {
      this.error    = (e instanceof CalcError) ? e.type : 'SYNTAX ERROR';
      this.result   = null;
      this.rawValue = null;
    }
    this._notify();
  }

  clear() {
    this.tokens         = [];
    this.result         = null;
    this.rawValue       = null;
    this.error          = null;
    this.openParenCount = 0;
    this.cursorPos      = 0;
    this.justCalculated = false;
    this.historyIndex   = -1;
    this._notify();
  }

  _delete() {
    if (this.error) { this.error = null; this._notify(); return; }
    if (this.justCalculated) { this.clear(); return; }
    if (this.cursorPos === 0) return;

    const prev = this.tokens[this.cursorPos - 1];

    if (prev.type === 'number' && prev.value.length > 1) {
      prev.value = prev.value.slice(0, -1);
    } else if (prev.type === 'lparen') {
      const prevPrev = this.tokens[this.cursorPos - 2];
      if (prevPrev && prevPrev.type === 'function') {
        this.tokens.splice(this.cursorPos - 2, 2);
        this.cursorPos -= 2;
      } else {
        this.tokens.splice(this.cursorPos - 1, 1);
        this.cursorPos--;
      }
    } else if (prev.type === 'function') {
      // Cursor is between function and its lparen — remove both together
      const nextTok = this.tokens[this.cursorPos];
      if (nextTok && nextTok.type === 'lparen') {
        this.tokens.splice(this.cursorPos - 1, 2);
      } else {
        this.tokens.splice(this.cursorPos - 1, 1);
      }
      this.cursorPos--;
    } else {
      this.tokens.splice(this.cursorPos - 1, 1);
      this.cursorPos--;
    }
    this._notify();
  }

  // ----- Mode / navigation -----

  _on() {
    this.isOff = false;
    this.clear();
  }

  _off() {
    this.isOff = true;
    this.tokens = [];
    this.result = null;
    this.error  = null;
    this._notify();
  }

  _toggleSecond() {
    this.secondActive = !this.secondActive;
    document.body.classList.toggle('second-active', this.secondActive);
    const btn = document.getElementById('secondBtn');
    if (btn) btn.classList.toggle('active', this.secondActive);
    this._notify();
  }

  _cycleAngleMode() {
    const modes = ['DEG', 'RAD', 'GRAD'];
    this.angleMode = modes[(modes.indexOf(this.angleMode) + 1) % 3];
    this._notify();
  }

  _navigateHistory(dir) {
    if (!this.history.length) return;

    if (dir === 'up') {
      if (this.historyIndex < this.history.length - 1) this.historyIndex++;
    } else {
      if (this.historyIndex > -1) this.historyIndex--;
    }

    if (this.historyIndex === -1) {
      this.tokens = [];
      this.result = null;
    } else {
      const entry   = this.history[this.history.length - 1 - this.historyIndex];
      this.tokens   = JSON.parse(JSON.stringify(entry.tokens));
      this.result   = entry.result;
    }

    this.openParenCount = this._countOpenParens();
    this.cursorPos      = this.tokens.length;
    this.justCalculated = false;
    this._notify();
  }

  // ----- Cursor -----

  _cursorLeft() {
    if (this.justCalculated) return;
    if (this.cursorPos > 0) { this.cursorPos--; this._notify(); }
  }

  _cursorRight() {
    if (this.justCalculated) return;
    if (this.cursorPos < this.tokens.length) { this.cursorPos++; this._notify(); }
  }

  _countOpenParens() {
    return this.tokens.reduce(
      (n, t) => t.type === 'lparen' ? n + 1 : t.type === 'rparen' ? n - 1 : n, 0
    );
  }

  // ----- New features -----

  _toggleFracMixed() {
    this.fracMixed = !this.fracMixed;
    this._notify();
  }

  _toPercent() {
    const val = this.rawValue !== null ? this.rawValue : parseFloat(this.result);
    if (isNaN(val) || val === null) return;
    const pct = val * 100;
    this.rawValue = pct;
    this.result   = Evaluator.formatResult(pct);
    this.justCalculated = true;
    this._notify();
  }

  _inputComma() {
    if (this.error) this.clear();
    this.tokens.splice(this.cursorPos, 0, { type: 'comma' });
    this.cursorPos++;
    this._notify();
  }

  // For two-arg functions where the preceding expression is the first argument (nPr, nCr).
  _inputBinaryFunc(name) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null; this.justCalculated = false; this.cursorPos = 1;
    }
    if (this.cursorPos === 0) {
      this._inputFunction(name);
      return;
    }
    const before = this.tokens.splice(0, this.cursorPos);
    const after  = this.tokens.splice(0);
    this.tokens = [
      { type: 'function', value: name },
      { type: 'lparen' },
      ...before,
      { type: 'comma' },
      ...after,
    ];
    this.cursorPos = 2 + before.length + 1;
    this._notify();
  }

  _openPrbMenu() {
    this.menuState = {
      type: 'prb',
      title: 'PRB',
      items: [
        { label: 'nPr',      action: () => this._inputBinaryFunc('nPr') },
        { label: 'nCr',      action: () => this._inputBinaryFunc('nCr') },
        { label: '!',        action: () => this._inputPostfix('factorial') },
        { label: 'randInt(', action: () => this._inputFunction('randint') },
      ],
      selected: 0,
    };
    this._notify();
  }

  _openStoMenu() {
    const vars = ['x', 'y', 'z', 't', 'a', 'b', 'c'];
    this.menuState = {
      type: 'sto',
      title: 'STO→',
      items: vars.map(v => ({
        label: v,
        action: () => {
          const val = this.rawValue !== null ? this.rawValue : parseFloat(this.result) || 0;
          this.memory[v] = val;
        },
      })),
      selected: 0,
    };
    this._notify();
  }

  _openRclMenu() {
    const vars = ['x', 'y', 'z', 't', 'a', 'b', 'c'];
    this.menuState = {
      type: 'rcl',
      title: 'RCL',
      items: vars.map(v => ({
        label: v,
        action: () => this._inputConstant(v),
      })),
      selected: 0,
    };
    this._notify();
  }

  _openAngleMenu() {
    this.menuState = {
      type: 'angle',
      title: 'ANGLE',
      items: [
        { label: '°',   action: () => {} },
        { label: "'",   action: () => {} },
        { label: '"',   action: () => {} },
        { label: 'DMS', action: () => { this.dmsMode = true; this._notify(); } },
        { label: 'r',   action: () => {} },
        { label: 'g',   action: () => {} },
      ],
      selected: 0,
    };
    this._notify();
  }

  _handleMenuKey(action, raw) {
    const menu = this.menuState;
    // Number key 1-N: select and execute
    if (!action && raw) {
      const idx = parseInt(raw) - 1;
      if (idx >= 0 && idx < menu.items.length) {
        this.menuState = null;
        menu.items[idx].action();
        this._notify();
        return;
      }
    }
    if (action === 'up')   { menu.selected = Math.max(0, menu.selected - 1); this._notify(); return; }
    if (action === 'down') { menu.selected = Math.min(menu.items.length - 1, menu.selected + 1); this._notify(); return; }
    if (action === 'calculate') {
      const item = menu.items[menu.selected];
      this.menuState = null;
      item.action();
      this._notify();
      return;
    }
    // Any other key: close menu, then process key
    this.menuState = null;
    this._notify();
    if (action !== 'clear') this.handleKey(action, raw);
  }

  // ----- Notification -----

  _notify() {
    if (this.displayManager) this.displayManager.update(this);
    if (this.secondScreen)   this.secondScreen.update();
  }
}

// ============================================================
// SECTION 4: DisplayManager
// ============================================================

class DisplayManager {
  constructor() {
    this.els = {
      indicators: document.getElementById('indicatorsDisplay'),
      previous:   document.getElementById('previousDisplay'),
      main:       document.getElementById('mainDisplay'),
    };
  }

  update(calc) {
    if (calc.isOff) {
      this.els.indicators.innerHTML = '';
      this.els.previous.textContent = '';
      this.els.main.textContent     = '';
      this.els.main.classList.remove('error');
      return;
    }
    this._renderIndicators(calc);
    this._renderExpression(calc);
    this._renderResult(calc);
  }

  _renderIndicators(calc) {
    const badges = [
      { label: 'DEG',  on: calc.angleMode === 'DEG' },
      { label: 'RAD',  on: calc.angleMode === 'RAD' },
      { label: 'GRAD', on: calc.angleMode === 'GRAD' },
      { label: '2nd',  on: calc.secondActive },
      { label: 'HYP',  on: calc.hypActive },
      { label: 'U n/d',on: !calc.fracMixed },
    ];
    this.els.indicators.innerHTML = badges
      .map(b => `<span class="indicator-badge${b.on ? '' : ' inactive'}">${b.label}</span>`)
      .join('');
  }

  _renderExpression(calc) {
    if (calc.menuState) {
      const m = calc.menuState;
      const html = `<span class="menu-title">${m.title}</span> ` +
        m.items.map((item, i) =>
          `<span class="menu-item${i === m.selected ? ' menu-selected' : ''}">${i + 1}:${item.label}</span>`
        ).join(' ');
      this.els.previous.innerHTML = html;
      return;
    }
    const showCursor = !calc.justCalculated && !calc.error && !calc.isOff;
    this.els.previous.innerHTML = this._tokensToStringHTML(calc.tokens, showCursor ? calc.cursorPos : -1);
  }

  _renderResult(calc) {
    const el = this.els.main;
    if (calc.error) {
      el.textContent = calc.error;
      el.classList.add('error');
      return;
    }
    el.classList.remove('error');
    if (calc.result !== null) {
      if (calc.dmsMode && calc.rawValue !== null) {
        el.textContent = Evaluator.toDMS(calc.rawValue);
        calc.dmsMode = false;
        return;
      }
      if (calc.fracDisplay && calc.rawValue !== null) {
        const frac = Evaluator.toFraction(calc.rawValue);
        if (frac && frac.d > 1) {
          if (!calc.fracMixed && frac.whole !== 0) {
            const impN = frac.whole * frac.d + frac.n;
            el.innerHTML = Evaluator.formatFractionHTML({ whole: 0, n: impN, d: frac.d, sign: frac.sign });
          } else {
            el.innerHTML = Evaluator.formatFractionHTML(frac);
          }
          return;
        }
      }
      el.textContent = calc.result;
      return;
    }
    const last = calc.tokens[calc.tokens.length - 1];
    el.textContent = (last && last.type === 'number') ? last.value
                   : calc.tokens.length ? ''
                   : '0';
  }

  // Like _tokensToString but outputs HTML, rendering frac/sqrt/cbrt/^ specially.
  // cursorIdx: token index where the blinking cursor should appear (-1 = no cursor).
  // state: shared mutable object { used: false } so cursor is emitted exactly once.
  _tokensToStringHTML(tokens, cursorIdx = -1, state = null) {
    const s   = state || { used: false };
    const e   = Evaluator._esc;
    const cur = () => { s.used = true; return '<span class="calc-cursor"></span>'; };
    const parts = [];
    let i = 0;

    const findMatchingRparen = (startIdx) => {
      let depth = 0;
      for (let j = startIdx; j < tokens.length; j++) {
        if (tokens[j].type === 'lparen') depth++;
        else if (tokens[j].type === 'rparen') { depth--; if (depth === 0) return j; }
      }
      return -1;
    };

    // Returns the last token index (inclusive) of the rendering group starting at startIdx.
    // A group is: a single number/constant, a function call func(...), a parenthesised expression,
    // or a unary-minus followed by one of those.
    const groupEndIdx = (startIdx) => {
      const gt = tokens[startIdx];
      if (!gt) return startIdx - 1;
      if (gt.type === 'number' || gt.type === 'constant') return startIdx;
      if (gt.type === 'unary-minus') {
        const r = groupEndIdx(startIdx + 1);
        return r >= startIdx + 1 ? r : startIdx;
      }
      if (gt.type === 'function') {
        const gn = tokens[startIdx + 1];
        if (gn && gn.type === 'lparen') {
          const close = findMatchingRparen(startIdx + 1);
          return close !== -1 ? close : tokens.length - 1;
        }
        return startIdx;
      }
      if (gt.type === 'lparen') {
        const close = findMatchingRparen(startIdx);
        return close !== -1 ? close : tokens.length - 1;
      }
      return startIdx;
    };

    // Returns cursorIdx adjusted for a sub-slice starting at offset, or -1 if outside.
    const innerCursor = (offset, len) => {
      const rel = cursorIdx - offset;
      return (rel >= 0 && rel <= len) ? rel : -1;
    };

    while (i < tokens.length) {
      if (!s.used && i === cursorIdx) parts.push(cur());
      const t  = tokens[i];
      const n1 = tokens[i + 1];
      const n2 = tokens[i + 2];

      // Stacked fraction: simple_val frac <group>
      if ((t.type === 'number' || t.type === 'constant') &&
          n1 && n1.type === 'operator' && n1.value === 'frac' &&
          n2) {
        const denEnd   = groupEndIdx(i + 2);
        const denSlice = tokens.slice(i + 2, denEnd + 1);
        const numHtml  = this._tokensToStringHTML([t], innerCursor(i, 1), s);
        const denHtml  = this._tokensToStringHTML(denSlice, innerCursor(i + 2, denSlice.length), s);
        const midCur   = (!s.used && cursorIdx === i + 1) ? cur() : '';
        parts.push(`<span class="frac-v"><span class="frac-n">${numHtml}</span>${midCur}<span class="frac-d">${denHtml}</span></span>`);
        i = denEnd + 1;
        continue;
      }

      // Lone frac operator
      if (t.type === 'operator' && t.value === 'frac') {
        parts.push('/');
        i++;
        continue;
      }

      // ^ → superscript
      if (t.type === 'operator' && t.value === '^') {
        if (n1 && n1.type === 'lparen') {
          const closeIdx = findMatchingRparen(i + 1);
          const endIdx   = closeIdx !== -1 ? closeIdx : tokens.length;
          parts.push(`<sup>${this._tokensToStringHTML(tokens.slice(i + 2, endIdx), innerCursor(i + 2, endIdx - (i + 2)), s)}</sup>`);
          i = endIdx + 1;
          continue;
        } else if (n1 && n1.type === 'unary-minus' && n2 && (n2.type === 'number' || n2.type === 'constant')) {
          const minCur = (!s.used && cursorIdx === i + 1) ? cur() : '';
          const numHtml = this._tokensToStringHTML([n2], innerCursor(i + 2, 1), s);
          parts.push(`<sup>${minCur}−${numHtml}</sup>`);
          i += 3;
          continue;
        } else if (n1 && (n1.type === 'number' || n1.type === 'constant')) {
          parts.push(`<sup>${this._tokensToStringHTML([n1], innerCursor(i + 1, 1), s)}</sup>`);
          i += 2;
          continue;
        } else if (!n1 && !s.used && cursorIdx === i + 1) {
          parts.push(`<sup>${cur()}</sup>`);
          i++;
          continue;
        }
        parts.push('^');
        i++;
        continue;
      }

      // sqrt / cbrt → radical with vinculum (extends to end if no closing paren yet)
      if (t.type === 'function' && (t.value === 'sqrt' || t.value === 'cbrt')) {
        const sym = t.value === 'sqrt' ? '√' : '∛';
        if (n1 && n1.type === 'lparen') {
          const closeIdx = findMatchingRparen(i + 1);
          const endIdx   = closeIdx !== -1 ? closeIdx : tokens.length;
          const inner    = this._tokensToStringHTML(tokens.slice(i + 2, endIdx), innerCursor(i + 2, endIdx - (i + 2)), s);
          parts.push(`${sym}<span class="radical-content">${inner || '&nbsp;'}</span>`);
          i = endIdx + 1;
          continue;
        }
        parts.push(sym);
        i++;
        continue;
      }

      // pow10: render argument as superscript  10²
      if (t.type === 'function' && t.value === 'pow10') {
        if (n1 && n1.type === 'lparen') {
          const closeIdx = findMatchingRparen(i + 1);
          const endIdx   = closeIdx !== -1 ? closeIdx : tokens.length;
          const inner    = this._tokensToStringHTML(tokens.slice(i + 2, endIdx), innerCursor(i + 2, endIdx - (i + 2)), s);
          parts.push(`10<sup>${inner || '&nbsp;'}</sup>`);
          i = endIdx + 1;
          continue;
        }
        parts.push('10^');
        i++;
        continue;
      }

      parts.push(e(this._tokenToText(t)));
      i++;
    }

    if (!s.used && cursorIdx >= tokens.length) parts.push(cur());
    return parts.join('');
  }

  _tokenToText(t) {
    switch (t.type) {
      case 'number':    return t.value;
      case 'operator':
        switch (t.value) {
          case '*':    return '×';
          case '/':    return '÷';
          case 'frac': return '/';
          default:     return t.value;
        }
      case 'function':
        switch (t.value) {
          case 'asin':  return 'sin⁻¹';
          case 'acos':  return 'cos⁻¹';
          case 'atan':  return 'tan⁻¹';
          case 'asinh': return 'sinh⁻¹';
          case 'acosh': return 'cosh⁻¹';
          case 'atanh': return 'tanh⁻¹';
          case 'exp':   return 'eˣ';
          case 'pow10': return '10^';
          case 'cbrt':  return '∛';
          case 'sqrt':  return '√';
          default:      return t.value;
        }
      case 'lparen':           return '(';
      case 'rparen':           return ')';
      case 'comma':            return ',';
      case 'constant':         return t.value;
      case 'unary-minus':      return '−';
      case 'postfix-function':
        switch (t.value) {
          case 'factorial': return '!';
          case 'percent':   return '%';
          default:          return t.value;
        }
      default: return '';
    }
  }

  _tokensToString(tokens) {
    return tokens.map(t => {
      switch (t.type) {
        case 'number':           return t.value;
        case 'operator':
          switch (t.value) {
            case '*':    return '×';
            case '/':    return '÷';
            case 'frac': return '/';
            default:     return t.value;
          }
        case 'function':
          switch (t.value) {
            case 'asin':  return 'sin⁻¹';
            case 'acos':  return 'cos⁻¹';
            case 'atan':  return 'tan⁻¹';
            case 'exp':   return 'eˣ';
            case 'pow10': return '10^';
            case 'cbrt':  return '∛';
            default:      return t.value;
          }
        case 'lparen':           return '(';
        case 'rparen':           return ')';
        case 'comma':            return ',';
        case 'constant':         return t.value;
        case 'unary-minus':      return '−';
        case 'postfix-function':
          switch (t.value) {
            case 'factorial': return '!';
            case 'percent':   return '%';
            default:          return t.value;
          }
        default: return '';
      }
    }).join('');
  }
}

// ============================================================
// SECTION 5: SecondScreen
// ============================================================

class SecondScreen {
  constructor() {
    this.panel   = document.getElementById('secondScreen');
    this.visible = false;
    this._initDrag();
    this._initToggle();
  }

  show()   { this.panel.classList.remove('hidden'); this.visible = true; this.update(); }
  hide()   { this.panel.classList.add('hidden');    this.visible = false; }
  toggle() { this.visible ? this.hide() : this.show(); }

  update() {
    if (!this.visible) return;
    document.getElementById('ssIndicators').innerHTML =
      document.getElementById('indicatorsDisplay').innerHTML;
    document.getElementById('ssExpression').innerHTML =
      document.getElementById('previousDisplay').innerHTML;
    document.getElementById('ssResult').innerHTML =
      document.getElementById('mainDisplay').innerHTML;
    document.getElementById('ssResult').className =
      'ss-result' + (document.getElementById('mainDisplay').classList.contains('error') ? ' error' : '');
  }

  _initDrag() {
    const header = this.panel.querySelector('.second-screen-header');
    const drag = { active: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

    const start = (cx, cy) => {
      drag.active   = true;
      drag.startX   = cx;
      drag.startY   = cy;
      drag.origLeft = this.panel.offsetLeft;
      drag.origTop  = this.panel.offsetTop;
    };
    const move = (cx, cy) => {
      if (!drag.active) return;
      this.panel.style.left = (drag.origLeft + cx - drag.startX) + 'px';
      this.panel.style.top  = (drag.origTop  + cy - drag.startY) + 'px';
    };
    const end = () => { drag.active = false; };

    header.addEventListener('mousedown',  e => start(e.clientX, e.clientY));
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('mouseup',   end);

    header.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    document.addEventListener('touchmove', e => {
      if (drag.active) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }
    }, { passive: false });
    document.addEventListener('touchend', end);
  }

  _initToggle() {
    document.getElementById('secondScreenToggle')
      .addEventListener('click', () => this.toggle());
    document.getElementById('secondScreenClose')
      .addEventListener('click', () => this.hide());
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 's') { e.preventDefault(); this.toggle(); }
    });
  }
}

// ============================================================
// SECTION 6: colorChanger
// ============================================================

function colorChanger(color) {
  if (color === 'blue') {
    document.body.removeAttribute('data-colorway');
  } else {
    document.body.dataset.colorway = color;
  }
}

// ============================================================
// SECTION 7: Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const calc = new Calculator();
  const dm   = new DisplayManager();
  const ss   = new SecondScreen();

  calc.displayManager = dm;
  calc.secondScreen   = ss;
  dm.update(calc);

  // Button clicks
  document.querySelector('.calculator-keys').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    calc.handleKey(btn.dataset.action, btn.textContent.trim());
  });

  // Keyboard support
  document.addEventListener('keydown', e => {
    if (/^\d$/.test(e.key)) { e.preventDefault(); calc.handleKey(undefined, e.key); return; }
    const map = {
      '+': 'addition', '-': 'subtraction', '*': 'multiplication', '/': 'division',
      '^': 'power', '(': 'open-paren', ')': 'close-paren', '.': 'decimal',
      'Enter': 'calculate', 'Backspace': 'delete', 'Escape': 'clear',
      'ArrowUp': 'up', 'ArrowDown': 'down',
    };
    const action = map[e.key];
    if (action) { e.preventDefault(); calc.handleKey(action, e.key); }
  });

  window.colorChanger = colorChanger;
});
