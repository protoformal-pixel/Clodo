# Clodo
New repository to work with Claude

## Calculator

A simple calculator that runs in the browser with no dependencies or build step.

- **Run it:** open `index.html` in a browser.
- **History:** the last 10 calculations appear under the keys. Click one to reuse its
  result. History is saved in your browser, so it survives a reload; **Clear** empties it.
- **Keyboard:** digits, `+ - * /`, `.`, `Enter`/`=`, `Backspace`, `Esc` (clear), `%`.
- **Test it:** `node --test` (needs Node 18 or newer).

Files:

- `calculator.js`: the calculator logic, with no page code, so it can be tested.
- `app.js`: connects the logic to the buttons and keyboard.
- `index.html`, `style.css`: the page layout and styles.
- `calculator.test.js`: unit tests.
