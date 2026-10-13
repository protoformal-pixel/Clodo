// Graph mode: y1–y3 typed like the display, the plot with pan, zoom and
// trace, G-Solv (roots, extremes, intersections, ∫dx) and the table.
(function () {
  "use strict";

  const UI = window.CalculatorUI;
  const C = window.Calculator;
  const G = window.Graph;
  const K = window.Calculus;
  const { settings } = UI;

  const graphEl = document.getElementById("graph");
  const fnList = document.getElementById("fn-list");
  const fnTools = document.getElementById("fn-tools");
  const plotEl = document.getElementById("plot");
  const canvas = document.getElementById("graph-canvas");
  const traceEl = document.getElementById("trace");
  const tableWrap = document.getElementById("table-wrap");
  const tableEl = document.getElementById("value-table");
  const tableToggle = document.getElementById("table-toggle");
  const graphAngleBtn = document.getElementById("graph-angle");
  const gsolvEl = document.getElementById("gsolv");
  const solveResultEl = document.getElementById("solve-result");

  const GRAPH_KEY = "calculator-graph";
  const FUNCTION_COUNT = 3;

  let graph = loadGraph(); // { editors, hidden, view, table, data, fitData }
  let editing = null; // index of the function being typed, or null
  let traceX = null; // x of the trace line, or null
  // G-Solv in progress: { kind, target, index } for root/min/max/isect, or
  // { kind: "integral", target, a, b, value } for ∫dx. null when idle.
  let solving = null;

  function loadGraph() {
    const saved = UI.load(GRAPH_KEY) || {};
    const isTokens = (t) => Array.isArray(t) && t.every((x) => typeof x === "string");
    const functions = Array.isArray(saved.functions) ? saved.functions : [];
    const v = saved.view;
    const validView =
      v && ["cx", "cy", "sx", "sy"].every((k) => Number.isFinite(v[k])) && v.sx > 0 && v.sy > 0;
    return {
      editors: Array.from({ length: FUNCTION_COUNT }, (_, i) => ({
        ...C.createState(),
        tokens: isTokens(functions[i]) ? functions[i] : [],
      })),
      hidden: Array.from({ length: FUNCTION_COUNT }, (_, i) => saved.hidden?.[i] === true),
      view: validView ? v : null,
      table: saved.table === true,
      data: saved.data === true, // show the statistics data points
      fitData: false, // zoom to the data points on the next draw
    };
  }

  function saveGraph() {
    UI.save(GRAPH_KEY, {
      functions: graph.editors.map((e) => e.tokens),
      hidden: graph.hidden,
      view: graph.view,
      table: graph.table,
      data: graph.data,
    });
  }

  // ---------------------------------------------------------------------
  // What the other screens use

  UI.graphTyping = function () {
    return editing !== null;
  };

  UI.cancelGraphTyping = function () {
    editing = null;
  };

  UI.stopEditing = function () {
    stopEditing();
  };

  // Close G-Solv. False if it was not open.
  UI.closeSolve = function () {
    if (!solving) return false;
    solving = null;
    renderGraph();
    return true;
  };

  // The parts of the screen that depend on whether a function is typed.
  UI.renderGraphModes = function () {
    fnTools.hidden = editing === null;
    plotEl.hidden = editing !== null;
    graphAngleBtn.textContent = settings.angle === "deg" ? "Deg" : "Rad";
    tableToggle.setAttribute("aria-pressed", graph.table);
  };

  // Zoom to the statistics data the next time the graph is drawn.
  UI.fitDataNextDraw = function () {
    graph.fitData = true;
  };

  // Show a fitted curve from statistics: in the first free y (or y3), with
  // the data points, zoomed to the data.
  UI.plotFit = function (tokens) {
    let slot = graph.editors.findIndex((e) => !e.tokens.length);
    if (slot < 0) slot = graph.editors.length - 1;
    graph.editors[slot] = { ...C.createState(), tokens };
    graph.hidden[slot] = false;
    graph.data = true;
    graph.fitData = true;
    solving = null;
    traceX = null;
    saveGraph();
    UI.setMode("graph");
  };

  // ---------------------------------------------------------------------
  // Graph mode

  // The function as something to plot: f(x), or an error message.
  function compile(i) {
    const { tokens } = graph.editors[i];
    if (!tokens.length) return null;
    try {
      const tree = C.parse(tokens);
      const env = UI.calcEnv();
      return {
        f(x) {
          try {
            return C.evaluate(tree, { ...env, x });
          } catch {
            return NaN; // undefined here, e.g. √x for x < 0
          }
        },
      };
    } catch (e) {
      if (!e.calcError) throw e;
      return { error: e.calcError };
    }
  }

  function seriesColor(i) {
    return `var(--series-${i + 1})`;
  }

  function renderFunctions() {
    fnList.replaceChildren(
      ...graph.editors.map((editor, i) => {
        const row = document.createElement("li");
        row.className = "fn-row";
        row.classList.toggle("is-editing", editing === i);
        row.style.setProperty("--fn-color", seriesColor(i));

        const swatch = document.createElement("button");
        swatch.className = "fn-swatch";
        swatch.dataset.toggle = i;
        swatch.setAttribute("aria-pressed", !graph.hidden[i]);
        swatch.setAttribute("aria-label", `Show y${i + 1} on the graph`);
        swatch.title = "Show or hide";

        const name = UI.span(`y${i + 1} =`, "fn-name");
        const expr = document.createElement("div");
        expr.className = "fn-expr";
        expr.dataset.fn = i;
        if (editor.tokens.length || editing === i) {
          UI.renderTokens(expr, editor.tokens, editor.cursor, editing === i);
        } else {
          expr.append(UI.span("Tap to enter a function of x", "placeholder"));
        }
        row.append(swatch, name, expr);

        const compiled = editing === i ? null : compile(i);
        if (compiled?.error) row.append(UI.span(compiled.error, "fn-error"));
        return row;
      }),
      ...dataRow()
    );
  }

  // A row for the statistics data points, when there are any.
  function dataRow() {
    const pairs = UI.statPairs();
    if (!pairs.length) return [];
    const row = document.createElement("li");
    row.className = "fn-row data-row";
    row.style.setProperty("--fn-color", "var(--key-text)");
    const swatch = document.createElement("button");
    swatch.className = "fn-swatch is-round";
    swatch.dataset.toggle = "data";
    swatch.setAttribute("aria-pressed", graph.data);
    swatch.setAttribute("aria-label", "Show the data points on the graph");
    swatch.title = "Show or hide";
    row.append(swatch, UI.span("Stat data", "fn-name"), UI.span(`${pairs.length} points`, "fn-expr muted"));
    return [row];
  }

  function curves() {
    const list = [];
    graph.editors.forEach((_, i) => {
      if (graph.hidden[i]) return;
      const compiled = compile(i);
      if (compiled?.f) list.push({ i, f: compiled.f });
    });
    return list;
  }

  function size() {
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  let drawPending = false;
  function scheduleDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      drawPlot();
    });
  }

  function drawPlot() {
    if (graphEl.hidden || plotEl.hidden) return;
    const { width, height } = size();
    if (!width || !height) return;
    if (!graph.view) graph.view = G.standardView(width);
    const pairs = UI.statPairs();
    if (graph.fitData) {
      graph.fitData = false;
      if (pairs.length) graph.view = fitView(pairs, width, height);
      saveGraph();
    }
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const css = getComputedStyle(document.documentElement);
    const color = (name) => css.getPropertyValue(name).trim();
    const shown = curves().map((c) => ({ f: c.f, color: color(`--series-${c.i + 1}`), i: c.i }));
    const target = solving && shown.find((c) => c.i === solving.target);
    const shade =
      target && solving.kind === "integral" && solving.b !== null
        ? { f: target.f, a: solving.a, b: solving.b, color: target.color }
        : null;
    G.draw(ctx, width, height, graph.view, shown, {
      surface: color("--panel"),
      grid: color("--graph-grid"),
      axis: color("--graph-axis"),
      label: color("--muted"),
    }, traceX, shade, graph.data && pairs.length ? { list: pairs, color: color("--key-text") } : null);
    renderSolve(shown);
    renderTrace(shown);
    renderTable(shown);
  }

  // The values at the trace line, under the graph. Text stays in the text
  // colour; a coloured dot says which curve it is.
  function renderTrace(shown) {
    if (traceX === null) {
      traceEl.replaceChildren(
        UI.span("Tap to trace · drag to move · pinch or scroll to zoom")
      );
      return;
    }
    const { xs, ys } = viewSpans();
    const parts = [UI.span(`x = `), UI.span(tidy(traceX, xs), "val")];
    for (const c of shown) {
      const y = c.f(traceX);
      const item = UI.span("", "trace-item");
      const dot = UI.span("", "dot");
      dot.style.setProperty("--fn-color", seriesColor(c.i));
      item.append(dot, UI.span(`y${c.i + 1} = `), UI.span(Number.isFinite(y) ? tidy(y, ys) : "—", "val"));
      parts.push(item);
    }
    traceEl.replaceChildren(...parts);
  }

  // A table of values at the grid lines currently in view.
  function renderTable(shown) {
    tableWrap.hidden = !graph.table;
    if (!graph.table) return;
    const { width, height } = size();
    const b = G.bounds(graph.view, width, height);
    const xs = G.ticks(b.xmin, b.xmax, 10);
    const head = document.createElement("tr");
    head.append(Object.assign(document.createElement("th"), { textContent: "x" }));
    for (const c of shown) {
      const th = document.createElement("th");
      const dot = UI.span("", "dot");
      dot.style.setProperty("--fn-color", seriesColor(c.i));
      th.append(dot, `y${c.i + 1}`);
      head.append(th);
    }
    const rows = xs.values.map((x) => {
      const tr = document.createElement("tr");
      const cells = [G.label(x, xs.step), ...shown.map((c) => {
        const y = c.f(x);
        return Number.isFinite(y) ? tidy(y, b.ymax - b.ymin) : "—";
      })];
      for (const text of cells) {
        tr.append(Object.assign(document.createElement("td"), { textContent: text }));
      }
      return tr;
    });
    tableEl.replaceChildren(head, ...rows);
  }

  function renderGraph() {
    if (graphEl.hidden) return;
    renderFunctions();
    scheduleDraw();
  }

  function startEditing(i) {
    editing = i;
    UI.renderModes();
    renderGraph();
  }

  function stopEditing() {
    editing = null;
    solving = null; // the functions may have changed
    saveGraph();
    UI.renderModes();
    renderGraph();
  }

  // Keys while a function is being typed go to that function.
  UI.editFunction = function (action, value) {
    const editor = graph.editors[editing];
    let next = editor;
    switch (action) {
      case "insert":
        next = C.insert(editor, value);
        break;
      case "recall":
        next = C.insertNumber(editor, value);
        break;
      case "backspace":
        next = C.backspace(editor);
        break;
      case "clear":
        next = { ...editor, tokens: [], cursor: null };
        break;
      case "cursor":
        next = C.moveCursor(editor, value);
        break;
      case "setCursor":
        next = C.setCursor(editor, value);
        break;
      case "equals":
        return stopEditing();
    }
    graph.editors[editing] = next;
    saveGraph();
    renderFunctions();
  };

  fnList.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-toggle]");
    if (swatch?.dataset.toggle === "data") {
      graph.data = !graph.data;
      saveGraph();
      return renderGraph();
    }
    if (swatch) {
      const i = Number(swatch.dataset.toggle);
      graph.hidden[i] = !graph.hidden[i];
      saveGraph();
      return renderGraph();
    }
    const expr = event.target.closest("[data-fn]");
    if (!expr) return;
    const i = Number(expr.dataset.fn);
    if (editing !== i) return startEditing(i);
    UI.handle("setCursor", UI.tapIndex(expr, event, graph.editors[i].tokens.length));
  });

  fnTools.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.id === "fn-done") stopEditing();
    else if (btn.id === "fn-backspace") UI.handle("backspace");
    else UI.pressKey(btn);
  });

  // Drag to pan, pinch to zoom, tap to trace.
  const pointers = new Map();
  let moved = false;

  function canvasPoint(event) {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, canvasPoint(event));
    moved = pointers.size > 1;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const { width, height } = size();
    const before = [...pointers.values()];
    const point = canvasPoint(event);
    const last = pointers.get(event.pointerId);
    pointers.set(event.pointerId, point);
    if (pointers.size === 1) {
      if (!moved && Math.hypot(point.x - last.x, point.y - last.y) < 4) {
        pointers.set(event.pointerId, last); // too small to count as a drag yet
        return;
      }
      moved = true;
      graph.view = G.pan(graph.view, point.x - last.x, point.y - last.y);
    } else if (pointers.size === 2) {
      const after = [...pointers.values()];
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const m0 = mid(before[0], before[1]);
      const m1 = mid(after[0], after[1]);
      const factor = dist(before[0], before[1]) / Math.max(dist(after[0], after[1]), 1);
      graph.view = G.pan(graph.view, m1.x - m0.x, m1.y - m0.y);
      graph.view = G.zoom(graph.view, factor, m1.x, m1.y, width, height);
    }
    scheduleDraw();
  });

  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    if (!moved && pointers.size === 1) {
      const { width, height } = size();
      const b = G.bounds(graph.view, width, height);
      traceX = snap(b.xmin + canvasPoint(event).x * graph.view.sx);
      if (solving?.kind === "integral" && solving.b === null) setLimit(traceX);
      scheduleDraw();
    }
    pointers.delete(event.pointerId);
    if (!pointers.size) saveGraph();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const { width, height } = size();
      const point = canvasPoint(event);
      graph.view = G.zoom(graph.view, Math.exp(event.deltaY * 0.002), point.x, point.y, width, height);
      scheduleDraw();
      saveGraph();
    },
    { passive: false }
  );

  function zoomCentre(factor) {
    const { width, height } = size();
    graph.view = G.zoom(graph.view, factor, width / 2, height / 2, width, height);
    saveGraph();
    scheduleDraw();
  }

  document.getElementById("zoom-in").addEventListener("click", () => zoomCentre(0.5));
  document.getElementById("zoom-out").addEventListener("click", () => zoomCentre(2));
  document.getElementById("zoom-std").addEventListener("click", () => {
    graph.view = G.standardView(size().width);
    saveGraph();
    scheduleDraw();
  });
  document.getElementById("zoom-trig").addEventListener("click", () => {
    const { width, height } = size();
    graph.view = G.trigView(width, height, settings.angle);
    saveGraph();
    scheduleDraw();
  });
  graphAngleBtn.addEventListener("click", () => {
    settings.angle = settings.angle === "deg" ? "rad" : "deg";
    UI.saveSettings();
    UI.renderModes();
    renderGraph();
  });
  tableToggle.addEventListener("click", () => {
    graph.table = !graph.table;
    saveGraph();
    UI.renderModes();
    scheduleDraw();
  });

  new ResizeObserver(scheduleDraw).observe(canvas);

  // ---------------------------------------------------------------------
  // G-Solv: roots, minimums, maximums, intersections and ∫dx on the graph.

  // Taps land on round numbers about every 10 pixels, so x = 1 is easy to hit.
  function snap(x) {
    const step = G.niceStep(graph.view.sx * size().width, size().width / 10);
    return Number((Math.round(x / step) * step).toPrecision(12));
  }

  // Text for a value, with floating point noise far below what the view can
  // show (like 4e-16 at a root) written as 0. span: the view's width or height.
  function tidy(value, span) {
    return G.label(Math.abs(value) < span * 1e-7 ? 0 : value);
  }

  function viewSpans() {
    const { width, height } = size();
    return { xs: graph.view.sx * width, ys: graph.view.sy * height };
  }

  function nextShown(shown, i) {
    const at = shown.findIndex((c) => c.i === i);
    return shown[(at + 1) % shown.length];
  }

  // The x values the current G-Solv finds in view, left to right.
  function solveResults(shown) {
    const { width, height } = size();
    const { xmin, xmax } = G.bounds(graph.view, width, height);
    const target = shown.find((c) => c.i === solving.target);
    if (solving.kind === "root") return K.roots(target.f, xmin, xmax);
    if (solving.kind === "min" || solving.kind === "max") {
      return K.extrema(target.f, xmin, xmax, solving.kind).map((p) => p.x);
    }
    const other = nextShown(shown, solving.target);
    return K.roots((x) => target.f(x) - other.f(x), xmin, xmax);
  }

  function startSolve(kind) {
    const shown = curves();
    if (!shown.length) {
      solving = { kind, target: null, message: "Enter a function first" };
      return renderGraph();
    }
    const keepTarget = solving && shown.some((c) => c.i === solving.target);
    const target = keepTarget ? solving.target : shown[0].i;
    if (kind === "integral") {
      solving = { kind, target, a: null, b: null };
    } else if (solving?.kind === kind && solving.target === target && solving.found > 1) {
      solving = { ...solving, index: solving.index + 1 }; // pressed again: the next one
    } else {
      solving = { kind, target, index: 0 };
    }
    runSolve(shown);
  }

  function runSolve(shown) {
    if (solving.kind === "integral") {
      if (solving.b !== null) {
        const target = shown.find((c) => c.i === solving.target);
        solving.value = K.integrate(target.f, solving.a, solving.b);
      }
      return renderGraph();
    }
    if (solving.kind === "isect" && shown.length < 2) {
      solving.message = "Isect needs two functions on the graph";
      return renderGraph();
    }
    const xs = solveResults(shown);
    solving.found = xs.length;
    solving.message = xs.length ? null : "None in view: move or zoom out";
    if (xs.length) {
      solving.index %= xs.length;
      traceX = xs[solving.index];
    }
    renderGraph();
  }

  function setLimit(x) {
    if (solving.a === null) solving.a = x;
    else {
      solving.b = x;
      runSolve(curves());
    }
  }

  function switchTarget() {
    const shown = curves();
    if (shown.length < 2 || !solving) return;
    solving.target = nextShown(shown, solving.target).i;
    solving.index = 0;
    if (solving.kind === "integral" && solving.b === null) return renderGraph();
    runSolve(shown);
  }

  const SOLVE_NAMES = { root: "Root", min: "Min", max: "Max", isect: "Intersection" };

  // One line above the trace: what was found, on which curve. Tap the
  // curve's name to switch to another function.
  function renderSolve(shown) {
    gsolvEl.querySelectorAll("[data-solve]").forEach((btn) => {
      btn.setAttribute("aria-pressed", solving?.kind === btn.dataset.solve);
    });
    solveResultEl.hidden = !solving;
    if (!solving) return;
    const target = shown.find((c) => c.i === solving.target);
    const name = (c) => {
      const el = UI.span("", "trace-item");
      const dot = UI.span("", "dot");
      dot.style.setProperty("--fn-color", seriesColor(c.i));
      el.append(dot, `y${c.i + 1}`);
      return el;
    };
    const parts = [];
    if (target) {
      const chooser = document.createElement("button");
      chooser.className = "solve-target";
      chooser.title = "Switch function";
      chooser.append(name(target));
      if (solving.kind === "isect" && shown.length > 1) {
        chooser.append(" ∩ ", name(nextShown(shown, target.i)));
      }
      parts.push(chooser);
    }
    if (solving.message || !target) {
      parts.push(UI.span(solving.message || "Enter or show a function first", "solve-note"));
    } else if (solving.kind === "integral") {
      if (solving.a === null) parts.push(UI.span("∫dx: tap the lower limit", "solve-note"));
      else if (solving.b === null) {
        parts.push(UI.span(`∫dx from ${G.label(solving.a)}: tap the upper limit`, "solve-note"));
      } else {
        const value = Number.isFinite(solving.value) ? G.label(solving.value) : "Math Error";
        parts.push(
          UI.span(`∫ from ${G.label(solving.a)} to ${G.label(solving.b)} = `),
          UI.span(value, "val")
        );
      }
    } else {
      const y = target.f(traceX);
      const { xs, ys } = viewSpans();
      parts.push(
        UI.span(`${SOLVE_NAMES[solving.kind]}: x = `),
        UI.span(tidy(traceX, xs), "val"),
        UI.span(", y = "),
        UI.span(Number.isFinite(y) ? tidy(y, ys) : "—", "val")
      );
      if (solving.found > 1) {
        parts.push(UI.span(`${solving.index + 1} of ${solving.found}, tap again for the next`, "solve-note"));
      }
    }
    const close = document.createElement("button");
    close.className = "solve-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    parts.push(close);
    solveResultEl.replaceChildren(...parts);
  }

  gsolvEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-solve]");
    if (btn) startSolve(btn.dataset.solve);
  });

  solveResultEl.addEventListener("click", (event) => {
    if (event.target.closest(".solve-close")) {
      solving = null;
      renderGraph();
    } else if (event.target.closest(".solve-target")) switchTarget();
  });

  // Arrow keys move the trace line one pixel's worth; + and − zoom.
  // True if the key was used.
  UI.graphKey = function (key) {
    const { width, height } = size();
    const b = G.bounds(graph.view, width, height);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (traceX === null) traceX = (b.xmin + b.xmax) / 2;
      traceX += (key === "ArrowLeft" ? -1 : 1) * graph.view.sx;
      scheduleDraw();
    } else if (key === "+") zoomCentre(0.5);
    else if (key === "-") zoomCentre(2);
    else if (key === "Escape" && solving) {
      solving = null;
      renderGraph();
    } else return false;
    return true;
  };

  // A view showing every point with a little room around them.
  function fitView(pairs, width, height) {
    const range = (values) => {
      let lo = Math.min(...values);
      let hi = Math.max(...values);
      if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
      const pad = (hi - lo) * 0.15;
      return [lo - pad, hi + pad];
    };
    const [xmin, xmax] = range(pairs.map((p) => p[0]));
    const [ymin, ymax] = range(pairs.map((p) => p[1]));
    return {
      cx: (xmin + xmax) / 2,
      cy: (ymin + ymax) / 2,
      sx: (xmax - xmin) / width,
      sy: (ymax - ymin) / height,
    };
  }

  UI.renderGraph = renderGraph;
})();
