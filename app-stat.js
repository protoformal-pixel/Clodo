// Statistics mode: the data table, summaries and regression.
(function () {
  "use strict";

  const UI = window.CalculatorUI;
  const C = window.Calculator;
  const S = window.Stats;

  const statEl = document.getElementById("stat");
  const dataBody = document.getElementById("data-body");
  const statTools = document.getElementById("stat-tools");
  const statResults = document.getElementById("stat-results");
  const modelPicker = document.getElementById("model-picker");
  const regressionEl = document.getElementById("regression");
  const summaryEl = document.getElementById("summary");

  const STATS_KEY = "calculator-stats";

  // Rows of x and y, each a list of tokens like the display.
  let stats = loadStats(); // { rows: [{ x, y }], model }
  let cell = null; // the cell being typed: { row, col, editor }, or null

  function loadStats() {
    const saved = UI.load(STATS_KEY) || {};
    const isTokens = (t) => Array.isArray(t) && t.every((x) => typeof x === "string");
    const rows = (Array.isArray(saved.rows) ? saved.rows : [])
      .filter((r) => r && isTokens(r.x) && isTokens(r.y))
      .map((r) => ({ x: r.x, y: r.y }));
    return { rows, model: saved.model in S.MODELS ? saved.model : "lin" };
  }

  function saveStats() {
    UI.save(STATS_KEY, stats);
  }

  // ---------------------------------------------------------------------
  // What the other screens use

  UI.statTyping = function () {
    return cell !== null;
  };

  UI.cancelStatTyping = function () {
    cell = null;
  };

  UI.stopCell = function () {
    stopCell();
  };

  // The data points, as [x, y] pairs, for the graph.
  UI.statPairs = function () {
    return statValues().pairs;
  };

  // The parts of the screen that depend on whether a cell is typed.
  UI.renderStatModes = function () {
    statTools.hidden = cell === null;
    statResults.hidden = cell !== null;
  };

  // Each cell is worked out like the calculator, so 1/3 or 2π are fine.
  function cellValue(tokens) {
    if (!tokens.length) return { empty: true };
    try {
      return { value: C.calculate(tokens, UI.calcEnv()) };
    } catch (e) {
      if (!e.calcError) throw e;
      return { error: e.calcError };
    }
  }

  // xs: every x; pairs: rows with both x and y; errors: cells that failed.
  function statValues() {
    const xs = [];
    const pairs = [];
    const errors = [];
    stats.rows.forEach((row, i) => {
      const x = cellValue(row.x);
      const y = cellValue(row.y);
      if (x.error) errors.push(`Row ${i + 1} x: ${x.error}`);
      if (y.error) errors.push(`Row ${i + 1} y: ${y.error}`);
      if (x.value === undefined) {
        if (y.value !== undefined) errors.push(`Row ${i + 1}: y without x`);
        return;
      }
      xs.push(x.value);
      if (y.value !== undefined) pairs.push([x.value, y.value]);
    });
    return { xs, pairs, errors };
  }

  // Ten significant digits on screen; the full value when used.
  const short = (v) => C.format(Number(v.toPrecision(10)));

  function valueButton(label, value) {
    const btn = document.createElement("button");
    btn.className = "stat-value";
    btn.title = "Use in the calculator";
    const ok = Number.isFinite(value);
    if (ok) btn.dataset.value = C.format(value);
    else btn.disabled = true;
    btn.append(UI.span(label, "stat-label"), UI.span(ok ? short(value) : "—", "val"));
    return btn;
  }

  let currentFit = null; // the regression on screen, for Copy to graph

  function renderStats() {
    if (statEl.hidden) return;
    renderDataTable();
    if (cell !== null) return;
    const { xs, pairs, errors } = statValues();

    modelPicker.querySelectorAll("[data-model]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.model === stats.model);
    });

    // Regression, when there are pairs.
    const parts = [];
    currentFit = null;
    if (errors.length) parts.push(UI.span(errors.join(" · "), "stat-error"));
    if (!pairs.length) {
      const note = xs.length ? "Add y values to fit a curve." : "Tap a cell to enter data.";
      parts.push(UI.span(note, "stat-note"));
    } else {
      const model = S.MODELS[stats.model];
      const fit = S.regression(stats.model, pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      parts.push(UI.span(`${model.name}: ${model.formula}`, "stat-formula"));
      if (fit.error) parts.push(UI.span(fit.error, "stat-error"));
      else {
        currentFit = fit;
        const grid = document.createElement("div");
        grid.className = "stat-grid";
        for (const [name, v] of Object.entries(fit.coefficients)) grid.append(valueButton(name, v));
        if (fit.r !== undefined) grid.append(valueButton("r", fit.r), valueButton("r²", fit.r * fit.r));
        if (fit.r2 !== undefined) grid.append(valueButton("R²", fit.r2));
        const copy = document.createElement("button");
        copy.id = "copy-fit";
        copy.className = "chip copy-fit";
        copy.textContent = "Copy to graph";
        parts.push(grid, copy);
      }
    }
    regressionEl.replaceChildren(...parts);

    // One-variable summaries for x, and for y when there is any.
    const ys = pairs.map((p) => p[1]);
    const columns = [["x", S.oneVar(xs)], ["y", S.oneVar(ys)]].filter(([, s]) => s);
    const rows = [
      ["n", "n"], ["mean", null], ["sum", "Σ"], ["sumSquares", "Σ²"], ["popSD", "σ"],
      ["sampleSD", "s"], ["min", "min"], ["q1", "Q1"], ["median", "Med"], ["q3", "Q3"],
      ["max", "max"],
    ];
    summaryEl.replaceChildren(
      ...columns.map(([name, summary]) => {
        const col = document.createElement("div");
        col.className = "stat-column";
        col.append(UI.span(name, "stat-heading"));
        for (const [key, label] of rows) {
          col.append(valueButton(label ?? (name === "x" ? "x̄" : "ȳ"), summary[key]));
        }
        return col;
      })
    );
  }

  function renderDataTable() {
    const cellEl = (rowIndex, col, tokens) => {
      const td = document.createElement("td");
      td.className = "data-cell";
      td.dataset.row = rowIndex;
      td.dataset.col = col;
      const isEditing = cell !== null && cell.row === rowIndex && cell.col === col;
      td.classList.toggle("is-editing", isEditing);
      const text = document.createElement("div");
      text.className = "cell-text";
      if (isEditing) UI.renderTokens(text, cell.editor.tokens, cell.editor.cursor, true);
      else if (tokens.length) {
        UI.renderTokens(text, tokens, null, false);
        if (cellValue(tokens).error) td.classList.add("has-error");
      }
      td.append(text);
      return td;
    };
    const rows = [...stats.rows, { x: [], y: [] }].map((row, i) => {
      const tr = document.createElement("tr");
      const last = i === stats.rows.length;
      tr.classList.toggle("new-row", last);
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = last ? "+" : String(i + 1);
      tr.append(th, cellEl(i, "x", row.x), cellEl(i, "y", row.y));
      return tr;
    });
    dataBody.replaceChildren(...rows);
  }

  function startCell(row, col) {
    if (cell) commitCell();
    const tokens = (stats.rows[row] && stats.rows[row][col]) || [];
    cell = { row, col, editor: { ...C.createState(), tokens } };
    UI.renderModes();
    renderStats();
    dataBody.querySelector(".is-editing")?.scrollIntoView({ block: "nearest" });
  }

  // Keep what was typed; a row emptied of both values goes away.
  function commitCell() {
    const { row, col, editor } = cell;
    if (row === stats.rows.length) {
      if (!editor.tokens.length) return;
      stats.rows.push({ x: [], y: [] });
    }
    stats.rows[row][col] = editor.tokens;
    if (!stats.rows[row].x.length && !stats.rows[row].y.length) stats.rows.splice(row, 1);
    saveStats();
  }

  function stopCell() {
    commitCell();
    cell = null;
    UI.fitDataNextDraw(); // the data may have changed
    UI.renderModes();
    renderStats();
  }

  // = or Next: x → y on the same row, then x on the next row, as on a Casio.
  function nextCell() {
    const { row, col, editor } = cell;
    const other = col === "x" ? "y" : "x";
    const removed =
      row < stats.rows.length && !editor.tokens.length && !stats.rows[row][other].length;
    commitCell();
    cell = null;
    if (removed) return startCell(row, "x");
    if (col === "x") startCell(row, "y");
    else startCell(Math.min(row + 1, stats.rows.length), "x");
  }

  UI.editCell = function (action, value) {
    const editor = cell.editor;
    switch (action) {
      case "insert":
        cell.editor = C.insert(editor, value);
        break;
      case "recall":
        cell.editor = C.insertNumber(editor, value);
        break;
      case "backspace":
        cell.editor = C.backspace(editor);
        break;
      case "clear":
        cell.editor = { ...editor, tokens: [], cursor: null };
        break;
      case "cursor":
        cell.editor = C.moveCursor(editor, value);
        break;
      case "setCursor":
        cell.editor = C.setCursor(editor, value);
        break;
      case "equals":
        return nextCell();
    }
    renderDataTable();
  };

  // The fitted curve as tokens for a graph function.
  function fitTokens(kind, c) {
    const num = (v) => C.insertNumber(C.createState(), C.format(v)).tokens;
    const term = (v) => (v < 0 ? ["-", ...num(-v)] : ["+", ...num(v)]);
    switch (kind) {
      case "lin":
        return [...num(c.a), ...term(c.b), "x"];
      case "quad":
        return [...num(c.a), ...term(c.b), "x", ...term(c.c), "x", "²"];
      case "log":
        return [...num(c.a), ...term(c.b), "ln(", "x", ")"];
      case "exp":
        return [...num(c.a), "e^(", ...num(c.b), "x", ")"];
      case "pow":
        return [...num(c.a), "x", "^", "(", ...num(c.b), ")"];
    }
  }

  dataBody.addEventListener("click", (event) => {
    const td = event.target.closest(".data-cell");
    if (!td) return;
    const row = Number(td.dataset.row);
    const col = td.dataset.col;
    if (cell && cell.row === row && cell.col === col) {
      const text = td.querySelector(".cell-text");
      return UI.handle("setCursor", UI.tapIndex(text, event, cell.editor.tokens.length));
    }
    startCell(row, col);
  });

  statTools.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.id === "cell-done") stopCell();
    else if (btn.id === "cell-next") nextCell();
    else if (btn.id === "cell-backspace") UI.handle("backspace");
  });

  modelPicker.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-model]");
    if (!btn) return;
    stats.model = btn.dataset.model;
    saveStats();
    renderStats();
  });

  statResults.addEventListener("click", (event) => {
    if (event.target.closest("#copy-fit") && currentFit) {
      return UI.plotFit(fitTokens(stats.model, currentFit.coefficients));
    }
    if (event.target.closest("#clear-data")) {
      if (!stats.rows.length || !confirm("Clear all the data?")) return;
      stats.rows = [];
      saveStats();
      return renderStats();
    }
    // Tap a value: back to the calculator with it typed in.
    const value = event.target.closest(".stat-value");
    if (value && !value.disabled) {
      UI.setMode("calc");
      UI.handle("recall", value.dataset.value);
    }
  });

  UI.renderStats = renderStats;
})();
