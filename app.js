// Wires the calculator logic to the page: buttons and keyboard.
(function () {
  "use strict";

  const C = window.Calculator;
  const displayEl = document.getElementById("display");
  const backspaceBtn = document.getElementById("backspace");
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
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", root: "ʸ√" };
  const HISTORY_KEY = "calculator-history";
  const SETTINGS_KEY = "calculator-settings";
  const MEMORY_KEY = "calculator-memory";
  let state = C.createState(0, loadMemory());
  let history = loadHistory();
  let settings = loadSettings(); // { sci, history: boolean, angle: "deg" | "rad" }
  let inverse = false;
  let storing = false; // STO pressed, waiting for a letter

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
      angle: saved.angle === "rad" ? "rad" : "deg",
    };
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
    sciEl.hidden = !settings.sci;
    sciToggle.setAttribute("aria-pressed", settings.sci);
    historyEl.hidden = !settings.history;
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
    modeEl.textContent = settings.sci
      ? [settings.angle.toUpperCase(), inverse && "INV", storing && "STO"]
          .filter(Boolean)
          .join(" ")
      : "";
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

  function render() {
    renderMemory();
    if (state.result !== null) {
      // After "=": the expression above, the answer big.
      expressionEl.textContent = state.resultExpression + " =";
      displayEl.replaceChildren(span(state.result));
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

    const preview = C.preview(state, settings.angle);
    previewEl.textContent = state.error || (preview === null ? "" : "= " + preview);
    previewEl.classList.toggle("is-error", Boolean(state.error));
  }

  function handle(action, value) {
    switch (action) {
      case "insert":
        state = C.insert(state, value);
        break;
      case "equals":
        state = C.equals(state, settings.angle);
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
        state = C.store(state, value, settings.angle);
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
  const letters = { r: "√(", p: "π", e: "e", a: "Ans" };
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
    if (typed.has(key)) handle("insert", key);
    else if (key === ",") handle("insert", ".");
    else if (key === "Enter" || key === "=") handle("equals");
    else if (key === "Backspace") handle("backspace");
    else if (key === "ArrowLeft") handle("cursor", -1);
    else if (key === "ArrowRight") handle("cursor", 1);
    else if (key === "Escape") handle("clear");
    else if (key === "h") historyToggle.click();
    else if (letters[key]) handle("insert", letters[key]);
    else if (shortcuts[key]) pressKey(document.querySelector(shortcuts[key]));
    else return;
    event.preventDefault();
  });

  renderModes();
  render();
  renderHistory();

  // Makes the app installable and usable offline (see sw.js).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Not supported here (e.g. opened as a local file); the page still works.
    });
  }
})();
