// Statistics: one-variable summaries and two-variable regression, as in a
// Casio STAT mode. No page code, so it can be tested with Node.
(function (root) {
  "use strict";

  const sum = (values) => values.reduce((a, b) => a + b, 0);

  // Median of a sorted list.
  function median(sorted) {
    const n = sorted.length;
    const mid = Math.floor(n / 2);
    return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // n, mean, Σx, Σx², σ (population), s (sample), min, Q1, median, Q3, max.
  // Quartiles as on a Casio: the medians of the lower and upper halves,
  // leaving out the middle value when there is an odd number.
  function oneVar(values) {
    const n = values.length;
    if (!n) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sum(values) / n;
    const squares = sum(values.map((v) => (v - mean) ** 2));
    const half = Math.floor(n / 2);
    return {
      n,
      mean,
      sum: sum(values),
      sumSquares: sum(values.map((v) => v * v)),
      popSD: Math.sqrt(squares / n),
      sampleSD: n > 1 ? Math.sqrt(squares / (n - 1)) : NaN,
      min: sorted[0],
      q1: n > 1 ? median(sorted.slice(0, half)) : sorted[0],
      median: median(sorted),
      q3: n > 1 ? median(sorted.slice(n - half)) : sorted[0],
      max: sorted[n - 1],
    };
  }

  // Straight-line least squares y = a + bx, with the correlation r.
  function linearFit(xs, ys) {
    const n = xs.length;
    const mx = sum(xs) / n;
    const my = sum(ys) / n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
      sxy += (xs[i] - mx) * (ys[i] - my);
    }
    if (sxx === 0) return null; // all x the same: no line through them
    const b = sxy / sxx;
    // A horizontal line through the points fits perfectly but r is undefined.
    const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
    return { a: my - b * mx, b, r };
  }

  // Solve a small linear system by Gaussian elimination.
  function solveLinear(m, v) {
    const n = v.length;
    const rows = m.map((row, i) => [...row, v[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
      }
      if (Math.abs(rows[pivot][col]) < 1e-12) return null;
      [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = rows[r][col] / rows[col][col];
        for (let c = col; c <= n; c++) rows[r][c] -= f * rows[col][c];
      }
    }
    return rows.map((row, i) => row[n] / row[i]);
  }

  // The models, as on a Casio. Each turns the data into a fit, or a reason
  // why it cannot.
  //   fit:  { coefficients: { a, b, c? }, r?, r2?, f(x) }
  const MODELS = {
    lin: {
      name: "Linear",
      formula: "y = a + bx",
      minPoints: 2,
      fit(xs, ys) {
        const line = linearFit(xs, ys);
        if (!line) return { error: "All x values are the same" };
        const { a, b, r } = line;
        return { coefficients: { a, b }, r, f: (x) => a + b * x };
      },
    },
    quad: {
      name: "Quadratic",
      formula: "y = a + bx + cx²",
      minPoints: 3,
      fit(xs, ys) {
        // Normal equations for a + bx + cx².
        const s = (k) => sum(xs.map((x) => x ** k));
        const t = (k) => sum(xs.map((x, i) => x ** k * ys[i]));
        const coef = solveLinear(
          [
            [xs.length, s(1), s(2)],
            [s(1), s(2), s(3)],
            [s(2), s(3), s(4)],
          ],
          [t(0), t(1), t(2)]
        );
        if (!coef) return { error: "Needs at least 3 different x values" };
        const [a, b, c] = coef;
        const f = (x) => a + b * x + c * x * x;
        return { coefficients: { a, b, c }, r2: rSquared(xs, ys, f), f };
      },
    },
    log: {
      name: "Logarithmic",
      formula: "y = a + b·ln x",
      minPoints: 2,
      fit(xs, ys) {
        if (xs.some((x) => x <= 0)) return { error: "Needs every x above 0" };
        const line = linearFit(xs.map(Math.log), ys);
        if (!line) return { error: "All x values are the same" };
        const { a, b, r } = line;
        return { coefficients: { a, b }, r, f: (x) => a + b * Math.log(x) };
      },
    },
    exp: {
      name: "Exponential",
      formula: "y = a·e^(bx)",
      minPoints: 2,
      fit(xs, ys) {
        if (ys.some((y) => y <= 0)) return { error: "Needs every y above 0" };
        const line = linearFit(xs, ys.map(Math.log));
        if (!line) return { error: "All x values are the same" };
        const a = Math.exp(line.a);
        const { b, r } = line;
        return { coefficients: { a, b }, r, f: (x) => a * Math.exp(b * x) };
      },
    },
    pow: {
      name: "Power",
      formula: "y = a·x^b",
      minPoints: 2,
      fit(xs, ys) {
        if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) {
          return { error: "Needs every x and y above 0" };
        }
        const line = linearFit(xs.map(Math.log), ys.map(Math.log));
        if (!line) return { error: "All x values are the same" };
        const a = Math.exp(line.a);
        const { b, r } = line;
        return { coefficients: { a, b }, r, f: (x) => a * Math.pow(x, b) };
      },
    },
  };

  // How much of the spread in y the fit explains (1 is a perfect fit).
  function rSquared(xs, ys, f) {
    const my = sum(ys) / ys.length;
    const total = sum(ys.map((y) => (y - my) ** 2));
    const residual = sum(ys.map((y, i) => (y - f(xs[i])) ** 2));
    return total === 0 ? NaN : 1 - residual / total;
  }

  function regression(kind, xs, ys) {
    const model = MODELS[kind];
    if (xs.length < model.minPoints) {
      return { error: `${model.name} needs at least ${model.minPoints} points` };
    }
    return model.fit(xs, ys);
  }

  const Stats = { oneVar, regression, MODELS };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Stats;
  } else {
    root.Stats = Stats;
  }
})(typeof window !== "undefined" ? window : globalThis);
