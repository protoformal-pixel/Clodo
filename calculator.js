// Calculator logic, kept free of DOM code so it can be tested with Node.
(function (root) {
  "use strict";

  function createState() {
    return {
      display: "0",
      stored: null, // left-hand operand
      operator: null, // pending operator: + - * /
      waitingForOperand: false, // next digit starts a new number
      error: false,
    };
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

  function inputDigit(state, digit) {
    if (state.error) state = createState();
    if (state.waitingForOperand) {
      return { ...state, display: digit, waitingForOperand: false };
    }
    if (state.display.replace(/[-.]/g, "").length >= 15) return state;
    const display = state.display === "0" ? digit : state.display + digit;
    return { ...state, display };
  }

  function inputDecimal(state) {
    if (state.error) state = createState();
    if (state.waitingForOperand) {
      return { ...state, display: "0.", waitingForOperand: false };
    }
    if (state.display.includes(".")) return state;
    return { ...state, display: state.display + "." };
  }

  function setOperator(state, operator) {
    if (state.error) return state;
    const current = parseFloat(state.display);

    // Changing operator before typing the next number just swaps it.
    if (state.operator && state.waitingForOperand) {
      return { ...state, operator };
    }

    if (state.stored === null || state.operator === null) {
      return { ...state, stored: current, operator, waitingForOperand: true };
    }

    const result = compute(state.stored, current, state.operator);
    const display = format(result);
    if (display === "Error") return errorState();
    return {
      ...state,
      display,
      stored: result,
      operator,
      waitingForOperand: true,
    };
  }

  function equals(state) {
    if (state.error || state.operator === null || state.stored === null) {
      return state;
    }
    const result = compute(
      state.stored,
      parseFloat(state.display),
      state.operator
    );
    const display = format(result);
    if (display === "Error") return errorState();
    return {
      display,
      stored: null,
      operator: null,
      waitingForOperand: true,
      error: false,
    };
  }

  function toggleSign(state) {
    if (state.error || state.display === "0") return state;
    const display = state.display.startsWith("-")
      ? state.display.slice(1)
      : "-" + state.display;
    return { ...state, display };
  }

  function percent(state) {
    if (state.error) return state;
    return { ...state, display: format(parseFloat(state.display) / 100) };
  }

  function backspace(state) {
    if (state.error) return createState();
    if (state.waitingForOperand) return state;
    let display = state.display.slice(0, -1);
    if (display === "" || display === "-") display = "0";
    return { ...state, display };
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
    toggleSign,
    percent,
    backspace,
    clear: createState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calculator;
  } else {
    root.Calculator = Calculator;
  }
})(typeof window !== "undefined" ? window : globalThis);
