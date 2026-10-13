// Keyboard shortcuts, the Android back button and start-up. Loaded last.
(function () {
  "use strict";

  const UI = window.CalculatorUI;
  const C = window.Calculator;
  const { settings } = UI;

  // ---------------------------------------------------------------------
  // Keyboard

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
  // Shift+A…F types a memory letter.
  for (const name of C.VARIABLES) letters[name] = name;

  document.addEventListener("keydown", (event) => {
    // Leave browser shortcuts such as Ctrl+C alone.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    const { handle } = UI;
    if (UI.storeKey(key)) {
      event.preventDefault();
      return;
    }
    if (settings.stat && !UI.statTyping()) return; // nothing to type into
    if (settings.graph && !UI.graphTyping()) {
      if (UI.graphKey(key)) event.preventDefault();
      return;
    }
    if (typed.has(key)) handle("insert", key);
    else if (key === ",") handle("insert", event.code === "NumpadDecimal" ? "." : ",");
    else if (key === "Enter" || key === "=") handle("equals");
    else if (key === "Backspace") handle("backspace");
    else if (key === "ArrowLeft") handle("cursor", -1);
    else if (key === "ArrowRight") handle("cursor", 1);
    else if (key === "Escape") handle("clear");
    else if (key === "h") document.getElementById("history-toggle").click();
    else if (key === "f") UI.switchFraction();
    else if (letters[key]) handle("insert", letters[key]);
    else if (shortcuts[key]) UI.pressKey(document.querySelector(shortcuts[key]));
    else return;
    event.preventDefault();
  });

  // ---------------------------------------------------------------------
  // Start-up

  UI.renderModes();
  UI.render();
  UI.renderHistory();
  UI.renderGraph();
  UI.renderStats();

  // ---------------------------------------------------------------------
  // Running as the Android app (Capacitor) rather than in a browser.

  const native = window.Capacitor?.isNativePlatform?.() === true;
  document.getElementById("about").textContent =
    `Calculator ${window.APP_VERSION || ""} · ${native ? "Android app" : "web"}`;

  // Android's back button steps back through what is open, and only leaves
  // the app from the plain calculator.
  function goBack() {
    if (UI.graphTyping()) return UI.stopEditing();
    if (UI.statTyping()) return UI.stopCell();
    if (UI.closeSolve()) return;
    if (settings.graph || settings.stat) return UI.setMode("calc");
    if (UI.calcBack()) return;
    return false; // nothing open: leave the app
  }

  if (native) {
    const CapApp = window.Capacitor.Plugins?.App ?? window.Capacitor.registerPlugin?.("App");
    CapApp?.addListener("backButton", () => {
      if (goBack() === false) CapApp.exitApp();
    });
  }

  // Makes the web app installable and usable offline (see sw.js). The
  // Android app already has its files, so it does not need this.
  if (!native && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Not supported here (e.g. opened as a local file); the page still works.
    });
  }
})();
