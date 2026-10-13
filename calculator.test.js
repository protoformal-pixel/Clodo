const test = require("node:test");
const assert = require("node:assert");
const C = require("./calculator.js");

const KEY_PATTERN =
  /sqrt|square|reciprocal|factorial|a?(sin|cos|tan)|ln|log|exp|pow10|pi|e|[0-9]+|./g;

// Feed a sequence of key presses, e.g. "12+3=" or "9sqrt", and return the
// final state. Words are functions or constants (pi, e); "#" is the y-th root;
// "[" and "]" move the cursor left and right.
function run(keys, { state = C.createState(), angle = "deg" } = {}) {
  for (const key of keys.match(KEY_PATTERN)) {
    if (/^[0-9]+$/.test(key)) {
      for (const digit of key) state = C.inputDigit(state, digit);
    } else if (key === "pi" || key === "e") state = C.insertConstant(state, key);
    else if (/^[a-z]/.test(key)) state = C.applyFunction(state, key, angle);
    else if ("+-*/^".includes(key)) state = C.setOperator(state, key);
    else if (key === "#") state = C.setOperator(state, "root");
    else if (key === ".") state = C.inputDecimal(state);
    else if (key === "=") state = C.equals(state);
    else if (key === "%") state = C.percent(state);
    else if (key === "~") state = C.toggleSign(state);
    else if (key === "<") state = C.backspace(state);
    else if (key === "[") state = C.moveCursor(state, -1);
    else if (key === "]") state = C.moveCursor(state, 1);
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

test("multiplication and division before addition and subtraction", () => {
  assert.strictEqual(press("2+3*4="), "14");
  assert.strictEqual(press("2*3+4="), "10");
  assert.strictEqual(press("10-6/2-1="), "6");
  assert.strictEqual(press("2+3*4-5*2="), "4");
  assert.strictEqual(press("8/4/2="), "1");
});

test("shows the running result once it is known", () => {
  assert.strictEqual(press("2+3*"), "3"); // 3 × still waits for its number
  assert.strictEqual(press("2+3*4+"), "14");
  assert.strictEqual(press("2*3+"), "6");
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
  assert.strictEqual(press("2+3*-4="), "1"); // the swap respects precedence
  assert.strictEqual(press("2-3*-4="), "-5");
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
    result: "14",
  });
  assert.strictEqual(run("5+-3=").completed.expression, "5 - 3");
  assert.strictEqual(run("5~*2=").completed.expression, "-5 * 2");
});

test("nothing is recorded without a finished calculation", () => {
  assert.strictEqual(run("12").completed, null);
  assert.strictEqual(run("12=").completed, null);
  assert.strictEqual(run("5/0=").completed, null);
  // Pressing = again without a new calculation must not repeat the entry.
  assert.strictEqual(run("2+3=7=").completed, null);
  assert.strictEqual(run("2+3==").completed, null);
});

test("continuing from a result starts a new expression", () => {
  const state = run("2+3=*4=");
  assert.deepStrictEqual(state.completed, {
    expression: "5 * 4",
    result: "20",
  });
});

test("recall starts a new calculation from a value", () => {
  const state = run("+1=", { state: C.recall("15") });
  assert.deepStrictEqual(state.completed, {
    expression: "15 + 1",
    result: "16",
  });
  assert.strictEqual(run("7", { state: C.recall("15") }).display, "7");
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

test("powers and roots", () => {
  assert.strictEqual(press("9sqrt"), "3");
  assert.strictEqual(press("12square"), "144");
  assert.strictEqual(press("2^10="), "1024");
  assert.strictEqual(press("2^3^2="), "512"); // 2 ^ 9, as on paper
  assert.strictEqual(press("2*3^2="), "18");
  assert.strictEqual(press("27#3="), "3");
  assert.strictEqual(press("8~#3="), "-2");
  assert.strictEqual(press("2sqrtsquare"), "2");
  assert.strictEqual(press("4reciprocal"), "0.25");
  assert.strictEqual(press("5factorial"), "120");
  assert.strictEqual(press("0factorial"), "1");
});

test("trig in degrees, with exact answers at right angles", () => {
  assert.strictEqual(press("30sin"), "0.5");
  assert.strictEqual(press("60cos"), "0.5");
  assert.strictEqual(press("45tan"), "1");
  assert.strictEqual(press("180sin"), "0");
  assert.strictEqual(press("90cos"), "0");
  assert.strictEqual(press("270sin"), "-1");
  assert.strictEqual(press("360~sin"), "0");
  assert.strictEqual(press("90tan"), "Error");
  assert.strictEqual(press("270tan"), "Error");
});

test("inverse trig in degrees", () => {
  assert.strictEqual(press(".5asin"), "30");
  assert.strictEqual(press(".5acos"), "60");
  assert.strictEqual(press("1atan"), "45");
  assert.strictEqual(press("2asin"), "Error");
});

test("trig in radians", () => {
  const rad = (keys) => run(keys, { angle: "rad" }).display;
  assert.strictEqual(rad("pisin"), "0");
  assert.strictEqual(rad("picos"), "-1");
  assert.strictEqual(rad("1atan*4="), "3.14159265359");
  assert.strictEqual(rad("0sin"), "0");
});

test("logarithms, exponentials and constants", () => {
  assert.strictEqual(press("1000log"), "3");
  assert.strictEqual(press("eln"), "1");
  assert.strictEqual(press("2pow10"), "100");
  assert.strictEqual(press("0exp"), "1");
  assert.strictEqual(press("pi"), "3.14159265359");
  assert.strictEqual(press("2*pi="), "6.28318530718");
});

test("invalid inputs show Error", () => {
  assert.strictEqual(press("4~sqrt"), "Error");
  assert.strictEqual(press("0log"), "Error");
  assert.strictEqual(press("1~ln"), "Error");
  assert.strictEqual(press("0reciprocal"), "Error");
  assert.strictEqual(press("3~factorial"), "Error");
  assert.strictEqual(press("2.5factorial"), "Error");
  assert.strictEqual(press("171factorial"), "Error");
  assert.strictEqual(press("4~#2="), "Error");
  assert.strictEqual(press("4sqrt~sqrt"), "Error");
});

test("functions read naturally in the history", () => {
  const entry = (keys, options) => run(keys, options).completed;
  assert.deepStrictEqual(entry("30sin="), {
    expression: "sin(30°)",
    result: "0.5",
  });
  assert.strictEqual(entry("2+9sqrt=").expression, "2 + √9");
  assert.strictEqual(entry("9sqrtsquare=").expression, "(√9)²");
  assert.strictEqual(entry("2*pi=").expression, "2 * π");
  assert.strictEqual(entry("pisin=", { angle: "rad" }).expression, "sin(π)");
  assert.strictEqual(entry(".5asin=").expression, "sin⁻¹(0.5)");
  assert.strictEqual(entry("2^10=").expression, "2 ^ 10");
  assert.strictEqual(entry("9sqrt~=").expression, "-(√9)");
  // A lone function is recorded once, not again on a second =.
  assert.strictEqual(entry("9sqrt=="), null);
});

test("editing in the middle of a number", () => {
  const at = (keys, index) => C.setCursor(run(keys), index);
  // 8450: tap between 4 and 5, delete the 4.
  assert.strictEqual(run("<", { state: at("8450", 2) }).display, "850");
  assert.strictEqual(run("<", { state: at("8450", 2) }).cursor, 1);
  // Typing goes in at the cursor and the cursor moves along.
  const typed = run("67", { state: at("8450", 1) });
  assert.strictEqual(typed.display, "867450");
  assert.strictEqual(typed.cursor, 3);
  // The edited number is what gets calculated.
  assert.strictEqual(run("<+1=", { state: at("8450", 2) }).display, "851");
  // Arrow keys.
  assert.strictEqual(press("8450[<"), "840");
  assert.strictEqual(press("8450[[]<"), "840");
  // Nothing to delete in front of the first digit.
  assert.strictEqual(run("<", { state: at("8450", 0) }).display, "8450");
});

test("cursor edge cases", () => {
  const at = (keys, index) => C.setCursor(run(keys), index);
  // Placing the cursor at the end is the same as no cursor.
  assert.strictEqual(at("845", 3).cursor, null);
  assert.strictEqual(at("845", 99).cursor, null);
  // No leading zeros: 0 in front of 845 is dropped; 7 in front of 0 replaces it.
  assert.strictEqual(run("0", { state: at("845", 0) }).display, "845");
  assert.strictEqual(run("7", { state: at("0", 0) }).display, "7");
  // A point in front becomes "0.".
  assert.strictEqual(run(".", { state: at("5", 0) }).display, "0.5");
  assert.strictEqual(run(".", { state: at("84", 1) }).display, "8.4");
  assert.strictEqual(run(".", { state: at("8.4", 1) }).display, "8.4");
  // Deleting the only digit leaves 0.
  assert.strictEqual(run("<", { state: at("5", 1) }).display, "0");
  assert.strictEqual(run("<", { state: at("5~", 2) }).display, "0");
  // The sign keeps the cursor on the same digit.
  const signed = run("~<", { state: at("845", 1) });
  assert.strictEqual(signed.display, "-45");
});

test("results can be edited, but not while an operator waits", () => {
  // After =, tapping the result lets you change it.
  assert.strictEqual(run("<", { state: C.setCursor(run("40+2="), 1) }).display, "2");
  assert.strictEqual(run("<", { state: C.moveCursor(run("40+2="), 0) }).display, "4");
  // Right after an operator the display shows a running total; editing it
  // would be confusing, so the cursor is ignored there.
  const pending = C.setCursor(run("40+"), 1);
  assert.strictEqual(pending.cursor, null);
  assert.strictEqual(run("2=", { state: pending }).display, "42");
  // Results such as 1e+21 cannot be edited digit by digit.
  assert.strictEqual(C.setCursor(run("1000000*1000000*1000000000="), 1).cursor, null);
  // Any operator or function ends editing.
  assert.strictEqual(C.setOperator(C.setCursor(run("845"), 1), "+").cursor, null);
  assert.strictEqual(run("sqrt", { state: C.setCursor(run("16"), 1) }).cursor, null);
});
