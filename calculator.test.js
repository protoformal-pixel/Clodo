const test = require("node:test");
const assert = require("node:assert");
const C = require("./calculator.js");

// Feed a sequence of key presses, e.g. "12+3=", and return the final state.
function run(keys, state = C.createState()) {
  for (const key of keys) {
    if (/[0-9]/.test(key)) state = C.inputDigit(state, key);
    else if ("+-*/".includes(key)) state = C.setOperator(state, key);
    else if (key === ".") state = C.inputDecimal(state);
    else if (key === "=") state = C.equals(state);
    else if (key === "%") state = C.percent(state);
    else if (key === "~") state = C.toggleSign(state);
    else if (key === "<") state = C.backspace(state);
  }
  return state;
}

function press(keys) {
  return run(keys).display;
}

test("basic arithmetic", () => {
  assert.strictEqual(press("12+3="), "15");
  assert.strictEqual(press("9-14="), "-5");
  assert.strictEqual(press("6*7="), "42");
  assert.strictEqual(press("8/2="), "4");
});

test("chains operations left to right", () => {
  assert.strictEqual(press("2+3*4="), "20");
  assert.strictEqual(press("2+3*"), "5");
});

test("decimals and floating point noise", () => {
  assert.strictEqual(press(".1+.2="), "0.3");
  assert.strictEqual(press("1..5"), "1.5");
});

test("division by zero shows Error and recovers", () => {
  assert.strictEqual(press("5/0="), "Error");
  assert.strictEqual(press("5/0=7"), "7");
});

test("operator swap, sign, percent, backspace", () => {
  assert.strictEqual(press("5+-3="), "2");
  assert.strictEqual(press("5~"), "-5");
  assert.strictEqual(press("50%"), "0.5");
  assert.strictEqual(press("123<"), "12");
  assert.strictEqual(press("1<"), "0");
});

test("leading zeros are collapsed", () => {
  assert.strictEqual(press("007"), "7");
});

test("equals records the whole calculation", () => {
  assert.deepStrictEqual(run("12+3=").completed, {
    expression: "12 + 3",
    result: "15",
  });
  assert.deepStrictEqual(run("2+3*4=").completed, {
    expression: "2 + 3 * 4",
    result: "20",
  });
  assert.strictEqual(run("5+-3=").completed.expression, "5 - 3");
  assert.strictEqual(run("5~*2=").completed.expression, "-5 * 2");
});

test("nothing is recorded without a finished calculation", () => {
  assert.strictEqual(run("12").completed, null);
  assert.strictEqual(run("12=").completed, null);
  assert.strictEqual(run("5/0=").completed, null);
});

test("continuing from a result starts a new expression", () => {
  const state = run("2+3=*4=");
  assert.deepStrictEqual(state.completed, {
    expression: "5 * 4",
    result: "20",
  });
});

test("recall starts a new calculation from a value", () => {
  const state = run("+1=", C.recall("15"));
  assert.deepStrictEqual(state.completed, {
    expression: "15 + 1",
    result: "16",
  });
  assert.strictEqual(run("7", C.recall("15")).display, "7");
});

test("history keeps the newest 10 entries, newest first", () => {
  let history = [];
  for (let i = 1; i <= 12; i++) {
    history = C.addToHistory(history, { expression: `${i}`, result: `${i}` });
  }
  assert.strictEqual(history.length, 10);
  assert.strictEqual(history[0].result, "12");
  assert.strictEqual(history[9].result, "3");
});
