# Clodo
New repository to work with Claude

## Calculator

A simple calculator that runs in the browser with no dependencies or build step.

- **Run it:** open `index.html` in a browser.
- **Typing a calculation:** type the whole expression, as on a Casio, and press `=`:
  `2×(3+4)²−sin(30) = 97.5`. The answer so far appears under the expression while you
  type. Brackets left open at the end are closed for you.
- **Order of operations:** brackets first, then powers, then `×` and `÷`, then `+` and
  `−`. Multiplication without a sign binds tighter than `×` and `÷`, as on a Casio:
  `2π`, `3(4+1)`, and `1÷2π = 1÷(2π)`. `−2² = −4`.
- **Ans:** after `=`, pressing an operator carries on from the answer (`Ans×2`); typing a
  number starts a new calculation. **Ans** can also be typed anywhere.
- **Errors:** **Syntax Error** (e.g. `2+` or a stray `)`) or **Math Error** (e.g. `5÷0`,
  `√(−4)`). The expression stays on screen so you can fix it.
- **Scientific keys:** press **Sci** to show them: `sin` `cos` `tan`, `x²`, `xʸ`, `ln`,
  `log`, `x⁻¹`, `n!`, `π`, `e`, `(−)` for a negative number, `%`, `|x|` and **Ans**.
  Functions go before their number and open a bracket: `sin(30)`. **Inv** switches keys
  to their inverse (`sin⁻¹`, `√`, `ʸ√x`, `eˣ`, `10ˣ`), and **Deg/Rad** sets the angle
  unit (Degrees by default).
- **Memory (A–F):** in the Sci panel, press **STO** then a letter to store the current
  expression's answer (or the answer on screen, or Ans if nothing is typed), shown as
  `2×3→A = 6`. Tap a letter to use it in an expression, like `2A+1`. Each letter shows
  its value, and memory is kept after closing the app; **Clear** resets all to 0.
- **Graphs:** press **Graph** to switch to graph mode. Tap **y1**, **y2** or **y3** to type a
  function of `x` with the keypad (the **x** key is above it), then **Draw** (or `=`).
  - Drag to move, pinch or scroll to zoom, or use **−** **+**. **Std** shows x from −10 to
    10; **Trig** shows two full turns for sin/cos/tan. **Deg/Rad** sets the angle unit.
  - Tap the graph to trace: the values of each function at that x appear underneath
    (`←` `→` move the trace on a keyboard).
  - **Table** lists the values at each grid line in view.
  - Tap a colour square to hide or show that function. Functions, the view and the
    settings are kept after closing the app.
- **Fixing typos:** **⌫** deletes the last key (`sin(` goes in one press). Tap between
  two parts of the expression (or use `←` `→`) to type or delete there. After a result,
  tap it, or press **⌫** or an arrow, to go back to the expression and change it.
- **History:** press **History** (or `h`) to show the last 10 calculations under the keys.
  Tap one to insert its result. History is saved in your browser, so it survives a
  reload; **Clear** empties it.
- **Keyboard:** digits, `+ - * / ^ ( ) . ! %`, `Enter`/`=`, `Backspace`, `←` `→`, `Esc`
  (clear). Scientific: `s` `c` `t` sin/cos/tan, `l` log, `n` ln, `r` √, `p` π, `e`,
  `a` Ans, Shift+`A`…`F` memory letters (after **STO**, Shift+letter stores). With **Inv**
  on, `s` `c` `t` `l` `n` type the inverse functions.
- **Install it as an app:** open the GitHub Pages site, then
  - **Android (Chrome):** ⋮ menu → **Add to Home screen** → **Install**.
  - **iPhone (Safari):** Share button → **Add to Home Screen**.
  - **Windows/Linux (Chrome or Edge):** click the install icon at the right of the address bar.

  The installed app opens in its own window and works offline. When online, it always
  loads the newest deployed version.
- **Test it:** `node --test` (needs Node 18 or newer).

Files:

- `calculator.js`: the calculator logic (expression parser and evaluator), with no page
  code, so it can be tested.
- `app.js`: connects the logic to the buttons and keyboard.
- `index.html`, `style.css`: the page layout and styles.
- `graph.js`: graph helpers (view, axis ticks, sampling curves, drawing), no page code.
- `calculator.test.js`, `graph.test.js`: unit tests.
- `manifest.webmanifest`, `sw.js`, `icons/`: make it installable and usable offline.
