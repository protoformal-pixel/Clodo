const test = require("node:test");
const assert = require("node:assert");
const G = require("./graph.js");
const C = require("./calculator.js");

test("tick steps are 1, 2 or 5 × 10ⁿ", () => {
  assert.strictEqual(G.niceStep(20, 10), 2);
  assert.strictEqual(G.niceStep(20, 4), 5);
  assert.strictEqual(G.niceStep(1, 10), 0.1);
  assert.strictEqual(G.niceStep(720, 6), 100);
  assert.deepStrictEqual(G.ticks(-10, 10, 4).values, [-10, -5, 0, 5, 10]);
  // No floating point noise in tick values.
  assert.deepStrictEqual(G.ticks(0, 0.6, 6).values, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  assert.strictEqual(G.label(0.30000000000000004, 0.1), "0.3");
  assert.strictEqual(G.label(1.23456789), "1.23457");
});

test("views: standard, trig, bounds, zoom and pan", () => {
  const std = G.standardView(400);
  assert.deepStrictEqual(G.bounds(std, 400, 300), { xmin: -10, xmax: 10, ymin: -7.5, ymax: 7.5 });
  const trig = G.bounds(G.trigView(400, 300, "deg"), 400, 300);
  assert.strictEqual(trig.xmin, -360);
  assert.ok(Math.abs(trig.ymax - 1.6) < 1e-12);
  // Zooming in around the centre halves the range.
  const zoomed = G.bounds(G.zoom(std, 0.5, 200, 150, 400, 300), 400, 300);
  assert.deepStrictEqual([zoomed.xmin, zoomed.xmax], [-5, 5]);
  // Zooming around a corner keeps that corner's point fixed.
  const corner = G.bounds(G.zoom(std, 0.5, 0, 0, 400, 300), 400, 300);
  assert.deepStrictEqual([corner.xmin, corner.ymax], [-10, 7.5]);
  // Dragging right by 20 px moves the view left by 1 unit.
  assert.strictEqual(G.pan(std, 20, 0).cx, -1);
  assert.strictEqual(G.pan(std, 0, 20).cy, 1);
});

test("sampling breaks curves at asymptotes, not on steep curves", () => {
  // 1/x: two pieces, either side of 0.
  assert.strictEqual(G.sample((x) => 1 / x, -1, 1, 200, 2).length, 2);
  // tan in degrees over two turns: undefined at ±90° and ±270°.
  const tan = C.parse(["tan(", "x", ")"]);
  const f = (x) => {
    try {
      return C.evaluate(tan, { x, angle: "deg" });
    } catch {
      return NaN;
    }
  };
  assert.strictEqual(G.sample(f, -360, 360, 720, 3.2).length, 5);
  // x³ is steep but continuous: one piece.
  assert.strictEqual(G.sample((x) => x ** 3, -10, 10, 100, 2).length, 1);
  // √x is undefined left of 0.
  const sqrt = G.sample(Math.sqrt, -5, 5, 100, 10);
  assert.strictEqual(sqrt.length, 1);
  assert.ok(sqrt[0][0][0] >= 0);
});
