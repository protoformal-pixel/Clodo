// Calculator logic, kept free of DOM code so it can be tested with Node.
//
// What you type is kept as a list of tokens, e.g.
//   ["2", "*", "(", "3", "+", "4", ")", "²"]
// and "=" parses and evaluates the whole list, like a Casio in natural
// input mode. Keeping tokens rather than text means ⌫ removes "sin(" in one
// go, and the parse tree can later be reused for graphs and integrals.
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // Maths helpers

  const DEGREES = Math.PI / 180;

  // sin, cos and tan at exact multiples of 90° are answered from this table,
  // because floating point gives sin(180°) = 1.2e-16 rather than 0, and a
  // huge number rather than an error for tan(90°).
  const QUARTER_TURNS = {
    sin: [0, 1, 0, -1],
    cos: [1, 0, -1, 0],
    tan: [0, NaN, 0, NaN],
  };

  function trig(name, x, angle) {
    if (angle === "deg" && Number.isInteger(x / 90)) {
      return QUARTER_TURNS[name][(((x / 90) % 4) + 4) % 4];
    }
    const result = Math[name](angle === "deg" ? x * DEGREES : x);
    // Same noise in radians, e.g. sin(π); tiny inputs are left alone.
    return Math.abs(result) < 1e-12 && Math.abs(x) > 1e-6 ? 0 : result;
  }

  function inverseTrig(name, x, angle) {
    const result = Math[name](x);
    return angle === "deg" ? result / DEGREES : result;
  }

  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  function nthRoot(x, n) {
    if (n === 0) return NaN;
    if (x >= 0) return Math.pow(x, 1 / n);
    // Odd roots of negative numbers are real: the cube root of -8 is -2.
    return Number.isInteger(n) && n % 2 !== 0 ? -Math.pow(-x, 1 / n) : NaN;
  }

  function format(value) {
    // Round away floating point noise such as 0.1 + 0.2.
    const rounded = parseFloat(value.toPrecision(12));
    return String(Object.is(rounded, -0) ? 0 : rounded);
  }

  // ---------------------------------------------------------------------
  // Tokens

  // Functions open a bracket as part of the token, as on a Casio: "sin(".
  const FUNCTIONS = {
    "sin(": (x, angle) => trig("sin", x, angle),
    "cos(": (x, angle) => trig("cos", x, angle),
    "tan(": (x, angle) => trig("tan", x, angle),
    "sin⁻¹(": (x, angle) => inverseTrig("asin", x, angle),
    "cos⁻¹(": (x, angle) => inverseTrig("acos", x, angle),
    "tan⁻¹(": (x, angle) => inverseTrig("atan", x, angle),
    "ln(": Math.log,
    "log(": Math.log10,
    "√(": Math.sqrt,
    "e^(": Math.exp,
    "10^(": (x) => Math.pow(10, x),
    "Abs(": Math.abs,
  };

  // Written after the number they act on: 3², 5!, 4⁻¹, 50%.
  const POSTFIX = {
    "²": (x) => x * x,
    "⁻¹": (x) => 1 / x,
    "!": factorial,
    "%": (x) => x / 100,
  };

  const CONSTANTS = { π: Math.PI, e: Math.E };

  // Memory variables, typed as tokens like any number: 2A+1.
  const VARIABLES = ["A", "B", "C", "D", "E", "F"];

  function emptyMemory() {
    return Object.fromEntries(VARIABLES.map((name) => [name, 0]));
  }

  // "root": a ʸ√ b is the b-th root of a, so 27 ʸ√ 3 = 3.
  const BINARY = {
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    "^": Math.pow,
    root: nthRoot,
  };

  // How tokens are shown. "neg" is the (−) key: always a minus sign in front
  // of a number, never "subtract".
  const SHOWN = { "*": "×", "/": "÷", "-": "−", neg: "−", root: "ʸ√" };

  function tokenText(token) {
    return SHOWN[token] ?? token;
  }

  // Pressed right after a result, these carry on from it: "+" gives "Ans+".
  const CONTINUES = new Set([
    "+", "-", "*", "/", "^", "root", ...Object.keys(POSTFIX),
  ]);

  const isDigit = (t) => /^[0-9.]$/.test(t);

  // ---------------------------------------------------------------------
  // Parsing: tokens -> tree
  //
  //   sum      = product (("+" | "-") product)*
  //   product  = implicit (("×" | "÷") implicit)*
  //   implicit = unary power*        2π, 3(4+1): binds tighter than × and ÷,
  //                                  as on a Casio, so 1÷2π = 1÷(2π)
  //   unary    = ("-" | "neg" | "+") unary | power
  //   power    = postfix (("^" | "ʸ√") unary)?        right to left: 2^3^2
  //   postfix  = primary ("²" | "!" | "⁻¹" | "%")*
  //   primary  = number | π | e | Ans | A–F | x | "(" sum ")" | function sum ")"
  //
  // Missing closing brackets at the very end are added, as on a Casio.

  function syntaxError() {
    return { calcError: "Syntax Error" };
  }

  function mathError() {
    return { calcError: "Math Error" };
  }

  // Join digit tokens into numbers: "1" "." "5" -> 1.5.
  function lex(tokens) {
    const items = [];
    for (let i = 0; i < tokens.length; i++) {
      if (!isDigit(tokens[i])) {
        items.push(tokens[i]);
        continue;
      }
      let text = "";
      while (i < tokens.length && isDigit(tokens[i])) text += tokens[i++];
      i--;
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw syntaxError();
      items.push({ number: parseFloat(text) });
    }
    return items;
  }

  function parse(tokens) {
    const items = lex(tokens);
    let pos = 0;
    const peek = () => items[pos];
    const atEnd = () => pos >= items.length;

    const startsFactor = (item) =>
      item !== undefined &&
      (typeof item === "object" ||
        item in CONSTANTS ||
        item in FUNCTIONS ||
        item === "Ans" ||
        VARIABLES.includes(item) ||
        item === "x" ||
        item === "(");

    function closeBracket() {
      if (peek() === ")") pos++;
      else if (!atEnd()) throw syntaxError();
    }

    function primary() {
      const item = peek();
      if (item === undefined) throw syntaxError();
      pos++;
      if (typeof item === "object") return { type: "num", value: item.number };
      if (item in CONSTANTS) return { type: "num", value: CONSTANTS[item] };
      if (item === "Ans") return { type: "ans" };
      if (VARIABLES.includes(item)) return { type: "var", name: item };
      if (item === "x") return { type: "x" };
      if (item === "(") {
        const inner = sum();
        closeBracket();
        return inner;
      }
      if (item in FUNCTIONS) {
        const arg = sum();
        closeBracket();
        return { type: "fn", name: item, arg };
      }
      throw syntaxError();
    }

    function postfix() {
      let node = primary();
      while (peek() in POSTFIX) node = { type: "post", op: items[pos++], arg: node };
      return node;
    }

    function power() {
      const base = postfix();
      if (peek() === "^" || peek() === "root") {
        const op = items[pos++];
        return { type: "bin", op, left: base, right: unary() };
      }
      return base;
    }

    function unary() {
      const item = peek();
      if (item === "-" || item === "neg") {
        pos++;
        return { type: "neg", arg: unary() };
      }
      if (item === "+") {
        pos++;
        return unary();
      }
      return power();
    }

    function implicit() {
      let node = unary();
      while (startsFactor(peek())) {
        node = { type: "bin", op: "*", left: node, right: power() };
      }
      return node;
    }

    function product() {
      let node = implicit();
      while (peek() === "*" || peek() === "/") {
        const op = items[pos++];
        node = { type: "bin", op, left: node, right: implicit() };
      }
      return node;
    }

    function sum() {
      let node = product();
      while (peek() === "+" || peek() === "-") {
        const op = items[pos++];
        node = { type: "bin", op, left: node, right: product() };
      }
      return node;
    }

    if (atEnd()) throw syntaxError();
    const tree = sum();
    if (!atEnd()) throw syntaxError(); // e.g. a stray ")"
    return tree;
  }

  // ---------------------------------------------------------------------
  // Evaluating: tree -> number
  //
  // env: { angle: "deg" | "rad", ans: number, memory: { A: number, … }, x: number }

  function evaluate(node, env) {
    let value;
    switch (node.type) {
      case "num":
        return node.value;
      case "ans":
        return env.ans;
      case "var":
        return env.memory?.[node.name] ?? 0;
      case "x":
        return env.x;
      case "neg":
        return -evaluate(node.arg, env);
      case "post":
        value = POSTFIX[node.op](evaluate(node.arg, env));
        break;
      case "fn":
        value = FUNCTIONS[node.name](evaluate(node.arg, env), env.angle);
        break;
      case "bin":
        value = BINARY[node.op](evaluate(node.left, env), evaluate(node.right, env));
        break;
    }
    // Division by zero, √(−1), log(0), tan(90°)… stop here.
    if (!Number.isFinite(value)) throw mathError();
    return value;
  }

  function calculate(tokens, env) {
    return evaluate(parse(tokens), env);
  }

  // ---------------------------------------------------------------------
  // Calculator state
  //
  // tokens: what has been typed. cursor: where the next token goes (an
  // index into tokens), or null for the end. result: the answer shown after
  // "=", or null while typing. error: "Syntax Error" / "Math Error" after a
  // failed "=", cleared by the next edit. ans: the last answer. memory: the
  // values stored in A–F.

  function createState(ans = 0, memory = emptyMemory()) {
    return {
      tokens: [],
      cursor: null,
      result: null,
      resultExpression: null,
      error: null,
      ans,
      memory: { ...emptyMemory(), ...memory },
      completed: null, // set by equals: { expression, result } for history
    };
  }

  // Readable text for tokens; Ans is written out as its value.
  function toText(tokens, ans) {
    return tokens
      .map((t) => {
        if (t !== "Ans" || ans === undefined) return tokenText(t);
        const text = format(ans).replace("-", "−");
        return ans < 0 ? `(${text})` : text;
      })
      .join("");
  }

  // Back to editing the expression after a result or an error.
  function editing(state) {
    return { ...state, result: null, error: null, completed: null };
  }

  function insert(state, token) {
    let { tokens, cursor } = state;
    if (state.result !== null) {
      // After a result, operators carry on from it and anything else starts
      // a new calculation.
      tokens = CONTINUES.has(token) ? ["Ans"] : [];
      cursor = null;
    }
    const at = cursor === null ? tokens.length : cursor;
    return {
      ...editing(state),
      tokens: [...tokens.slice(0, at), token, ...tokens.slice(at)],
      cursor: cursor === null ? null : at + 1,
    };
  }

  // Insert a number given as text, e.g. a result picked from history.
  function insertNumber(state, text) {
    if (state.result !== null) state = { ...editing(state), tokens: [], cursor: null };
    let [mantissa, exponent] = text.split("e");
    const tokens = [];
    if (mantissa.startsWith("-")) {
      tokens.push("neg");
      mantissa = mantissa.slice(1);
    }
    tokens.push(...mantissa);
    if (exponent) {
      // 1.2e+21 becomes (1.2×10^(21)) so it stays one number.
      tokens.unshift("(");
      tokens.push("*", "10^(");
      if (exponent.startsWith("-")) tokens.push("neg");
      tokens.push(...exponent.replace(/^[-+]/, ""), ")", ")");
    }
    return tokens.reduce(insert, state);
  }

  // Delete the token before the cursor. After a result, ⌫ first goes back
  // to the expression so it can be fixed.
  function backspace(state) {
    if (state.result !== null) return editing(state);
    const at = state.cursor === null ? state.tokens.length : state.cursor;
    if (at === 0) return editing(state);
    return {
      ...editing(state),
      tokens: [...state.tokens.slice(0, at - 1), ...state.tokens.slice(at)],
      cursor: state.cursor === null ? null : at - 1,
    };
  }

  // AC clears the expression; Ans and memory stay.
  function clear(state) {
    return createState(state.ans, state.memory);
  }

  // Put the cursor before token number index (the end is null).
  function setCursor(state, index) {
    const length = state.tokens.length;
    const at = Math.min(Math.max(index, 0), length);
    return { ...editing(state), cursor: at === length ? null : at };
  }

  // ← and →. After a result they go back to the expression, cursor at the end.
  function moveCursor(state, delta) {
    if (state.result !== null) return { ...editing(state), cursor: null };
    const at = state.cursor === null ? state.tokens.length : state.cursor;
    return setCursor(state, at + delta);
  }

  function equals(state, angle = "deg") {
    if (state.result !== null || state.tokens.length === 0) {
      return { ...state, completed: null };
    }
    try {
      const value = calculate(state.tokens, env(state, angle));
      const result = format(value);
      const expression = toText(state.tokens, state.ans);
      return {
        ...state,
        cursor: null,
        result,
        resultExpression: expression,
        error: null,
        ans: value,
        completed: { expression, result },
      };
    } catch (e) {
      if (!e.calcError) throw e;
      return { ...state, error: e.calcError, completed: null };
    }
  }

  // The answer so far while typing, or null if it is not ready or would
  // only repeat what is on screen.
  function preview(state, angle = "deg") {
    if (state.result !== null || state.error || !state.tokens.length) return null;
    if (state.tokens.every(isDigit)) return null;
    try {
      return format(calculate(state.tokens, env(state, angle)));
    } catch {
      return null;
    }
  }

  function env(state, angle) {
    return { angle, ans: state.ans, memory: state.memory };
  }

  // STO then a letter: work out the expression (or take the answer on
  // screen, or Ans if nothing is typed) and keep it in that letter.
  function store(state, name, angle = "deg") {
    if (!VARIABLES.includes(name)) return state;
    let done;
    if (state.result !== null) {
      done = { ...state, completed: null }; // already in history
    } else {
      const tokens = state.tokens.length ? state.tokens : ["Ans"];
      done = equals({ ...state, tokens, cursor: null }, angle);
      if (done.error) return done;
    }
    const arrow = `→${name}`;
    return {
      ...done,
      memory: { ...done.memory, [name]: done.ans },
      resultExpression: done.resultExpression + arrow,
      completed: done.completed && {
        ...done.completed,
        expression: done.completed.expression + arrow,
      },
    };
  }

  function clearMemory(state) {
    return { ...state, memory: emptyMemory() };
  }

  // Newest first, capped at HISTORY_LIMIT entries.
  const HISTORY_LIMIT = 10;
  function addToHistory(history, entry) {
    return [entry, ...history].slice(0, HISTORY_LIMIT);
  }

  const Calculator = {
    createState,
    insert,
    insertNumber,
    backspace,
    clear,
    setCursor,
    moveCursor,
    equals,
    preview,
    store,
    clearMemory,
    VARIABLES,
    tokenText,
    toText,
    parse,
    evaluate,
    calculate,
    format,
    addToHistory,
    HISTORY_LIMIT,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calculator;
  } else {
    root.Calculator = Calculator;
  }
})(typeof window !== "undefined" ? window : globalThis);
