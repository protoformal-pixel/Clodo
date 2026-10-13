// Wires the calculator logic to the page: buttons and keyboard.
(function () {
  "use strict";

  const C = window.Calculator;
  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const symbols = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  let state = C.createState();

  function render() {
    displayEl.textContent = state.display;
    expressionEl.textContent =
      state.operator && state.stored !== null
        ? `${state.stored} ${symbols[state.operator]}`
        : "";
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
})();
