// Wires the calculator logic to the page: buttons and keyboard.
(function () {
  "use strict";

  const C = window.Calculator;
  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const historyList = document.getElementById("history-list");
  const historyEmpty = document.getElementById("history-empty");
  const clearHistoryBtn = document.getElementById("clear-history");
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const HISTORY_KEY = "calculator-history";
  let state = C.createState();
  let history = loadHistory();

  // History is kept in this browser only. Storage can be unavailable
  // (e.g. private browsing), so every access is guarded.
  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(saved) ? saved.slice(0, C.HISTORY_LIMIT) : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Not saved; history still works until the page is closed.
    }
  }

  function prettify(expression) {
    return expression.replace(/ ([-+*/]) /g, (_, op) => ` ${symbols[op]} `);
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

  function render() {
    displayEl.textContent = state.display;
    expressionEl.textContent = prettify(state.chain.join(" ") + " ");
    document.querySelectorAll("[data-operator]").forEach((btn) => {
      btn.classList.toggle(
        "active",
        state.waitingForOperand && btn.dataset.operator === state.operator
      );
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
      case "decimal":
        state = C.inputDecimal(state);
        break;
      case "equals":
        state = C.equals(state);
        if (state.completed) {
          history = C.addToHistory(history, state.completed);
          saveHistory();
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

  document.querySelector(".keys").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.dataset.digit) handle("digit", btn.dataset.digit);
    else if (btn.dataset.operator) handle("operator", btn.dataset.operator);
    else handle(btn.dataset.action);
  });

  historyList.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (btn) handle("recall", btn.dataset.result);
  });

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  document.addEventListener("keydown", (event) => {
    const { key } = event;
    if (/^[0-9]$/.test(key)) handle("digit", key);
    else if (["+", "-", "*", "/"].includes(key)) handle("operator", key);
    else if (key === "." || key === ",") handle("decimal");
    else if (key === "Enter" || key === "=") handle("equals");
    else if (key === "Backspace") handle("backspace");
    else if (key === "Escape") handle("clear");
    else if (key === "%") handle("percent");
    else return;
    event.preventDefault();
  });

  render();
  renderHistory();
})();
