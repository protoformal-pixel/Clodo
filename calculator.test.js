const test = require("node:test");
const assert = require("node:assert");
const C = require("./calculator.js");

// Feed a sequence of key presses, e.g. "12+3=" , and return the display.
function press(keys) {
  let state = C.createState();
  for (const key of keys) {
    if (/[0-9]/.test(key)) state = C.inputDigit(state, key);
    else if ("+-*/".includes(key)) state = C.setOperator(state, key);
    else if (key === ".") state = C.inputDecimal(state);
    else if (key === "=") state = C.equals(state);
    else if (key === "%") state = C.percent(state);
    else if (key === "~") state = C.toggleSign(state);
    else if (key === "<") state = C.backspace(state);
  }
  return state.display;
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
