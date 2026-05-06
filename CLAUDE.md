# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ChordMaker is a Chrome extension (Manifest V3) that scrapes worship-song chord sheets from three specific sites, transposes the chords, and exports the result as a PDF. There is no build step, no test suite, and no linter — install by loading the directory unpacked at `chrome://extensions/` with Developer Mode on.

To iterate: edit files, then click the reload icon for the extension on the `chrome://extensions/` page (and reload the target page so the updated content script gets injected).

## Architecture

Three runtime contexts communicate by message passing:

- [popup.js](popup.js) — the toolbar popup UI. Persists user settings (`columns`, `maxWidth`, three theme colors) in `localStorage` and sends `increase` / `decrease` / `download` actions, along with the active `tabId`, to the background script.
- [background.js](background.js) — service worker. On every action it **re-injects** [content.js](content.js) into the target tab via `chrome.scripting.executeScript` and *then* forwards the action via `chrome.tabs.sendMessage`. Note that [manifest.json](manifest.json) also auto-injects `content.js` on `<all_urls>`, so the script can run twice on a single page; [content.js:944](content.js#L944) guards against duplicate listeners with `window.hasAddedListener`. Preserve that guard if you refactor the listener.
- [content.js](content.js) — runs in the page. Does DOM scraping, transposition, layout, and PDF generation. This is where ~all real logic lives.

### content.js internals

The site-specific scraping happens inside `popUpPage(data)` ([content.js:519](content.js#L519)). It picks a parser by checking which DOM element exists:

| Selector | Site |
|---|---|
| `.song-part-pages` | app.theworshipinitiative.com |
| `.chordProContainer` | worshiptogether.com |
| `main` (fallback) | tabs.ultimate-guitar.com |

Each parser builds a `SongTab` ([content.js:102](content.js#L102)) → `SongTabSection` → `SongTabLine` model. A `SongTabLine` is a list of `[chord, lyrics]` pairs where chord and lyric strings are intentionally space-padded so chord position aligns above lyric position in monospace.

Key model behaviors:
- `SongTab.computeAllocations(columns)` ([content.js:130](content.js#L130)) — binary-searches the minimum column height that fits all sections into the requested column count (a "split array into k subarrays minimizing max sum" problem). Don't replace with a simpler greedy without preserving this invariant.
- `SongTabLine.splitLines(maxLineWidth)` ([content.js:397](content.js#L397)) — wraps long lines on lyric whitespace while keeping chords aligned with the syllable they sit above.
- `SongTab.toText(columns)` emits a single array of strings using internal markup `[ch]…[/ch]` for chords and `[b]…[/b]` for bold (title/section header). The PDF renderer at [content.js:865](content.js#L865) splits on those tags to apply font weight and color. If you introduce a new style, extend both the emitter and the renderer.
- Transposition (`transposeChord`, [content.js:1](content.js#L1)) is a regex replace over note tokens; it always emits sharps (no flat preference). `keyDetect` ([content.js:53](content.js#L53)) scores each of the 12 transpositions of the song against a hand-written C-major chord-frequency profile.

PDF output uses jsPDF (bundled in [libs/](libs/)) with the Roboto Mono font embedded as base64 in [fonts.js](fonts.js) (~90 KB, do not edit by hand). Page dimensions are computed from character count × `fontAspectRatio = 0.632`; the layout assumes a monospace font, so swapping fonts requires re-tuning that ratio.

`increase` / `decrease` take a different code path from `download`: they mutate the chord text **in place** in the live DOM (`applyTransposeUp` / `applyTransposeDown` at [content.js:503](content.js#L503)), so the parsers later read the already-transposed chords. There is no separate "current key" state — the page itself is the source of truth.
