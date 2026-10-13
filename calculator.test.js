const test = require("node:test");
const assert = require("node:assert");
const C = require("./calculator.js");

// Multi-character tokens, longest first; everything else is one character.
const TOKEN_PATTERN =
  /→[A-F]|∫\(|d\/dx\(|Solve\(|[sct][a-z]{2}⁻¹\(|sin\(|cos\(|tan\(|ln\(|log\(|√\(|e\^\(|10\^\(|Abs\(|Ans|root|neg|⁻¹|./g;

// Type keys and return the final state. "=" evaluates, "<" is ⌫, "[" and
// "]" move the cursor, "→A" stores in A. Operators use the internal tokens:
// * / - root neg.
function run(keys, { state = C.createState(), angle = "deg" } = {}) {
  for (const key of keys.match(TOKEN_PATTERN)) {
    if (key === "=") state = C.equals(state, angle);
    else if (key === "<") state = C.backspace(state);
    else if (key === "[") state = C.moveCursor(state, -1);
    else if (key === "]") state = C.moveCursor(state, 1);
    else if (key.startsWith("→")) state = C.store(state, key[1], angle);
    else state = C.insert(state, key);
  }
  return state;
}

// The answer to an expression, or the error message.
function calc(expression, options) {
  const state = run(expression + "=", options);
  return state.error ?? state.result;
}

test("basic arithmetic and order of operations", () => {
  assert.strictEqual(calc("12+3"), "15");
  assert.strictEqual(calc("9-14"), "-5");
  assert.strictEqual(calc("6*7"), "42");
  assert.strictEqual(calc("8/2"), "4");
  assert.strictEqual(calc("2+3*4"), "14");
  assert.strictEqual(calc("10-6/2-1"), "6");
  assert.strictEqual(calc("8/4/2"), "1");
  assert.strictEqual(calc(".1+.2"), "0.3");
});

test("parentheses", () => {
  assert.strictEqual(calc("(2+3)*4"), "20");
  assert.strictEqual(calc("2*(3+4)²-sin(30)"), "97.5");
  assert.strictEqual(calc("((1+2)*(3+4))/7"), "3");
  assert.strictEqual(calc("-(2+3)"), "-5");
  // Brackets left open at the end are closed for you.
  assert.strictEqual(calc("2*(3+4"), "14");
  assert.strictEqual(calc("√(16"), "4");
});

test("implied multiplication binds tighter than × and ÷, as on a Casio", () => {
  assert.strictEqual(calc("2π"), "6.28318530718");
  assert.strictEqual(calc("3(4+1)"), "15");
  assert.strictEqual(calc("(1+2)(3+4)"), "21");
  assert.strictEqual(calc("2sin(30)"), "1");
  assert.strictEqual(calc("1/2π"), "0.159154943092"); // 1 ÷ (2π)
  assert.strictEqual(calc("6/2(1+2)"), "1"); // 6 ÷ (2 × 3)
});

test("signs and powers", () => {
  assert.strictEqual(calc("neg5+3"), "-2");
  assert.strictEqual(calc("-5+3"), "-2");
  assert.strictEqual(calc("2*-3"), "-6");
  assert.strictEqual(calc("-2²"), "-4"); // −(2²), as on paper
  assert.strictEqual(calc("(neg2)²"), "4");
  assert.strictEqual(calc("2^10"), "1024");
  assert.strictEqual(calc("2^-1"), "0.5");
  assert.strictEqual(calc("2^3^2"), "512"); // 2^9
  assert.strictEqual(calc("2*3^2"), "18");
  assert.strictEqual(calc("27root3"), "3");
  assert.strictEqual(calc("neg8root3"), "-2");
});

test("postfix keys", () => {
  assert.strictEqual(calc("12²"), "144");
  assert.strictEqual(calc("4⁻¹"), "0.25");
  assert.strictEqual(calc("5!"), "120");
  assert.strictEqual(calc("0!"), "1");
  assert.strictEqual(calc("(2+1)!"), "6");
  assert.strictEqual(calc("50%"), "0.5");
  assert.strictEqual(calc("200*15%"), "30");
});

test("functions in degrees, with exact answers at right angles", () => {
  assert.strictEqual(calc("sin(30)"), "0.5");
  assert.strictEqual(calc("cos(60)"), "0.5");
  assert.strictEqual(calc("tan(45)"), "1");
  assert.strictEqual(calc("sin(180)"), "0");
  assert.strictEqual(calc("cos(90)"), "0");
  assert.strictEqual(calc("sin(-360)"), "0");
  assert.strictEqual(calc("sin⁻¹(.5)"), "30");
  assert.strictEqual(calc("cos⁻¹(.5)"), "60");
  assert.strictEqual(calc("tan⁻¹(1)"), "45");
  assert.strictEqual(calc("sin(30)²+cos(30)²"), "1");
});

test("functions in radians", () => {
  const rad = (e) => calc(e, { angle: "rad" });
  assert.strictEqual(rad("sin(π)"), "0");
  assert.strictEqual(rad("cos(π)"), "-1");
  assert.strictEqual(rad("4tan⁻¹(1)"), "3.14159265359");
  assert.strictEqual(rad("sin(π/6)"), "0.5");
});

test("logarithms, exponentials, roots and constants", () => {
  assert.strictEqual(calc("log(1000)"), "3");
  assert.strictEqual(calc("ln(e)"), "1");
  assert.strictEqual(calc("10^(2)"), "100");
  assert.strictEqual(calc("e^(0)"), "1");
  assert.strictEqual(calc("√(16)"), "4");
  assert.strictEqual(calc("√(2)²"), "2");
  assert.strictEqual(calc("Abs(neg5)"), "5");
  assert.strictEqual(calc("π"), "3.14159265359");
});

test("syntax errors", () => {
  for (const bad of ["2+", "*3", ")", "2)", "()", "1.2.3", ".", "2neg3", "sin()", "2(3+)"]) {
    assert.strictEqual(calc(bad), "Syntax Error", bad);
  }
});

test("math errors", () => {
  for (const bad of ["5/0", "√(neg4)", "log(0)", "ln(neg1)", "tan(90)", "sin⁻¹(2)",
    "0⁻¹", "(neg3)!", "2.5!", "171!", "(neg4)root2", "10^(400)"]) {
    assert.strictEqual(calc(bad), "Math Error", bad);
  }
});

test("an error keeps the expression for fixing", () => {
  const failed = run("5/0=");
  assert.strictEqual(failed.error, "Math Error");
  assert.strictEqual(C.toText(failed.tokens), "5÷0");
  const fixed = run("<2=", { state: failed });
  assert.strictEqual(fixed.error, null);
  assert.strictEqual(fixed.result, "2.5");
});

test("Ans carries the last answer", () => {
  const first = run("2+3=");
  assert.strictEqual(first.ans, 5);
  // An operator right after a result continues from it…
  assert.strictEqual(run("*2=", { state: first }).result, "10");
  assert.strictEqual(run("²=", { state: first }).result, "25");
  assert.strictEqual(run("-1=", { state: first }).result, "4");
  // …anything else starts a new calculation.
  assert.strictEqual(run("7=", { state: first }).result, "7");
  assert.strictEqual(run("neg1=", { state: first }).result, "-1");
  assert.strictEqual(run("(1+1)=", { state: first }).result, "2");
  // Ans can also be typed anywhere.
  assert.strictEqual(run("10-Ans=", { state: first }).result, "5");
  // AC keeps Ans.
  assert.strictEqual(C.clear(first).ans, 5);
  // Ans keeps full precision: (1/3) × 3 = 1.
  assert.strictEqual(run("*3=", { state: run("1/3=") }).result, "1");
});

test("history entries read naturally", () => {
  assert.deepStrictEqual(run("2*(3+4)²=").completed, {
    expression: "2×(3+4)²",
    result: "98",
  });
  assert.strictEqual(run("sin⁻¹(.5)-1=").completed.expression, "sin⁻¹(.5)−1");
  // Ans is written as its value.
  assert.strictEqual(run("*2=", { state: run("2+3=") }).completed.expression, "5×2");
  assert.strictEqual(run("*2=", { state: run("2-3=") }).completed.expression, "(−1)×2");
  // Nothing is recorded twice, or for an error.
  assert.strictEqual(run("2+3==").completed, null);
  assert.strictEqual(run("5/0=").completed, null);
});

test("live preview while typing", () => {
  assert.strictEqual(C.preview(run("2+3*4")), "14");
  assert.strictEqual(C.preview(run("2*(3+4")), "14");
  assert.strictEqual(C.preview(run("2+")), null); // not finished
  assert.strictEqual(C.preview(run("845")), null); // same as the screen
  assert.strictEqual(C.preview(run("2+3=")), null); // result already shown
});

test("⌫ deletes whole tokens, at the cursor", () => {
  assert.strictEqual(C.toText(run("sin(<").tokens), "");
  assert.strictEqual(C.toText(run("2+sin(30<<<").tokens), "2+");
  assert.strictEqual(C.toText(run("8450[<").tokens), "840");
  // 8450: put the cursor between 4 and 5 and delete the 4.
  const at = C.setCursor(run("8450"), 2);
  const deleted = C.backspace(at);
  assert.strictEqual(C.toText(deleted.tokens), "850");
  assert.strictEqual(deleted.cursor, 1);
  // Typing goes in at the cursor.
  assert.strictEqual(C.toText(run("(", { state: C.setCursor(run("2+3)*4"), 0) }).tokens), "(2+3)×4");
  assert.strictEqual(C.equals(run("(", { state: C.setCursor(run("2+3)*4"), 0) })).result, "20");
});

test("after a result, ⌫ and the arrows go back to the expression", () => {
  const done = run("2*(3+4)=");
  const back = C.backspace(done);
  assert.strictEqual(back.result, null);
  assert.strictEqual(C.toText(back.tokens), "2×(3+4)");
  assert.strictEqual(C.moveCursor(done, -1).result, null);
  // Fix it and run it again.
  assert.strictEqual(run("[<5=", { state: back }).result, "16"); // 2×(3+5)
});

test("cursor limits", () => {
  assert.strictEqual(C.setCursor(run("845"), 3).cursor, null);
  assert.strictEqual(C.setCursor(run("845"), 99).cursor, null);
  assert.strictEqual(C.setCursor(run("845"), -5).cursor, 0);
  assert.strictEqual(C.toText(run("<", { state: C.setCursor(run("845"), 0) }).tokens), "845");
});

test("history results can be typed back in", () => {
  assert.strictEqual(C.equals(C.insertNumber(run("2*"), "15")).result, "30");
  assert.strictEqual(C.equals(C.insertNumber(run("2*"), "-1.5")).result, "-3");
  assert.strictEqual(C.equals(C.insertNumber(run("1/"), "1.2e+21")).result, "8.33333333333e-22");
  assert.strictEqual(C.equals(C.insertNumber(C.createState(), "2e-7")).result, "2e-7");
  // After a result it starts a new calculation.
  assert.strictEqual(C.toText(C.insertNumber(run("2+3="), "15").tokens), "15");
});

test("x outside a graph is a syntax error, not a crash", () => {
  assert.strictEqual(calc("x"), "Syntax Error");
  assert.strictEqual(calc("2x+1"), "Syntax Error");
});

test("the parse tree can be evaluated for any x (for graphs)", () => {
  const tree = C.parse(["x", "²", "-", "3", "x"]);
  assert.strictEqual(C.evaluate(tree, { x: 2, angle: "deg" }), -2);
  assert.strictEqual(C.evaluate(tree, { x: 5, angle: "deg" }), 10);
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

test("memory: STO stores, letters recall", () => {
  const stored = run("2*3→A");
  assert.strictEqual(stored.result, "6");
  assert.strictEqual(stored.memory.A, 6);
  assert.strictEqual(stored.resultExpression, "2×3→A");
  assert.deepStrictEqual(stored.completed, { expression: "2×3→A", result: "6" });
  // Letters work like numbers, including without a × sign.
  assert.strictEqual(run("A+1=", { state: stored }).result, "7");
  assert.strictEqual(run("2A=", { state: stored }).result, "12");
  assert.strictEqual(run("A²-B=", { state: stored }).result, "36"); // B is 0
  // Memory keeps full precision: 1/3 → B, then 3B = 1.
  assert.strictEqual(run("3B=", { state: run("1/3→B") }).result, "1");
});

test("memory: what STO stores", () => {
  // The answer on screen, without a second history entry.
  const fromResult = run("4+5=→C");
  assert.strictEqual(fromResult.memory.C, 9);
  assert.strictEqual(fromResult.resultExpression, "4+5→C");
  assert.strictEqual(fromResult.completed, null);
  // Ans when nothing is typed.
  const fromAns = run("→D", { state: C.clear(run("7*6=")) });
  assert.strictEqual(fromAns.memory.D, 42);
  assert.strictEqual(fromAns.result, "42");
  // Storing a new value replaces the old one.
  assert.strictEqual(run("1→A2→A").memory.A, 2);
  // Unknown letters are ignored.
  assert.strictEqual(C.store(run("5"), "Z").memory.Z, undefined);
});

test("memory: errors store nothing and memory survives AC", () => {
  const failed = run("5/0→A", { state: run("8→A") });
  assert.strictEqual(failed.error, "Math Error");
  assert.strictEqual(failed.memory.A, 8);
  assert.strictEqual(C.clear(failed).memory.A, 8);
  assert.strictEqual(C.clearMemory(failed).memory.A, 0);
  // A state can start with saved memory, e.g. after reopening the app.
  assert.strictEqual(C.createState(0, { E: 2.5 }).memory.E, 2.5);
  assert.strictEqual(C.createState(0, { E: 2.5 }).memory.A, 0);
});

test("calculus: integrals, derivatives and Solve", () => {
  assert.strictEqual(calc("∫(x²,0,3)"), "9");
  assert.strictEqual(calc("∫(sin(x),0,π)", { angle: "rad" }), "2");
  assert.strictEqual(calc("∫(1/x,1,e)"), "1");
  assert.strictEqual(calc("∫(x²,3,0)"), "-9");
  assert.strictEqual(calc("d/dx(x^3,2)"), "12");
  assert.strictEqual(calc("d/dx(sin(x),0)", { angle: "rad" }), "1");
  assert.strictEqual(calc("Solve(x²-2,1)"), "1.41421356237");
  assert.strictEqual(calc("Solve(x²-2,neg1)"), "-1.41421356237");
  assert.strictEqual(calc("Solve(cos(x)-x)", { angle: "rad" }), "0.739085133215");
  // They combine with everything else.
  assert.strictEqual(calc("2∫(x,0,1)+1"), "2");
  assert.strictEqual(calc("∫(d/dx(x²,x),0,1)"), "1");
  assert.strictEqual(calc("∫(Ax,0,2)", { state: run("3→A") }), "6");
});

test("calculus errors", () => {
  assert.strictEqual(calc("Solve(x²+1)"), "Can't Solve");
  assert.strictEqual(calc("∫(√(x),neg2,neg1)"), "Math Error");
  assert.strictEqual(calc("∫(x,0)"), "Syntax Error");
  assert.strictEqual(calc("d/dx(x)"), "Syntax Error");
  assert.strictEqual(calc("Solve(x,1,2)"), "Syntax Error");
  assert.strictEqual(calc("2,3"), "Syntax Error");
  assert.strictEqual(C.toText(run("∫(x²,0,3)").tokens), "∫(x²,0,3)");
});
