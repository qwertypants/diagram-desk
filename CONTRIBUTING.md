# Contributing to Diagram Desk

Thanks for taking the time. This is a small project and contributions are very
welcome — bug reports and documentation fixes count just as much as code.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

You need Node.js 24 or newer.

Clone or download the repository, then from its root run:

```sh
npm ci
npm start
```

Then open <http://127.0.0.1:4317>. The SQLite file is created on first run, so
there is no setup beyond `npm ci`.

## Before you open a pull request

Run both suites:

```sh
npm test            # unit + DOM tests, must be green
npm run build       # the client must still build
```

For anything that changes what a user sees or does, also run the browser
walkthrough against a running server:

```sh
npm start           # in one terminal
npm run test:browser # in another
```

It needs a local Google Chrome install (the Playwright devDependency provides
the driver, not the browser).

## Ground rules

**Add a test for new behavior and for every bug you fix.** The suite is fast and
runs in about a second; a change that isn't covered will be asked for a test
before it can merge.

**Keep it dependency-free where you can.** The runtime dependency list is
deliberately one package long (Mermaid). Adding another needs a good reason in
the pull request description. The server uses `node:http` and `node:sqlite`
only — no web framework.

**Follow the style of the file you are in.** Match the existing formatting and
naming. Comments explain *why*, not *what*.

**Update the docs you invalidate.** `docs/api-contract.md` is a binding
contract: if you change an endpoint, its validation, or an error status, update
that document in the same pull request. If you change setup, testing, or
configuration, update `README.md`.

## Reporting bugs

Use the bug report template. The most useful thing you can include is what you
expected, what happened instead, and how to reproduce it — and if it involves
Mermaid source, paste the exact source that fails.

## Pull requests

- One logical change per pull request.
- Write a description that says what changed and why.
- Note anything you deliberately left out.
- CI runs the tests and the build on Node 24. Green is required.

## Reporting security issues

Please do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contributions are licensed under the
project's [MIT license](LICENSE).
