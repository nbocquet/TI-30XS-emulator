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
  static TWO_ARG_FUNCS = new Set(['nthroot', 'nPr', 'nCr']);

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

  static _evalRPN(rpn, mode, ans) {
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
          default:    throw new CalcError('SYNTAX ERROR');
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

  static evaluate(tokens, angleMode, ansValue) {
    if (!tokens || !tokens.length) throw new CalcError('SYNTAX ERROR');
    const pre = Evaluator._preprocess(tokens);
    const rpn = Evaluator._toRPN(pre);
    const result = Evaluator._evalRPN(rpn, angleMode, ansValue);
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
  sin:  'asin',
  cos:  'acos',
  tan:  'atan',
  ln:   'exp',
  log:  'pow10',
  sqrt: 'cbrt',
  'n/d': 'F↔D',
};

class Calculator {
  constructor() {
    this.tokens         = [];
    this.result         = null;
    this.error          = null;
    this.ans            = '0';
    this.angleMode      = 'DEG';
    this.secondActive   = false;
    this.justCalculated = false;
    this.openParenCount = 0;
    this.history        = [];
    this.historyIndex   = -1;
    this.memory         = { x: 0, y: 0, z: 0, t: 0, a: 0, b: 0, c: 0 };
    this.isOff          = false;
    this.rawValue       = null;
    this.fracDisplay    = true;
    this.displayManager = null;
    this.secondScreen   = null;
  }

  // ----- Main dispatch -----

  handleKey(action, raw) {
    if (this.isOff && action !== 'on') return;

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

    this._dispatch(effective, raw);
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
      case 'probability':      this._inputPostfix('factorial');     break;
      case 'F↔D':             this._toggleFracDisplay();           break;
      default: break;
    }
  }

  // ----- Input methods -----

  _inputDigit(d) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [];
      this.result = null;
      this.justCalculated = false;
    }

    const last = this.tokens[this.tokens.length - 1];

    // Absorb a preceding unary-minus into a negative number literal
    if (last && last.type === 'unary-minus') {
      this.tokens.pop();
      this.tokens.push({ type: 'number', value: '-' + d });
    } else if (last && last.type === 'number') {
      if (last.value === '0') last.value = d;
      else last.value += d;
    } else {
      this.tokens.push({ type: 'number', value: d });
    }
    this._notify();
  }

  _inputOperator(op) {
    if (this.error) { this.error = null; this._notify(); return; }

    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
    }

    if (!this.tokens.length) {
      if (op === '-') {
        this.tokens.push({ type: 'unary-minus' });
        this._notify();
      }
      return;
    }

    const last = this.tokens[this.tokens.length - 1];
    // Replace trailing operator
    if (last.type === 'operator') {
      last.value = op;
      this._notify();
      return;
    }

    this.tokens.push({ type: 'operator', value: op });
    this._notify();
  }

  _inputFunction(name) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [];
      this.result = null;
      this.justCalculated = false;
    }
    this.tokens.push({ type: 'function', value: name });
    this.tokens.push({ type: 'lparen' });
    this.openParenCount++;
    this._notify();
  }

  _inputConstant(name) {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [];
      this.result = null;
      this.justCalculated = false;
    }
    this.tokens.push({ type: 'constant', value: name });
    this._notify();
  }

  _inputParen(which) {
    if (this.error) this.clear();
    if (which === '(') {
      if (this.justCalculated) {
        this.tokens = [];
        this.result = null;
        this.justCalculated = false;
      }
      this.tokens.push({ type: 'lparen' });
      this.openParenCount++;
    } else {
      if (this.openParenCount <= 0) return;
      this.tokens.push({ type: 'rparen' });
      this.openParenCount--;
    }
    this._notify();
  }

  _inputDecimal() {
    if (this.error) this.clear();
    if (this.justCalculated) {
      this.tokens = [{ type: 'number', value: '0.' }];
      this.result = null;
      this.justCalculated = false;
      this._notify();
      return;
    }
    const last = this.tokens[this.tokens.length - 1];
    if (last && last.type === 'number') {
      if (!last.value.includes('.')) last.value += '.';
    } else {
      this.tokens.push({ type: 'number', value: '0.' });
    }
    this._notify();
  }

  _inputNegative() {
    if (this.error) this.clear();

    if (this.justCalculated) {
      this.tokens = [{ type: 'unary-minus' }, { type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
      this._notify();
      return;
    }

    const last = this.tokens[this.tokens.length - 1];
    if (last && last.type === 'number') {
      last.value = last.value.startsWith('-') ? last.value.slice(1) : '-' + last.value;
      this._notify();
      return;
    }
    this.tokens.push({ type: 'unary-minus' });
    this._notify();
  }

  _inputSquared() {
    if (!this.tokens.length && !this.justCalculated) return;
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
    }
    this.tokens.push({ type: 'operator', value: '^' });
    this.tokens.push({ type: 'number', value: '2' });
    this._notify();
  }

  _inputInverse() {
    if (!this.tokens.length && !this.justCalculated) return;
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
    }
    this.tokens.push({ type: 'operator', value: '^' });
    this.tokens.push({ type: 'number', value: '-1' });
    this._notify();
  }

  _inputExponent() {
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
    }
    this.tokens.push({ type: 'operator', value: '*' });
    this.tokens.push({ type: 'number', value: '10' });
    this.tokens.push({ type: 'operator', value: '^' });
    this._notify();
  }

  _inputPostfix(name) {
    if (this.justCalculated) {
      this.tokens = [{ type: 'constant', value: 'Ans' }];
      this.result = null;
      this.justCalculated = false;
    }
    const last = this.tokens[this.tokens.length - 1];
    if (!last) return;
    const validPrev = last.type === 'number' || last.type === 'rparen' || last.type === 'constant';
    if (!validPrev) return;
    this.tokens.push({ type: 'postfix-function', value: name });
    this._notify();
  }

  // ----- Calculator operations -----

  _toggleFracDisplay() {
    this.fracDisplay = !this.fracDisplay;
    this._notify();
  }

  _calculate() {
    if (this.error) { this.error = null; this._notify(); return; }
    if (!this.tokens.length) return;

    // Auto-close open parens
    const toks = [...this.tokens];
    for (let i = 0; i < this.openParenCount; i++) toks.push({ type: 'rparen' });

    try {
      const value  = Evaluator.evaluate(toks, this.angleMode, this.ans);
      const result = Evaluator.formatResult(value);

      this.history.push({ tokens: JSON.parse(JSON.stringify(this.tokens)), result });
      if (this.history.length > 50) this.history.shift();
      this.historyIndex   = -1;
      this.ans            = result;
      this.result         = result;
      this.rawValue       = value;
      this.error          = null;
      this.openParenCount = 0;
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
    this.justCalculated = false;
    this.historyIndex   = -1;
    this._notify();
  }

  _delete() {
    if (this.error) { this.error = null; this._notify(); return; }
    if (this.justCalculated) { this.clear(); return; }
    if (!this.tokens.length) return;

    const last = this.tokens[this.tokens.length - 1];

    if (last.type === 'number' && last.value.length > 1) {
      last.value = last.value.slice(0, -1);
    } else {
      if (last.type === 'lparen') {
        this.openParenCount--;
        this.tokens.pop();
        // Also remove a preceding function token
        const prev = this.tokens[this.tokens.length - 1];
        if (prev && prev.type === 'function') this.tokens.pop();
      } else if (last.type === 'rparen') {
        this.openParenCount++;
        this.tokens.pop();
      } else {
        this.tokens.pop();
      }
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

    this.openParenCount = this.tokens.filter(t => t.type === 'lparen').length
                        - this.tokens.filter(t => t.type === 'rparen').length;
    this.justCalculated = false;
    this._notify();
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
    ];
    this.els.indicators.innerHTML = badges
      .map(b => `<span class="indicator-badge${b.on ? '' : ' inactive'}">${b.label}</span>`)
      .join('');
  }

  _renderExpression(calc) {
    this.els.previous.innerHTML = this._tokensToStringHTML(calc.tokens);
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
      if (calc.fracDisplay && calc.rawValue !== null) {
        const frac = Evaluator.toFraction(calc.rawValue);
        if (frac && frac.d > 1) {
          el.innerHTML = Evaluator.formatFractionHTML(frac);
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

  // Like _tokensToString but outputs HTML, rendering frac tokens as stacked fractions
  _tokensToStringHTML(tokens) {
    const e     = Evaluator._esc;
    const parts = [];
    let i = 0;
    while (i < tokens.length) {
      const t   = tokens[i];
      const op  = tokens[i + 1];
      const den = tokens[i + 2];
      // Simple case: number/constant  frac  number/constant → stacked
      const simpleNum = t.type === 'number' || t.type === 'constant';
      const simpleDen = den && (den.type === 'number' || den.type === 'constant');
      if (simpleNum && op && op.type === 'operator' && op.value === 'frac' && simpleDen) {
        parts.push(
          `<span class="frac-v"><span class="frac-n">${e(t.value)}</span>` +
          `<span class="frac-d">${e(den.value)}</span></span>`
        );
        i += 3;
        continue;
      }
      // Lone frac-op (complex expression around it) — show as plain /
      if (t.type === 'operator' && t.value === 'frac') {
        parts.push('/');
        i++;
        continue;
      }
      parts.push(this._tokenToText(t));
      i++;
    }
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
          case 'asin':  return 'sin⁻¹(';
          case 'acos':  return 'cos⁻¹(';
          case 'atan':  return 'tan⁻¹(';
          case 'exp':   return 'eˣ(';
          case 'pow10': return '10^(';
          case 'cbrt':  return '∛(';
          default:      return t.value + '(';
        }
      case 'lparen':           return '(';
      case 'rparen':           return ')';
      case 'comma':            return ',';
      case 'constant':         return t.value;
      case 'unary-minus':      return '−';
      case 'postfix-function':
        return t.value === 'factorial' ? '!' : t.value;
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
            case 'asin':  return 'sin⁻¹(';
            case 'acos':  return 'cos⁻¹(';
            case 'atan':  return 'tan⁻¹(';
            case 'exp':   return 'eˣ(';
            case 'pow10': return '10^(';
            case 'cbrt':  return '∛(';
            default:      return t.value + '(';
          }
        case 'lparen':           return '(';
        case 'rparen':           return ')';
        case 'comma':            return ',';
        case 'constant':         return t.value;
        case 'unary-minus':      return '−';
        case 'postfix-function':
          switch (t.value) {
            case 'factorial': return '!';
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

  show()   { this.panel.classList.remove('hidden'); this.visible = true;  }
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
