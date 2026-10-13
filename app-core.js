// The page script is split by screen, loaded in this order:
//   app-core.js   shared settings, storage, helpers, switching screens
//   app-calc.js   the calculator: display, keypad, history, memory
//   app-graph.js  graph mode, G-Solv and the table of values
//   app-stat.js   statistics mode
//   app-main.js   keyboard, Android back button, start-up
// They share one object, window.CalculatorUI ("UI" in each file). Each
// screen keeps its own state private and offers a few functions on UI for
// the others to call.
(function () {
  "use strict";

  const UI = (window.CalculatorUI = {});
  const SETTINGS_KEY = "calculator-settings";

  // Everything is kept in this browser only. Storage can be unavailable
  // (e.g. private browsing), so every access is guarded.
  UI.load = function (key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  };

  UI.save = function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not saved; everything still works until the page is closed.
    }
  };

  // The settings object is shared and changed in place, never replaced.
  UI.settings = (function loadSettings() {
    const saved = UI.load(SETTINGS_KEY) || {};
    return {
      sci: saved.sci === true,
      history: saved.history === true,
      graph: saved.graph === true,
      stat: saved.stat === true && saved.graph !== true,
      angle: saved.angle === "rad" ? "rad" : "deg",
      // How answers are shown: "dec" 3.5, "frac" 7/2 or "mixed" 3 1/2.
      fraction: ["frac", "mixed"].includes(saved.fraction) ? saved.fraction : "dec",
    };
  })();

  UI.saveSettings = function () {
    UI.save(SETTINGS_KEY, UI.settings);
  };

  // ---------------------------------------------------------------------
  // Small DOM helpers

  UI.span = function (text, className) {
    const el = document.createElement("span");
    el.textContent = text;
    if (className) el.className = className;
    return el;
  };

  // Shrink long text so it stays on one line, down to half size.
  UI.fit = function (el, length) {
    el.style.fontSize = length > 10 ? `${Math.max(1.5, (3 * 10) / length)}rem` : "";
  };

  // Tokens as spans, with the caret when editing.
  UI.renderTokens = function (el, tokens, cursor, withCaret) {
    const parts = tokens.map((token, i) => {
      const part = UI.span(window.Calculator.tokenText(token));
      part.dataset.index = i;
      return part;
    });
    if (withCaret) parts.splice(cursor === null ? parts.length : cursor, 0, UI.span("", "caret"));
    el.replaceChildren(...parts);
  };

  // Which gap between tokens a tap landed in.
  UI.tapIndex = function (el, event, length) {
    const part = event.target.closest("[data-index]");
    if (part) {
      const box = part.getBoundingClientRect();
      return Number(part.dataset.index) + (event.clientX > box.left + box.width / 2 ? 1 : 0);
    }
    const first = el.querySelector("[data-index]");
    return first && event.clientX < first.getBoundingClientRect().left ? 0 : length;
  };

  // ---------------------------------------------------------------------
  // Screens: Calculator, Graph and Stat

  const screenEl = document.getElementById("screen");
  const graphEl = document.getElementById("graph");
  const statEl = document.getElementById("stat");
  const keysEl = document.querySelector(".keys");
  const sciEl = document.getElementById("sci");
  const historyEl = document.getElementById("history");
  const graphToggle = document.getElementById("graph-toggle");
  const statToggle = document.getElementById("stat-toggle");
  const sciToggle = document.getElementById("sci-toggle");
  const historyToggle = document.getElementById("history-toggle");

  // Something is being typed into a graph function or a data cell.
  UI.typingElsewhere = function () {
    return UI.graphTyping() || UI.statTyping();
  };

  UI.renderModes = function () {
    const { settings } = UI;
    // In Graph and Stat mode the keypad only shows while something is typed.
    const keypad = (!settings.graph && !settings.stat) || UI.typingElsewhere();
    graphEl.hidden = !settings.graph;
    statEl.hidden = !settings.stat;
    screenEl.hidden = settings.graph || settings.stat;
    keysEl.hidden = !keypad;
    sciEl.hidden = !settings.sci || !keypad;
    historyEl.hidden = !settings.history || settings.graph || settings.stat;
    historyToggle.hidden = settings.graph || settings.stat;
    graphToggle.setAttribute("aria-pressed", settings.graph);
    statToggle.setAttribute("aria-pressed", settings.stat);
    sciToggle.setAttribute("aria-pressed", settings.sci);
    historyToggle.setAttribute("aria-pressed", settings.history);
    document.querySelectorAll("[data-angle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.angle === settings.angle);
    });
    UI.renderCalcModes();
    UI.renderGraphModes();
    UI.renderStatModes();
  };

  UI.setMode = function (mode) {
    UI.settings.graph = mode === "graph";
    UI.settings.stat = mode === "stat";
    UI.saveSettings();
    UI.cancelGraphTyping();
    UI.cancelStatTyping();
    UI.renderModes();
    UI.renderGraph();
    UI.renderStats();
  };

  graphToggle.addEventListener("click", () => UI.setMode(UI.settings.graph ? "calc" : "graph"));
  statToggle.addEventListener("click", () => UI.setMode(UI.settings.stat ? "calc" : "stat"));

  sciToggle.addEventListener("click", () => {
    UI.settings.sci = !UI.settings.sci;
    UI.saveSettings();
    UI.renderModes();
  });

  historyToggle.addEventListener("click", () => {
    UI.settings.history = !UI.settings.history;
    UI.saveSettings();
    UI.renderModes();
  });
})();
