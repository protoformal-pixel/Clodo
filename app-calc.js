// The calculator screen: display, keypad, Sci panel, memory and history.
(function () {
  "use strict";

  const UI = window.CalculatorUI;
  const C = window.Calculator;
  const { settings } = UI;

  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const previewEl = document.getElementById("preview");
  const backspaceBtn = document.getElementById("backspace");
  const sdBtn = document.getElementById("sd");
  const modeEl = document.getElementById("mode");
  const sciEl = document.getElementById("sci");
  const invBtn = document.getElementById("inv");
  const stoBtn = document.getElementById("sto");
  const clearMemoryBtn = document.getElementById("clear-memory");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const clearHistoryBtn = document.getElementById("clear-history");

  const HISTORY_KEY = "calculator-history";
  const MEMORY_KEY = "calculator-memory";
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", root: "ʸ√" };

  let state = C.createState(0, loadMemory());
  let history = loadHistory();
  let inverse = false;
  let storing = false; // STO pressed, waiting for a letter

  function loadHistory() {
    const saved = UI.load(HISTORY_KEY);
    return Array.isArray(saved) ? saved.slice(0, C.HISTORY_LIMIT) : [];
  }

  // Stored values survive closing the app, as on a real calculator.
  function loadMemory() {
    const saved = UI.load(MEMORY_KEY) || {};
    return Object.fromEntries(
      C.VARIABLES.filter((name) => Number.isFinite(saved[name])).map((name) => [name, saved[name]])
    );
  }

  // What the other screens need to work out expressions: the angle unit,
  // Ans and the memory letters.
  UI.calcEnv = function () {
    return { angle: settings.angle, ans: state.ans, memory: state.memory };
  };

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

  function addToHistory(entry) {
    history = C.addToHistory(history, entry);
    UI.save(HISTORY_KEY, history);
    renderHistory();
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

  // Inv and STO, and the status line at the top right.
  UI.renderCalcModes = function () {
    invBtn.setAttribute("aria-pressed", inverse);
    document.querySelectorAll("[data-inv-label]").forEach((btn) => {
      if (!btn.dataset.label) btn.dataset.label = btn.textContent.trim();
      btn.textContent = inverse ? btn.dataset.invLabel : btn.dataset.label;
    });
    stoBtn.setAttribute("aria-pressed", storing);
    sciEl.classList.toggle("is-storing", storing);
    const graphMode = settings.graph;
    const statMode = settings.stat;
    const scientific = settings.sci || graphMode;
    modeEl.textContent = [
      scientific && settings.angle.toUpperCase(),
      scientific && inverse && "INV",
      scientific && storing && "STO",
      !graphMode && !statMode && { frac: "FRAC", mixed: "MIXED" }[settings.fraction],
    ]
      .filter(Boolean)
      .join(" ");
  };

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
    const { span } = UI;
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
  UI.switchFraction = function () {
    const order = ["dec", "frac", "mixed"];
    settings.fraction = order[(order.indexOf(settings.fraction) + 1) % order.length];
    UI.saveSettings();
    state = C.restyle(state, settings.fraction);
    UI.renderModes();
    render();
  };

  function render() {
    renderMemory();
    if (state.result !== null) {
      // After "=": the expression above, the answer big.
      expressionEl.textContent = state.resultExpression + " =";
      displayEl.replaceChildren(...resultParts(state.result));
      displayEl.classList.add("is-result");
      UI.fit(displayEl, state.result.length);
      previewEl.textContent = "";
      previewEl.classList.remove("is-error");
      return;
    }

    // Typing: one span per token, so a tap can tell where it landed.
    expressionEl.textContent = "";
    displayEl.classList.remove("is-result");
    if (state.tokens.length) UI.renderTokens(displayEl, state.tokens, state.cursor, true);
    else displayEl.replaceChildren(UI.span("0", "placeholder"));
    UI.fit(displayEl, C.toText(state.tokens).length);

    const preview = C.preview(state, settings.angle, settings.fraction);
    previewEl.textContent = state.error || (preview === null ? "" : "= " + preview);
    previewEl.classList.toggle("is-error", Boolean(state.error));
  }

  // Every key goes through here. While a graph function or a data cell is
  // being typed, keys go there instead.
  UI.handle = function (action, value) {
    if (UI.graphTyping()) return UI.editFunction(action, value);
    if (UI.statTyping()) return UI.editCell(action, value);
    switch (action) {
      case "insert":
        state = C.insert(state, value);
        break;
      case "equals":
        state = C.equals(state, settings.angle, settings.fraction);
        if (state.completed) addToHistory(state.completed);
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
        UI.save(MEMORY_KEY, state.memory);
        if (state.completed) addToHistory(state.completed);
        break;
    }
    render();
  };

  UI.pressKey = function (btn) {
    if (storing) {
      storing = false; // any other key cancels STO
      UI.renderModes();
    }
    if (btn.dataset.insert) UI.handle("insert", tokenOf(btn));
    else if (btn.dataset.action) UI.handle(btn.dataset.action);
  };

  // A key typed on a keyboard while STO waits: Shift+A…F stores, anything
  // else cancels. True if the key was used up.
  UI.storeKey = function (key) {
    if (!storing || key === "Shift") return false;
    storing = false;
    UI.renderModes();
    if (!C.VARIABLES.includes(key)) return false;
    UI.handle("store", key);
    return true;
  };

  // Back button: turn off STO and Inv. False if neither was on.
  UI.calcBack = function () {
    if (!storing && !inverse) return false;
    storing = false;
    inverse = false;
    UI.renderModes();
    render();
    return true;
  };

  UI.render = render;
  UI.renderHistory = renderHistory;

  document.querySelector(".keys").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) UI.pressKey(btn);
  });

  backspaceBtn.addEventListener("click", () => {
    storing = false;
    UI.renderModes();
    UI.handle("backspace");
  });

  sdBtn.addEventListener("click", UI.switchFraction);

  // Tap between two tokens to type or delete there. Tapping an answer goes
  // back to its expression.
  displayEl.addEventListener("click", (event) => {
    if (state.result !== null) return UI.handle("cursor", 0);
    UI.handle("setCursor", UI.tapIndex(displayEl, event, state.tokens.length));
  });

  sciEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn === stoBtn) {
      storing = !storing;
    } else if (btn === clearMemoryBtn) {
      state = C.clearMemory(state);
      UI.save(MEMORY_KEY, state.memory);
    } else if (storing && btn.dataset.var) {
      storing = false;
      UI.handle("store", btn.dataset.var);
    } else if (btn === invBtn) {
      inverse = !inverse;
    } else if (btn.dataset.angle) {
      settings.angle = btn.dataset.angle;
      UI.saveSettings();
    } else {
      UI.pressKey(btn);
    }
    UI.renderModes();
    render();
  });

  historyList.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) UI.handle("recall", btn.dataset.result);
  });

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    UI.save(HISTORY_KEY, history);
    renderHistory();
  });
})();
