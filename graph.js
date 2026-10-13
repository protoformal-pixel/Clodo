// Graph helpers: the visible window, axis ticks, sampling curves and drawing
// them on a canvas. No page code, so the maths can be tested with Node.
(function (root) {
  "use strict";

  // A view is a centre point and a scale per axis, in units per CSS pixel,
  // so it stays the same shape when the canvas is resized.
  //   { cx, cy, sx, sy }

  // x from −10 to 10, same scale on both axes.
  function standardView(width) {
    const scale = 20 / width;
    return { cx: 0, cy: 0, sx: scale, sy: scale };
  }

  // Casio's ZOOM TRIG: two full turns across, y from −1.6 to 1.6.
  function trigView(width, height, angle) {
    const span = angle === "deg" ? 720 : 4 * Math.PI;
    return { cx: 0, cy: 0, sx: span / width, sy: 3.2 / height };
  }

  function bounds(view, width, height) {
    return {
      xmin: view.cx - (view.sx * width) / 2,
      xmax: view.cx + (view.sx * width) / 2,
      ymin: view.cy - (view.sy * height) / 2,
      ymax: view.cy + (view.sy * height) / 2,
    };
  }

  // Zoom by factor (less than 1 zooms in), keeping the point under pixel
  // (px, py) where it is.
  function zoom(view, factor, px, py, width, height) {
    const b = bounds(view, width, height);
    const x = b.xmin + px * view.sx;
    const y = b.ymax - py * view.sy;
    const sx = view.sx * factor;
    const sy = view.sy * factor;
    return { sx, sy, cx: x + sx * (width / 2 - px), cy: y - sy * (height / 2 - py) };
  }

  // Move the view with a drag of (dx, dy) pixels.
  function pan(view, dx, dy) {
    return { ...view, cx: view.cx - dx * view.sx, cy: view.cy + dy * view.sy };
  }

  // A tick step of 1, 2 or 5 × 10ⁿ giving about `count` ticks over the range.
  function niceStep(range, count) {
    const raw = range / Math.max(count, 1);
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / power;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * power;
  }

  function decimals(step) {
    return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  }

  // Round to the tick's precision so labels read 0.3, not 0.30000000000000004.
  function tickValue(k, step) {
    const value = Number((k * step).toFixed(decimals(step)));
    return Object.is(value, -0) ? 0 : value;
  }

  function ticks(min, max, count) {
    const step = niceStep(max - min, count);
    const values = [];
    for (let k = Math.ceil(min / step - 1e-9); k <= Math.floor(max / step + 1e-9); k++) {
      values.push(tickValue(k, step));
    }
    return { step, values };
  }

  // Short text for a tick or a traced value.
  function label(value, step) {
    if (step === undefined) return String(Number(value.toPrecision(6)));
    return String(Number(value.toFixed(decimals(step))));
  }

  // Sample f at n + 1 evenly spaced x values and split the curve into
  // pieces wherever it is undefined or jumps, so tan(x) and 1/x get no
  // false vertical lines. ySpan is the visible height in units.
  function sample(f, xmin, xmax, n, ySpan) {
    const pieces = [];
    let piece = [];
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xmin + ((xmax - xmin) * i) / n;
      const y = f(x);
      if (!Number.isFinite(y)) {
        if (piece.length) pieces.push(piece);
        piece = [];
        prev = null;
        continue;
      }
      if (prev && Math.abs(y - prev[1]) > ySpan && jumps(f, prev, [x, y])) {
        pieces.push(piece);
        piece = [];
      }
      piece.push([x, y]);
      prev = [x, y];
    }
    if (piece.length) pieces.push(piece);
    return pieces;
  }

  // A big step between two neighbours is a jump (an asymptote) rather than a
  // steep curve when the value halfway is not between them.
  function jumps(f, a, b) {
    const y = f((a[0] + b[0]) / 2);
    if (!Number.isFinite(y)) return true;
    return y < Math.min(a[1], b[1]) || y > Math.max(a[1], b[1]);
  }

  // Draw grid, axes, curves and the trace line.
  //   curves: [{ f, color }]
  //   colors: { surface, grid, axis, label }
  //   shade: { f, a, b, color } fills between the curve and y = 0 from a to b
  function draw(ctx, width, height, view, curves, colors, traceX, shade) {
    const b = bounds(view, width, height);
    const X = (x) => (x - b.xmin) / view.sx;
    // Keep far-off points finite for the canvas.
    const Y = (y) => Math.min(Math.max((b.ymax - y) / view.sy, -10 * height), 11 * height);
    const crisp = (v) => Math.round(v) + 0.5;

    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, width, height);

    const tx = ticks(b.xmin, b.xmax, Math.max(2, Math.floor(width / 70)));
    const ty = ticks(b.ymin, b.ymax, Math.max(2, Math.floor(height / 50)));

    // Grid: thin and quiet so the curves stand out.
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.grid;
    ctx.beginPath();
    for (const x of tx.values) {
      ctx.moveTo(crisp(X(x)), 0);
      ctx.lineTo(crisp(X(x)), height);
    }
    for (const y of ty.values) {
      ctx.moveTo(0, crisp(Y(y)));
      ctx.lineTo(width, crisp(Y(y)));
    }
    ctx.stroke();

    // Axes, or the nearest edge when an axis is off screen.
    const axisX = Math.min(Math.max(X(0), 0), width - 1);
    const axisY = Math.min(Math.max(Y(0), 0), height - 1);
    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    if (X(0) >= 0 && X(0) <= width) {
      ctx.moveTo(crisp(axisX), 0);
      ctx.lineTo(crisp(axisX), height);
    }
    if (Y(0) >= 0 && Y(0) <= height) {
      ctx.moveTo(0, crisp(axisY));
      ctx.lineTo(width, crisp(axisY));
    }
    ctx.stroke();

    // Tick labels beside the axes, kept inside the canvas.
    ctx.fillStyle = colors.label;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelY = Math.min(Math.max(axisY + 4, 2), height - 14);
    for (const x of tx.values) {
      if (x === 0) continue;
      const px = X(x);
      if (px < 12 || px > width - 12) continue;
      ctx.fillText(label(x, tx.step), px, labelY);
    }
    const right = axisX > width - 40;
    ctx.textAlign = right ? "right" : "left";
    ctx.textBaseline = "middle";
    const labelX = right ? axisX - 4 : Math.max(axisX + 4, 2);
    for (const y of ty.values) {
      if (y === 0) continue;
      const py = Y(y);
      if (py < 8 || py > height - 8) continue;
      ctx.fillText(label(y, ty.step), labelX, py);
    }

    // Shaded area for ∫dx, under the curves.
    if (shade) {
      const lo = Math.min(shade.a, shade.b);
      const hi = Math.max(shade.a, shade.b);
      const n = Math.max(2, Math.ceil(Math.abs(X(hi) - X(lo))));
      ctx.beginPath();
      ctx.moveTo(X(lo), Y(0));
      for (let i = 0; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        const y = shade.f(x);
        ctx.lineTo(X(x), Y(Number.isFinite(y) ? y : 0));
      }
      ctx.lineTo(X(hi), Y(0));
      ctx.closePath();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = shade.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Curves: one sample per pixel.
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const curve of curves) {
      ctx.strokeStyle = curve.color;
      ctx.beginPath();
      for (const piece of sample(curve.f, b.xmin, b.xmax, Math.ceil(width), b.ymax - b.ymin)) {
        piece.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      }
      ctx.stroke();
    }

    // Trace: a dashed line at x and a dot on each curve.
    if (traceX !== null && traceX !== undefined) {
      const px = X(traceX);
      ctx.strokeStyle = colors.axis;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(crisp(px), 0);
      ctx.lineTo(crisp(px), height);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const curve of curves) {
        const y = curve.f(traceX);
        if (!Number.isFinite(y)) continue;
        const py = Y(y);
        if (py < -5 || py > height + 5) continue;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, 2 * Math.PI);
        ctx.fillStyle = curve.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.surface;
        ctx.stroke();
      }
    }
  }

  const Graph = {
    standardView,
    trigView,
    bounds,
    zoom,
    pan,
    niceStep,
    ticks,
    label,
    sample,
    draw,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Graph;
  } else {
    root.Graph = Graph;
  }
})(typeof window !== "undefined" ? window : globalThis);
