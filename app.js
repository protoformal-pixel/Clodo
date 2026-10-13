// Wires the calculator logic to the page: buttons and keyboard.
(function () {
  "use strict";

  const C = window.Calculator;
  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const modeEl = document.getElementById("mode");
  const sciEl = document.getElementById("sci");
  const sciToggle = document.getElementById("sci-toggle");
  const historyEl = document.getElementById("history");
  const historyToggle = document.getElementById("history-toggle");
  const invBtn = document.getElementById("inv");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const clearHistoryBtn = document.getElementById("clear-history");
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", root: "ʸ√" };
  const HISTORY_KEY = "calculator-history";
  const SETTINGS_KEY = "calculator-settings";
  let state = C.createState();
  let history = loadHistory();
  let settings = loadSettings(); // { sci, history: boolean, angle: "deg" | "rad" }
  let inverse = false;

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

  function loadSettings() {
    const saved = load(SETTINGS_KEY) || {};
    return {
      sci: saved.sci === true,
      history: saved.history === true,
      angle: saved.angle === "rad" ? "rad" : "deg",
    };
  }

  // Internal tokens such as "*" and "root" shown as their key symbols.
  function prettify(expression) {
    return expression.replace(
      / (\+|-|\*|\/|\^|root) /g,
      (_, op) => ` ${symbols[op]} `
    );
  }

  // With Inv on, keys such as sin act as their inverse (sin⁻¹).
  function fnOf(btn) {
    return (inverse && btn.dataset.invFn) || btn.dataset.fn;
  }

  function operatorOf(btn) {
    return (inverse && btn.dataset.invOperator) || btn.dataset.operator;
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
    modeEl.textContent = settings.sci
      ? [settings.angle.toUpperCase(), inverse && "INV"].filter(Boolean).join(" ")
      : "";
  }

  function render() {
    displayEl.textContent = state.display;
    // Shrink long numbers such as π so they stay on one line.
    const length = state.display.length;
    displayEl.style.fontSize =
      length > 10 ? `${Math.max(1.5, (3 * 10) / length)}rem` : "";
    const tokens = state.label ? [...state.chain, state.label] : state.chain;
    expressionEl.textContent = prettify(tokens.join(" ") + " ");
    const pending = state.operatorPending && state.ops[state.ops.length - 1];
    document.querySelectorAll("[data-operator]").forEach((btn) => {
      btn.classList.toggle("active", pending === operatorOf(btn));
    });
  }

  function handle(action, value) {
    switch (action) {
      case "digit":
        state = C.inputDigit(state, value);
        break;
      case "operator":
        state = C.setOperator(state, value);
        break;
      case "function":
        state = C.applyFunction(state, value, settings.angle);
        break;
      case "constant":
        state = C.insertConstant(state, value);
        break;
      case "decimal":
        state = C.inputDecimal(state);
        break;
      case "equals":
        state = C.equals(state);
        if (state.completed) {
          history = C.addToHistory(history, state.completed);
          save(HISTORY_KEY, history);
          renderHistory();
        }
        break;
      case "clear":
        state = C.clear();
        break;
      case "sign":
        state = C.toggleSign(state);
        break;
      case "percent":
        state = C.percent(state);
        break;
      case "backspace":
        state = C.backspace(state);
        break;
      case "recall":
        state = C.recall(value);
        break;
    }
    render();
  }

  function pressKey(btn) {
    const { dataset } = btn;
    if (dataset.digit) handle("digit", dataset.digit);
    else if (dataset.operator) handle("operator", operatorOf(btn));
    else if (dataset.fn) handle("function", fnOf(btn));
    else if (dataset.constant) handle("constant", dataset.constant);
    else if (dataset.action) handle(dataset.action);
  }

  document.querySelector(".keys").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) pressKey(btn);
  });

  sciEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn === invBtn) {
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

  // Letter shortcuts for scientific keys; they follow Inv like the buttons.
  const shortcuts = {
    s: '[data-fn="sin"]',
    c: '[data-fn="cos"]',
    t: '[data-fn="tan"]',
    l: '[data-fn="log"]',
    n: '[data-fn="ln"]',
    "^": '[data-operator="^"]',
    "!": '[data-fn="factorial"]',
    p: '[data-constant="pi"]',
  };

  document.addEventListener("keydown", (event) => {
    // Leave browser shortcuts such as Ctrl+C alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    if (/^[0-9]$/.test(key)) handle("digit", key);
    else if (["+", "-", "*", "/"].includes(key)) handle("operator", key);
    else if (key === "." || key === ",") handle("decimal");
    else if (key === "Enter" || key === "=") handle("equals");
    else if (key === "Backspace") handle("backspace");
    else if (key === "Escape") handle("clear");
    else if (key === "%") handle("percent");
    else if (key === "r") handle("function", "sqrt");
    else if (key === "h") historyToggle.click();
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
