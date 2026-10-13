// Wires the calculator logic to the page: buttons and keyboard.
(function () {
  "use strict";

  const C = window.Calculator;
  const G = window.Graph;
  const K = window.Calculus;
  const displayEl = document.getElementById("display");
  const backspaceBtn = document.getElementById("backspace");
  const sdBtn = document.getElementById("sd");
  const expressionEl = document.getElementById("expression");
  const previewEl = document.getElementById("preview");
  const modeEl = document.getElementById("mode");
  const sciEl = document.getElementById("sci");
  const sciToggle = document.getElementById("sci-toggle");
  const historyEl = document.getElementById("history");
  const historyToggle = document.getElementById("history-toggle");
  const invBtn = document.getElementById("inv");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const clearHistoryBtn = document.getElementById("clear-history");
  const stoBtn = document.getElementById("sto");
  const clearMemoryBtn = document.getElementById("clear-memory");
  const screenEl = document.getElementById("screen");
  const keysEl = document.querySelector(".keys");
  const graphEl = document.getElementById("graph");
  const graphToggle = document.getElementById("graph-toggle");
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
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", root: "ʸ√" };
  const HISTORY_KEY = "calculator-history";
  const SETTINGS_KEY = "calculator-settings";
  const MEMORY_KEY = "calculator-memory";
  const GRAPH_KEY = "calculator-graph";
  const FUNCTION_COUNT = 3;
  let state = C.createState(0, loadMemory());
  let history = loadHistory();
  let settings = loadSettings(); // { sci, history: boolean, angle: "deg" | "rad" }
  let inverse = false;
  let storing = false; // STO pressed, waiting for a letter
  // Graph mode: y1–y3, each edited like the main display.
  let graph = loadGraph(); // { editors, hidden, view, table }
  let editing = null; // index of the function being typed, or null
  let traceX = null; // x of the trace line, or null
  // G-Solv in progress: { kind, target, index } for root/min/max/isect, or
  // { kind: "integral", target, a, b, value } for ∫dx. null when idle.
  let solving = null;

  // History and settings are kept in this browser only. Storage can be
  // unavailable (e.g. private browsing), so every access is guarded.
  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved; everything still works until the page is closed.
    }
  }

  function loadHistory() {
    const saved = load(HISTORY_KEY);
    return Array.isArray(saved) ? saved.slice(0, C.HISTORY_LIMIT) : [];
  }

  // Stored values survive closing the app, as on a real calculator.
  function loadMemory() {
    const saved = load(MEMORY_KEY) || {};
    return Object.fromEntries(
      C.VARIABLES.filter((name) => Number.isFinite(saved[name])).map((name) => [name, saved[name]])
    );
  }

  function loadSettings() {
    const saved = load(SETTINGS_KEY) || {};
    return {
      sci: saved.sci === true,
      history: saved.history === true,
      graph: saved.graph === true,
      angle: saved.angle === "rad" ? "rad" : "deg",
      // How answers are shown: "dec" 3.5, "frac" 7/2 or "mixed" 3 1/2.
      fraction: ["frac", "mixed"].includes(saved.fraction) ? saved.fraction : "dec",
    };
  }

  function loadGraph() {
    const saved = load(GRAPH_KEY) || {};
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
    };
  }

  function saveGraph() {
    save(GRAPH_KEY, {
      functions: graph.editors.map((e) => e.tokens),
      hidden: graph.hidden,
      view: graph.view,
      table: graph.table,
    });
  }

  // History saved by earlier versions used " * " style text.
  function prettify(expression) {
    return expression.replace(
      / (\+|-|\*|\/|\^|root) /g,
      (_, op) => ` ${symbols[op]} `
    );
  }

  // With Inv on, keys such as sin type their inverse (sin⁻¹).
  function tokenOf(btn) {
    return (inverse && btn.dataset.invInsert) || btn.dataset.insert;
  }

  function span(text, className) {
    const el = document.createElement("span");
    el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function renderHistory() {
    historyList.replaceChildren(
      ...history.map((entry) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "history-entry";
        btn.dataset.result = entry.result;
        btn.title = "Use this result";
        const expr = document.createElement("span");
        expr.className = "history-expression";
        expr.textContent = prettify(entry.expression) + " =";
        const result = document.createElement("span");
        result.className = "history-result";
        result.textContent = entry.result;
        btn.append(expr, result);
        li.append(btn);
        return li;
      })
    );
    historyEmpty.hidden = history.length > 0;
    clearHistoryBtn.hidden = history.length === 0;
  }

  function renderModes() {
    // In Graph mode the keypad only shows while a function is being typed.
    const graphMode = settings.graph;
    const keypad = !graphMode || editing !== null;
    graphEl.hidden = !graphMode;
    screenEl.hidden = graphMode;
    keysEl.hidden = !keypad;
    fnTools.hidden = editing === null;
    plotEl.hidden = editing !== null;
    graphToggle.setAttribute("aria-pressed", graphMode);
    graphAngleBtn.textContent = settings.angle === "deg" ? "Deg" : "Rad";
    tableToggle.setAttribute("aria-pressed", graph.table);
    sciEl.hidden = !settings.sci || !keypad;
    sciToggle.setAttribute("aria-pressed", settings.sci);
    historyEl.hidden = !settings.history || graphMode;
    historyToggle.hidden = graphMode;
    historyToggle.setAttribute("aria-pressed", settings.history);
    invBtn.setAttribute("aria-pressed", inverse);
    document.querySelectorAll("[data-angle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.angle === settings.angle);
    });
    document.querySelectorAll("[data-inv-label]").forEach((btn) => {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent.trim();
      btn.textContent = inverse ? btn.dataset.invLabel : btn.dataset.label;
    });
    stoBtn.setAttribute("aria-pressed", storing);
    sciEl.classList.toggle("is-storing", storing);
    const scientific = settings.sci || graphMode;
    modeEl.textContent = [
      scientific && settings.angle.toUpperCase(),
      scientific && inverse && "INV",
      scientific && storing && "STO",
      !graphMode && { frac: "FRAC", mixed: "MIXED" }[settings.fraction],
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Shrink long text so it stays on one line, down to half size.
  function fit(el, length) {
    el.style.fontSize = length > 10 ? `${Math.max(1.5, (3 * 10) / length)}rem` : "";
  }

  // Each letter key shows its value in small print.
  function renderMemory() {
    let any = false;
    for (const name of C.VARIABLES) {
      const value = state.memory[name];
      any ||= value !== 0;
      const short = C.format(Number(value.toPrecision(4)));
      document.querySelector(`[data-var="${name}"] .var-value`).textContent = short;
    }
    clearMemoryBtn.hidden = !any;
  }

  // An answer like 7/2 or −3 1/2 is shown as a stacked fraction.
  function resultParts(text) {
    const m = text.match(/^(-?)(?:(\d+) )?(\d+)\/(\d+)$/);
    if (!m) return [span(text)];
    const [, minus, whole, n, d] = m;
    const frac = span("", "frac");
    frac.append(span(n, "num"), span(d, "den"));
    frac.setAttribute("aria-label", `${n} over ${d}`);
    return [minus && span("−"), whole && span(whole, "whole"), frac].filter(Boolean);
  }

  // S⇔D: decimal → fraction → mixed number → decimal. The choice is kept
  // for later answers too.
  function switchFraction() {
    const order = ["dec", "frac", "mixed"];
    settings.fraction = order[(order.indexOf(settings.fraction) + 1) % order.length];
    save(SETTINGS_KEY, settings);
    state = C.restyle(state, settings.fraction);
    renderModes();
    render();
  }

  function render() {
    renderMemory();
    if (state.result !== null) {
      // After "=": the expression above, the answer big.
      expressionEl.textContent = state.resultExpression + " =";
      displayEl.replaceChildren(...resultParts(state.result));
      displayEl.classList.add("is-result");
      fit(displayEl, state.result.length);
      previewEl.textContent = "";
      previewEl.classList.remove("is-error");
      return;
    }

    // Typing: one span per token, so a tap can tell where it landed.
    expressionEl.textContent = "";
    displayEl.classList.remove("is-result");
    const parts = state.tokens.map((token, i) => {
      const el = span(C.tokenText(token));
      el.dataset.index = i;
      return el;
    });
    if (parts.length) {
      const at = state.cursor === null ? parts.length : state.cursor;
      parts.splice(at, 0, span("", "caret"));
    } else {
      parts.push(span("0", "placeholder"));
    }
    displayEl.replaceChildren(...parts);
    fit(displayEl, C.toText(state.tokens).length);

    const preview = C.preview(state, settings.angle, settings.fraction);
    previewEl.textContent = state.error || (preview === null ? "" : "= " + preview);
    previewEl.classList.toggle("is-error", Boolean(state.error));
  }

  function handle(action, value) {
    if (editing !== null) return editFunction(action, value);
    switch (action) {
      case "insert":
        state = C.insert(state, value);
        break;
      case "equals":
        state = C.equals(state, settings.angle, settings.fraction);
        if (state.completed) {
          history = C.addToHistory(history, state.completed);
          save(HISTORY_KEY, history);
          renderHistory();
        }
        break;
      case "clear":
        state = C.clear(state);
        break;
      case "backspace":
        state = C.backspace(state);
        break;
      case "cursor":
        state = C.moveCursor(state, value);
        break;
      case "setCursor":
        state = C.setCursor(state, value);
        break;
      case "recall":
        state = C.insertNumber(state, value);
        break;
      case "store":
        state = C.store(state, value, settings.angle, settings.fraction);
        save(MEMORY_KEY, state.memory);
        if (state.completed) {
          history = C.addToHistory(history, state.completed);
          save(HISTORY_KEY, history);
          renderHistory();
        }
        break;
    }
    render();
  }

  // ---------------------------------------------------------------------
  // Graph mode

  // The function as something to plot: f(x), or an error message.
  function compile(i) {
    const { tokens } = graph.editors[i];
    if (!tokens.length) return null;
    try {
      const tree = C.parse(tokens);
      const env = { angle: settings.angle, ans: state.ans, memory: state.memory };
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

  // Tokens as spans, with the caret when editing.
  function renderTokens(el, tokens, cursor, withCaret) {
    const parts = tokens.map((token, i) => {
      const part = span(C.tokenText(token));
      part.dataset.index = i;
      return part;
    });
    if (withCaret) parts.splice(cursor === null ? parts.length : cursor, 0, span("", "caret"));
    el.replaceChildren(...parts);
  }

  // Which gap between tokens a tap landed in.
  function tapIndex(el, event, length) {
    const part = event.target.closest("[data-index]");
    if (part) {
      const box = part.getBoundingClientRect();
      return Number(part.dataset.index) + (event.clientX > box.left + box.width / 2 ? 1 : 0);
    }
    const first = el.querySelector("[data-index]");
    return first && event.clientX < first.getBoundingClientRect().left ? 0 : length;
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

        const name = span(`y${i + 1} =`, "fn-name");
        const expr = document.createElement("div");
        expr.className = "fn-expr";
        expr.dataset.fn = i;
        if (editor.tokens.length || editing === i) {
          renderTokens(expr, editor.tokens, editor.cursor, editing === i);
        } else {
          expr.append(span("Tap to enter a function of x", "placeholder"));
        }
        row.append(swatch, name, expr);

        const compiled = editing === i ? null : compile(i);
        if (compiled?.error) row.append(span(compiled.error, "fn-error"));
        return row;
      })
    );
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
    }, traceX, shade);
    renderSolve(shown);
    renderTrace(shown);
    renderTable(shown);
  }

  // The values at the trace line, under the graph. Text stays in the text
  // colour; a coloured dot says which curve it is.
  function renderTrace(shown) {
    if (traceX === null) {
      traceEl.replaceChildren(
        span("Tap to trace · drag to move · pinch or scroll to zoom")
      );
      return;
    }
    const { xs, ys } = viewSpans();
    const parts = [span(`x = `), span(tidy(traceX, xs), "val")];
    for (const c of shown) {
      const y = c.f(traceX);
      const item = span("", "trace-item");
      const dot = span("", "dot");
      dot.style.setProperty("--fn-color", seriesColor(c.i));
      item.append(dot, span(`y${c.i + 1} = `), span(Number.isFinite(y) ? tidy(y, ys) : "—", "val"));
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
      const dot = span("", "dot");
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
    renderModes();
    renderGraph();
  }

  function stopEditing() {
    editing = null;
    solving = null; // the functions may have changed
    saveGraph();
    renderModes();
    renderGraph();
  }

  // Keys while a function is being typed go to that function.
  function editFunction(action, value) {
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
  }

  graphToggle.addEventListener("click", () => {
    settings.graph = !settings.graph;
    save(SETTINGS_KEY, settings);
    editing = null;
    renderModes();
    renderGraph();
  });

  fnList.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-toggle]");
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
    handle("setCursor", tapIndex(expr, event, graph.editors[i].tokens.length));
  });

  fnTools.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.id === "fn-done") stopEditing();
    else if (btn.id === "fn-backspace") handle("backspace");
    else pressKey(btn);
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
    save(SETTINGS_KEY, settings);
    renderModes();
    renderGraph();
  });
  tableToggle.addEventListener("click", () => {
    graph.table = !graph.table;
    saveGraph();
    renderModes();
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
      const el = span("", "trace-item");
      const dot = span("", "dot");
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
      parts.push(span(solving.message || "Enter or show a function first", "solve-note"));
    } else if (solving.kind === "integral") {
      if (solving.a === null) parts.push(span("∫dx: tap the lower limit", "solve-note"));
      else if (solving.b === null) {
        parts.push(span(`∫dx from ${G.label(solving.a)}: tap the upper limit`, "solve-note"));
      } else {
        const value = Number.isFinite(solving.value) ? G.label(solving.value) : "Math Error";
        parts.push(
          span(`∫ from ${G.label(solving.a)} to ${G.label(solving.b)} = `),
          span(value, "val")
        );
      }
    } else {
      const y = target.f(traceX);
      const { xs, ys } = viewSpans();
      parts.push(
        span(`${SOLVE_NAMES[solving.kind]}: x = `),
        span(tidy(traceX, xs), "val"),
        span(", y = "),
        span(Number.isFinite(y) ? tidy(y, ys) : "—", "val")
      );
      if (solving.found > 1) {
        parts.push(span(`${solving.index + 1} of ${solving.found}, tap again for the next`, "solve-note"));
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
  function graphKey(key) {
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
  }

  function pressKey(btn) {
    if (storing) {
      storing = false; // any other key cancels STO
      renderModes();
    }
    if (btn.dataset.insert) handle("insert", tokenOf(btn));
    else if (btn.dataset.action) handle(btn.dataset.action);
  }

  document.querySelector(".keys").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) pressKey(btn);
  });

  backspaceBtn.addEventListener("click", () => {
    storing = false;
    renderModes();
    handle("backspace");
  });

  // Tap between two tokens to type or delete there. Tapping an answer goes
  // back to its expression.
  displayEl.addEventListener("click", (event) => {
    if (state.result !== null) return handle("cursor", 0);
    const el = event.target.closest("[data-index]");
    let index;
    if (el) {
      const box = el.getBoundingClientRect();
      const rightHalf = event.clientX > box.left + box.width / 2;
      index = Number(el.dataset.index) + (rightHalf ? 1 : 0);
    } else {
      // Empty space: left of the expression means its start, otherwise its end.
      const first = displayEl.querySelector("[data-index]");
      const left = first && event.clientX < first.getBoundingClientRect().left;
      index = left ? 0 : state.tokens.length;
    }
    handle("setCursor", index);
  });

  sciEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn === stoBtn) {
      storing = !storing;
    } else if (btn === clearMemoryBtn) {
      state = C.clearMemory(state);
      save(MEMORY_KEY, state.memory);
    } else if (storing && btn.dataset.var) {
      storing = false;
      handle("store", btn.dataset.var);
    } else if (btn === invBtn) {
      inverse = !inverse;
    } else if (btn.dataset.angle) {
      settings.angle = btn.dataset.angle;
      save(SETTINGS_KEY, settings);
    } else {
      pressKey(btn);
    }
    renderModes();
    render();
  });

  sciToggle.addEventListener("click", () => {
    settings.sci = !settings.sci;
    save(SETTINGS_KEY, settings);
    renderModes();
  });

  historyToggle.addEventListener("click", () => {
    settings.history = !settings.history;
    save(SETTINGS_KEY, settings);
    renderModes();
  });

  historyList.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) handle("recall", btn.dataset.result);
  });

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    save(HISTORY_KEY, history);
    renderHistory();
  });

  // Keys typed as-is.
  const typed = new Set([..."0123456789.+-*/^()!%"]);
  // Letter shortcuts for scientific keys; they follow Inv like the buttons.
  const shortcuts = {
    s: '[data-insert="sin("]',
    c: '[data-insert="cos("]',
    t: '[data-insert="tan("]',
    l: '[data-insert="log("]',
    n: '[data-insert="ln("]',
  };
  const letters = { r: "√(", p: "π", e: "e", a: "Ans", x: "x", i: "∫(", d: "d/dx(" };
  sdBtn.addEventListener("click", switchFraction);
  // Shift+A…F types a memory letter.
  for (const name of C.VARIABLES) letters[name] = name;

  document.addEventListener("keydown", (event) => {
    // Leave browser shortcuts such as Ctrl+C alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    if (storing && key !== "Shift") {
      // After STO, Shift+A…F stores; any other key cancels.
      storing = false;
      renderModes();
      if (C.VARIABLES.includes(key)) {
        handle("store", key);
        event.preventDefault();
        return;
      }
    }
    if (settings.graph && editing === null) {
      if (graphKey(key)) event.preventDefault();
      return;
    }
    if (typed.has(key)) handle("insert", key);
    else if (key === ",") handle("insert", event.code === "NumpadDecimal" ? "." : ",");
    else if (key === "Enter" || key === "=") handle("equals");
    else if (key === "Backspace") handle("backspace");
    else if (key === "ArrowLeft") handle("cursor", -1);
    else if (key === "ArrowRight") handle("cursor", 1);
    else if (key === "Escape") handle("clear");
    else if (key === "h") historyToggle.click();
    else if (key === "f") switchFraction();
    else if (letters[key]) handle("insert", letters[key]);
    else if (shortcuts[key]) pressKey(document.querySelector(shortcuts[key]));
    else return;
    event.preventDefault();
  });

  renderModes();
  render();
  renderHistory();
  renderGraph();

  // Makes the app installable and usable offline (see sw.js).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Not supported here (e.g. opened as a local file); the page still works.
    });
  }
})();
