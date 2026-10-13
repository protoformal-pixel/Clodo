const test = require("node:test");
const assert = require("node:assert");
const K = require("./calculus.js");

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} is not close to ${expected}`);

test("integrals", () => {
  near(K.integrate((x) => x * x, 0, 3), 9);
  near(K.integrate(Math.sin, 0, Math.PI), 2);
  near(K.integrate(Math.exp, 0, 1), Math.E - 1);
  near(K.integrate((x) => 1 / x, 1, Math.E), 1);
  near(K.integrate(Math.sqrt, 0, 1), 2 / 3); // steep at 0
  near(K.integrate((x) => 4 / (1 + x * x), 0, 1), Math.PI);
  near(K.integrate((x) => x * x, 3, 0), -9); // limits swapped
  near(K.integrate(Math.abs, -1, 2), 2.5); // corner at 0
  assert.strictEqual(K.integrate((x) => x, 2, 2), 0);
  assert.ok(Number.isNaN(K.integrate(Math.sqrt, -2, -1))); // undefined there
});

test("derivatives", () => {
  near(K.derivative((x) => x ** 3, 2), 12);
  near(K.derivative(Math.sin, 0), 1);
  near(K.derivative(Math.exp, 1), Math.E);
  near(K.derivative(Math.log, 1000), 0.001);
  assert.ok(Number.isNaN(K.derivative(Math.sqrt, 0))); // √x below 0 is undefined
});

test("solve", () => {
  near(K.solve((x) => x * x - 2, 1), Math.SQRT2);
  near(K.solve((x) => x * x - 2, -1), -Math.SQRT2);
  near(K.solve((x) => Math.cos(x) - x, 0), 0.739085133215161);
  near(K.solve((x) => x ** 3 - x - 1), 1.324717957244746); // from 0, Newton wanders
  near(K.solve((x) => Math.exp(x) - 10, 0), Math.log(10));
  assert.ok(Number.isNaN(K.solve((x) => x * x + 1, 0))); // no real root
  // tan changes sign at its asymptote π/2 too; only real roots (kπ) count.
  const t = K.solve(Math.tan, 1.5);
  near(Math.round(t / Math.PI) * Math.PI, t);
});

test("roots in a range, including touching roots, but not asymptotes", () => {
  const r = K.roots((x) => (x - 1) * (x + 2) * (x - 3), -10, 10);
  assert.strictEqual(r.length, 3);
  near(r[0], -2); near(r[1], 1); near(r[2], 3);
  const touch = K.roots((x) => (x - 1) ** 2, -10, 10);
  assert.strictEqual(touch.length, 1);
  near(touch[0], 1, 1e-6);
  // tan changes sign at ±π/2 but those are asymptotes; roots are 0, ±π.
  const tan = K.roots(Math.tan, -4, 4);
  assert.strictEqual(tan.length, 3);
  near(tan[1], 0);
  assert.deepStrictEqual(K.roots((x) => x * x + 1, -10, 10), []);
});

test("minimums and maximums in a range", () => {
  const min = K.extrema((x) => (x - 2) ** 2 + 1, -10, 10, "min");
  assert.strictEqual(min.length, 1);
  near(min[0].x, 2, 1e-6);
  near(min[0].y, 1);
  const max = K.extrema(Math.sin, -4, 4, "max");
  assert.strictEqual(max.length, 1);
  near(max[0].x, Math.PI / 2, 1e-6);
  near(max[0].y, 1);
  // A straight line has none; the ends of the range do not count.
  assert.deepStrictEqual(K.extrema((x) => x, -10, 10, "max"), []);
});
