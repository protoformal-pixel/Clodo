const test = require("node:test");
const assert = require("node:assert");
const S = require("./stats.js");

const near = (actual, expected, tol = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `${actual} is not close to ${expected}`);

test("one-variable summary", () => {
  const s = S.oneVar([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.strictEqual(s.n, 8);
  near(s.mean, 5);
  near(s.sum, 40);
  near(s.sumSquares, 232);
  near(s.popSD, 2);
  near(s.sampleSD, 2.138089935299395);
  assert.deepStrictEqual([s.min, s.q1, s.median, s.q3, s.max], [2, 4, 4.5, 6, 9]);
  assert.strictEqual(S.oneVar([]), null);
  assert.ok(Number.isNaN(S.oneVar([3]).sampleSD)); // needs two values
});

test("quartiles leave out the middle value when the count is odd", () => {
  const odd = S.oneVar([7, 1, 3, 5, 2, 6, 4]); // order does not matter
  assert.deepStrictEqual([odd.q1, odd.median, odd.q3], [2, 4, 6]);
  const even = S.oneVar([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual([even.q1, even.median, even.q3], [2.5, 4.5, 6.5]);
});

test("linear regression", () => {
  const fit = S.regression("lin", [1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
  near(fit.coefficients.a, 2.2);
  near(fit.coefficients.b, 0.6);
  near(fit.r, 0.7745966692414834);
  near(fit.f(10), 8.2);
  near(S.regression("lin", [0, 1, 2], [1, 3, 5]).r, 1);
  near(S.regression("lin", [0, 1, 2], [5, 3, 1]).r, -1);
});

test("other models recover exact curves", () => {
  const xs = [1, 2, 3, 4, 5];
  const quad = S.regression("quad", xs, xs.map((x) => 1 - 2 * x + 3 * x * x));
  near(quad.coefficients.a, 1); near(quad.coefficients.b, -2); near(quad.coefficients.c, 3);
  near(quad.r2, 1);
  const log = S.regression("log", xs, xs.map((x) => 1 + 2 * Math.log(x)));
  near(log.coefficients.a, 1); near(log.coefficients.b, 2); near(log.r, 1);
  const exp = S.regression("exp", xs, xs.map((x) => 2 * Math.exp(0.5 * x)));
  near(exp.coefficients.a, 2); near(exp.coefficients.b, 0.5); near(exp.r, 1);
  const pow = S.regression("pow", xs, xs.map((x) => 3 * x ** 2));
  near(pow.coefficients.a, 3); near(pow.coefficients.b, 2); near(pow.r, 1);
});

test("regression explains why it cannot fit", () => {
  assert.strictEqual(S.regression("lin", [1], [2]).error, "Linear needs at least 2 points");
  assert.strictEqual(S.regression("quad", [1, 2], [1, 4]).error, "Quadratic needs at least 3 points");
  assert.strictEqual(S.regression("lin", [2, 2, 2], [1, 2, 3]).error, "All x values are the same");
  assert.strictEqual(S.regression("quad", [1, 1, 2], [1, 1, 4]).error, "Needs at least 3 different x values");
  assert.strictEqual(S.regression("log", [0, 1, 2], [1, 2, 3]).error, "Needs every x above 0");
  assert.strictEqual(S.regression("exp", [1, 2, 3], [1, -2, 3]).error, "Needs every y above 0");
  assert.strictEqual(S.regression("pow", [1, 2, 3], [0, 2, 3]).error, "Needs every x and y above 0");
  // A flat line fits, but r is undefined.
  assert.ok(Number.isNaN(S.regression("lin", [1, 2, 3], [4, 4, 4]).r));
});
