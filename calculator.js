// Calculator logic, kept free of DOM code so it can be tested with Node.
(function (root) {
  "use strict";

  // Higher binds tighter, so 2 + 3 × 4 = 14. Powers and roots group right
  // to left, so 2 ^ 3 ^ 2 = 2 ^ 9.
  const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, root: 3 };
  const RIGHT_ASSOCIATIVE = { "^": true, root: true };

  function createState() {
    return {
      display: "0",
      value: null, // exact number behind the display, when it was calculated
      label: null, // how the current number reads in the expression, e.g. "√9"
      values: [], // numbers waiting for their operator to be applied
      ops: [], // operators waiting to be applied, lowest precedence first
      chain: [], // expression typed so far, e.g. ["2", "+", "√9", "*"]
      waitingForOperand: false, // next digit starts a new number
      operatorPending: false, // last key was an operator; another one replaces it
      error: false,
      completed: null, // set by equals: { expression, result }
    };
  }

  function nthRoot(x, n) {
    if (n === 0) return NaN;
    if (x >= 0) return Math.pow(x, 1 / n);
    // Odd roots of negative numbers are real: the cube root of -8 is -2.
    return Number.isInteger(n) && n % 2 !== 0 ? -Math.pow(-x, 1 / n) : NaN;
  }

  function compute(a, b, operator) {
    switch (operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? NaN : a / b;
      case "^":
        return Math.pow(a, b);
      case "root":
        return nthRoot(a, b);
      default:
        return b;
    }
  }

  function format(value) {
    if (!Number.isFinite(value)) return "Error";
    // Round away floating point noise such as 0.1 + 0.2.
    const rounded = parseFloat(value.toPrecision(12));
    return String(rounded);
  }

  function currentValue(state) {
    return state.value !== null ? state.value : parseFloat(state.display);
  }

  function currentLabel(state) {
    return state.label !== null ? state.label : String(parseFloat(state.display));
  }

  // Show a calculated number; the next digit typed starts a new number.
  function setResult(state, value, label) {
    if (!Number.isFinite(value)) return errorState();
    return {
      ...state,
      display: format(value),
      value,
      label,
      waitingForOperand: true,
      operatorPending: false,
    };
  }

  function inputDigit(state, digit) {
    if (state.error) state = createState();
    if (state.waitingForOperand) {
      return {
        ...state,
        display: digit,
        value: null,
        label: null,
        waitingForOperand: false,
        operatorPending: false,
      };
    }
    if (state.display.replace(/[-.]/g, "").length >= 15) return state;
    const display = state.display === "0" ? digit : state.display + digit;
    return { ...state, display };
  }

  function inputDecimal(state) {
    if (state.error) state = createState();
    if (state.waitingForOperand) {
      return {
        ...state,
        display: "0.",
        value: null,
        label: null,
        waitingForOperand: false,
        operatorPending: false,
      };
    }
    if (state.display.includes(".")) return state;
    return { ...state, display: state.display + "." };
  }

  // Apply every waiting operator that binds at least as tightly as the new
  // one, then queue the new one.
  function pushOperator(values, ops, operator) {
    values = [...values];
    ops = [...ops];
    while (ops.length) {
      const top = ops[ops.length - 1];
      const tighter = PRECEDENCE[top] > PRECEDENCE[operator];
      const same = PRECEDENCE[top] === PRECEDENCE[operator];
      if (!tighter && !(same && !RIGHT_ASSOCIATIVE[operator])) break;
      const b = values.pop();
      const a = values.pop();
      values.push(compute(a, b, ops.pop()));
    }
    ops.push(operator);
    return { values, ops };
  }

  function setOperator(state, operator) {
    if (state.error) return state;

    // Pressing another operator straight away replaces the last one.
    const replacing = state.operatorPending;
    const { values, ops } = replacing
      ? pushOperator(state.values, state.ops.slice(0, -1), operator)
      : pushOperator(
          [...state.values, currentValue(state)],
          state.ops,
          operator
        );
    const chain = replacing
      ? [...state.chain.slice(0, -1), operator]
      : [...state.chain, currentLabel(state), operator];

    const top = values[values.length - 1];
    if (!Number.isFinite(top)) return errorState();
    return {
      ...state,
      display: format(top),
      value: top,
      label: null,
      values,
      ops,
      chain,
      waitingForOperand: true,
      operatorPending: true,
      completed: null,
    };
  }

  function equals(state) {
    if (state.error) return state;

    if (!state.ops.length) {
      // A lone function such as √9 is still worth recording, once.
      if (state.label === null) return { ...state, completed: null };
      return {
        ...state,
        label: null,
        completed: { expression: state.label, result: state.display },
      };
    }

    const values = [...state.values, currentValue(state)];
    const ops = [...state.ops];
    while (ops.length) {
      const b = values.pop();
      const a = values.pop();
      values.push(compute(a, b, ops.pop()));
    }
    const result = values[0];
    if (!Number.isFinite(result)) return errorState();
    const display = format(result);
    return {
      ...createState(),
      display,
      value: result,
      waitingForOperand: true,
      completed: {
        expression: [...state.chain, currentLabel(state)].join(" "),
        result: display,
      },
    };
  }

  // Brackets around a label unless it is already a single plain value.
  function group(label) {
    return /^([\d.]+(e[+-]\d+)?|π|e)$/.test(label) ? label : `(${label})`;
  }

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

  const degreeSign = (angle) => (angle === "deg" ? "°" : "");

  // Each function: how to calculate it and how it reads in the history.
  const FUNCTIONS = {
    square: { calc: (x) => x * x, label: (l) => `${group(l)}²` },
    sqrt: { calc: Math.sqrt, label: (l) => `√${group(l)}` },
    reciprocal: { calc: (x) => 1 / x, label: (l) => `1/${group(l)}` },
    factorial: { calc: factorial, label: (l) => `${group(l)}!` },
    ln: { calc: Math.log, label: (l) => `ln(${l})` },
    exp: { calc: Math.exp, label: (l) => `e^${group(l)}` },
    log: { calc: Math.log10, label: (l) => `log(${l})` },
    pow10: { calc: (x) => Math.pow(10, x), label: (l) => `10^${group(l)}` },
  };
  for (const name of ["sin", "cos", "tan"]) {
    FUNCTIONS[name] = {
      calc: (x, angle) => trig(name, x, angle),
      label: (l, angle) => `${name}(${l}${degreeSign(angle)})`,
    };
    FUNCTIONS["a" + name] = {
      calc: (x, angle) => inverseTrig("a" + name, x, angle),
      label: (l) => `${name}⁻¹(${l})`,
    };
  }

  // Apply a function such as "sqrt" or "sin" to the number on screen.
  // angle is "deg" or "rad" and only matters for the trig functions.
  function applyFunction(state, name, angle = "deg") {
    if (state.error) return state;
    const fn = FUNCTIONS[name];
    const value = fn.calc(currentValue(state), angle);
    return setResult(state, value, fn.label(currentLabel(state), angle));
  }

  const CONSTANTS = { pi: [Math.PI, "π"], e: [Math.E, "e"] };

  function insertConstant(state, name) {
    if (state.error) state = createState();
    const [value, label] = CONSTANTS[name];
    return setResult(state, value, label);
  }

  function toggleSign(state) {
    if (state.error || state.operatorPending || state.display === "0") {
      return state;
    }
    const display = state.display.startsWith("-")
      ? state.display.slice(1)
      : "-" + state.display;
    return {
      ...state,
      display,
      value: state.value !== null ? -state.value : null,
      label: state.label !== null ? `-${group(state.label)}` : null,
    };
  }

  function percent(state) {
    if (state.error || state.operatorPending) return state;
    return setResult(state, currentValue(state) / 100, null);
  }

  function backspace(state) {
    if (state.error) return createState();
    if (state.waitingForOperand) return state;
    let display = state.display.slice(0, -1);
    if (display === "" || display === "-") display = "0";
    return { ...state, display };
  }

  // Start a new calculation from a value, e.g. a result picked from history.
  function recall(value) {
    return { ...createState(), display: value, waitingForOperand: true };
  }

  // Newest first, capped at HISTORY_LIMIT entries.
  const HISTORY_LIMIT = 10;
  function addToHistory(history, entry) {
    return [entry, ...history].slice(0, HISTORY_LIMIT);
  }

  function errorState() {
    return { ...createState(), display: "Error", error: true };
  }

  const Calculator = {
    createState,
    inputDigit,
    inputDecimal,
    setOperator,
    equals,
    applyFunction,
    insertConstant,
    toggleSign,
    percent,
    backspace,
    recall,
    addToHistory,
    HISTORY_LIMIT,
    clear: createState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calculator;
  } else {
    root.Calculator = Calculator;
  }
})(typeof window !== "undefined" ? window : globalThis);
