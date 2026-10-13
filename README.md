# Clodo
New repository to work with Claude

## Calculator

A simple calculator that runs in the browser with no dependencies or build step.

- **Run it:** open `index.html` in a browser.
- **History:** press **History** (or `h`) to show the last 10 calculations under the keys.
  Click one to reuse its result. History is saved in your browser, so it survives a
  reload; **Clear** empties it.
- **Order of operations:** `×` and `÷` come before `+` and `−`, and powers before both,
  so `2 + 3 × 4 = 14`.
- **Scientific keys:** press **Sci** to show them: `sin` `cos` `tan`, `x²`, `xʸ`, `ln`,
  `log`, `1/x`, `n!`, `π`, `e`. **Inv** switches keys to their inverse (`sin⁻¹`, `√x`,
  `ʸ√x`, `eˣ`, `10ˣ`), and **Deg/Rad** sets the angle unit (Degrees by default).
  Functions act on the number on screen: `9` then `√x` gives `3`.
- **Fixing typos:** **⌫** deletes the last digit. To fix one in the middle, tap between
  two digits (or use `←` `→`): a cursor appears, and digits and **⌫** work there. A
  result can be edited the same way.
- **Keyboard:** digits, `+ - * /`, `.`, `Enter`/`=`, `Backspace`, `Esc` (clear), `%`.
  Scientific: `^` power, `r` square root, `s` `c` `t` sin/cos/tan, `l` log, `n` ln,
  `!` factorial, `p` π. With **Inv** on, the letter keys use the inverse functions.
- **Install it as an app:** open the GitHub Pages site, then
  - **Android (Chrome):** ⋮ menu → **Add to Home screen** → **Install**.
  - **iPhone (Safari):** Share button → **Add to Home Screen**.
  - **Windows/Linux (Chrome or Edge):** click the install icon at the right of the address bar.

  The installed app opens in its own window and works offline. When online, it always
  loads the newest deployed version.
- **Test it:** `node --test` (needs Node 18 or newer).

Files:

- `calculator.js`: the calculator logic, with no page code, so it can be tested.
- `app.js`: connects the logic to the buttons and keyboard.
- `index.html`, `style.css`: the page layout and styles.
- `calculator.test.js`: unit tests.
- `manifest.webmanifest`, `sw.js`, `icons/`: make it installable and usable offline.
