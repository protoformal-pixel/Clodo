// Numerical calculus: integrals, derivatives, equation solving, and finding
// roots, minimums and maximums in a range. Like a Casio, answers are
// numbers, not formulas. Functions passed in return NaN where undefined.
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // Integrals: adaptive Gauss–Kronrod (7 and 15 points). Each interval is
  // estimated twice; where the two disagree it is split in half and tried
  // again, so smooth parts cost little and curvy parts get more points.

  const XK = [
    0.991455371120813, 0.949107912342759, 0.864864423359769, 0.741531185599394,
    0.586087235467691, 0.405845151377397, 0.207784955007898, 0,
  ];
  const WK = [
    0.022935322010529, 0.063092092629979, 0.10479001032225, 0.140653259715525,
    0.169004726639267, 0.190350578064785, 0.204432940075298, 0.209482141084728,
  ];
  const WG = [0.12948496616887, 0.279705391489277, 0.381830050505119, 0.417959183673469];

  function gaussKronrod(f, a, b) {
    const centre = (a + b) / 2;
    const half = (b - a) / 2;
    const fc = f(centre);
    let kronrod = WK[7] * fc;
    let gauss = WG[3] * fc;
    for (let j = 0; j < 7; j++) {
      const dx = half * XK[j];
      const pair = f(centre - dx) + f(centre + dx);
      kronrod += WK[j] * pair;
      if (j % 2 === 1) gauss += WG[(j - 1) / 2] * pair;
    }
    return { value: kronrod * half, error: Math.abs(kronrod - gauss) * half };
  }

  function integrate(f, a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a);
    const whole = gaussKronrod(f, a, b);
    if (!Number.isFinite(whole.value)) return NaN;
    const tolerance = 1e-12 + 1e-11 * Math.abs(whole.value);
    let budget = 2000; // intervals; stops runaway splitting near singularities

    function refine(lo, hi, estimate, tol, depth) {
      if (estimate.error <= tol || depth > 40 || budget-- <= 0) return estimate.value;
      const mid = (lo + hi) / 2;
      const left = gaussKronrod(f, lo, mid);
      const right = gaussKronrod(f, mid, hi);
      return refine(lo, mid, left, tol / 2, depth + 1) + refine(mid, hi, right, tol / 2, depth + 1);
    }
    return refine(a, b, whole, tolerance, 0);
  }

  // ---------------------------------------------------------------------
  // Derivative at a point: the five-point central difference, accurate to
  // about 10 digits for smooth functions.

  function derivative(f, x) {
    const h = 1e-3 * Math.max(1, Math.abs(x));
    return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
  }

  // ---------------------------------------------------------------------
  // Roots

  // Halve [a, b] (where f changes sign) until it cannot shrink further.
  function bisect(f, a, b, fa) {
    for (let i = 0; i < 200; i++) {
      const mid = (a + b) / 2;
      if (mid === a || mid === b) break;
      const fm = f(mid);
      if (fm === 0) return mid;
      if (Math.sign(fm) === Math.sign(fa)) {
        a = mid;
        fa = fm;
      } else {
        b = mid;
      }
    }
    return Math.abs(f(a)) <= Math.abs(f(b)) ? a : b;
  }

  // Close enough to zero, relative to the size of f nearby.
  function isRoot(f, x, scale) {
    const y = f(x);
    return Number.isFinite(y) && Math.abs(y) <= 1e-9 * Math.max(1, scale);
  }

  // Solve f(x) = 0 near a starting guess: Newton's method first, then a
  // search outward for a sign change. NaN if no answer is found.
  function solve(f, guess = 0) {
    let x = guess;
    for (let i = 0; i < 100; i++) {
      const y = f(x);
      if (!Number.isFinite(y)) break;
      if (y === 0) return x;
      const slope = derivative(f, x);
      if (!Number.isFinite(slope) || slope === 0) break;
      const next = x - y / slope;
      if (!Number.isFinite(next)) break;
      if (Math.abs(next - x) <= 1e-14 * Math.max(1, Math.abs(x))) {
        if (isRoot(f, next, Math.abs(slope) * Math.max(1, Math.abs(next)))) return next;
        break;
      }
      x = next;
    }
    // Look further and further either side of the guess for a sign change.
    const step = 0.1 * Math.max(1, Math.abs(guess));
    let prevLeft = guess;
    let prevRight = guess;
    let fLeft = f(guess);
    let fRight = fLeft;
    for (let k = 1; k <= 60; k++) {
      const reach = step * (Math.pow(1.5, k) - 1);
      for (const side of [-1, 1]) {
        const xNew = guess + side * reach;
        const fNew = f(xNew);
        const xOld = side < 0 ? prevLeft : prevRight;
        const fOld = side < 0 ? fLeft : fRight;
        if (Number.isFinite(fNew) && Number.isFinite(fOld) && Math.sign(fNew) !== Math.sign(fOld)) {
          const r = bisect(f, xOld, xNew, fOld);
          // A sign change across an asymptote (like tan at 90°) is not a root.
          if (isRoot(f, r, Math.abs(fOld) + Math.abs(fNew))) return r;
        }
        if (side < 0) [prevLeft, fLeft] = [xNew, fNew];
        else [prevRight, fRight] = [xNew, fNew];
      }
    }
    return NaN;
  }

  // ---------------------------------------------------------------------
  // Everything in a range, for the graph: sample, then refine each find.

  function samples(f, a, b, n) {
    const xs = [];
    const ys = [];
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      xs.push(x);
      ys.push(f(x));
    }
    return { xs, ys };
  }

  // Golden-section search for the lowest point of f on [a, b].
  function minimise(f, a, b) {
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a);
    let d = a + g * (b - a);
    let fc = f(c);
    let fd = f(d);
    for (let i = 0; i < 200 && Math.abs(b - a) > 1e-15 * Math.max(1, Math.abs(a)); i++) {
      if (fc < fd) {
        [b, d, fd] = [d, c, fc];
        c = b - g * (b - a);
        fc = f(c);
      } else {
        [a, c, fc] = [c, d, fd];
        d = a + g * (b - a);
        fd = f(d);
      }
    }
    return (a + b) / 2;
  }

  // Local minimums (kind "min") or maximums ("max") inside (a, b), left to right.
  function extrema(f, a, b, kind, n = 400) {
    const sign = kind === "max" ? -1 : 1;
    const g = (x) => sign * f(x);
    const { xs, ys } = samples(g, a, b, n);
    const found = [];
    for (let i = 1; i < n; i++) {
      const [l, m, r] = [ys[i - 1], ys[i], ys[i + 1]];
      if (![l, m, r].every(Number.isFinite)) continue;
      if (m <= l && m < r) {
        const x = minimise(g, xs[i - 1], xs[i + 1]);
        found.push({ x, y: f(x) });
      }
    }
    return found;
  }

  // Roots inside [a, b], left to right: sign changes, plus places where the
  // curve just touches zero (like x² at 0).
  function roots(f, a, b, n = 400) {
    const { xs, ys } = samples(f, a, b, n);
    const scale = Math.max(1, ...ys.filter(Number.isFinite).map(Math.abs));
    const found = [];
    for (let i = 0; i < n; i++) {
      const [y0, y1] = [ys[i], ys[i + 1]];
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
      if (y0 === 0) found.push(xs[i]);
      else if (Math.sign(y0) !== Math.sign(y1) && y1 !== 0) {
        const x = bisect(f, xs[i], xs[i + 1], y0);
        if (isRoot(f, x, Math.abs(y0) + Math.abs(y1))) found.push(x);
      }
    }
    if (ys[n] === 0) found.push(xs[n]);
    // Touching roots: a low point of |f| that reaches zero.
    for (const { x } of extrema((x) => Math.abs(f(x)), a, b, "min", n)) {
      if (isRoot(f, x, scale * 1e-3) && !found.some((r) => Math.abs(r - x) < (b - a) / n)) {
        found.push(x);
      }
    }
    return found.sort((p, q) => p - q);
  }

  const Calculus = { integrate, derivative, solve, roots, extrema };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calculus;
  } else {
    root.Calculus = Calculus;
  }
})(typeof window !== "undefined" ? window : globalThis);
