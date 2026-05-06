# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ChordMaker is a Chrome extension (Manifest V3) that scrapes worship-song chord sheets from three specific sites, transposes the chords, and exports the result as a PDF. There is no build step, no test suite, and no linter — install by loading the directory unpacked at `chrome://extensions/` with Developer Mode on.

To iterate: edit files, then click the reload icon for the extension on the `chrome://extensions/` page (and reload the target page so the updated content script gets injected).

## Architecture

Three runtime contexts communicate by message passing:

- [popup.js](popup.js) — the toolbar popup UI. Persists user settings (`columns`, `maxWidth`, three theme colors) in `chrome.storage.sync` and sends `preview` / `increase` / `decrease` / `openTab` actions with the active `tabId` to the background script. On `DOMContentLoaded` and on every settings `change`, it auto-fires `preview` and sets the returned `pdfDataUrl` directly as the `src` of an in-popup `<iframe id="preview">`.
- [background.js](background.js) — service worker. Pure forwarder: relays action messages from the popup to the content script via `chrome.tabs.sendMessage`, returning `true` to keep the channel open and pipe the page's `sendResponse` back to the popup. Content script injection is handled by [manifest.json](manifest.json) `content_scripts` scoped to the three target hosts — the service worker does **not** re-inject.
- [content.js](content.js) — runs in the page. Does DOM scraping, transposition, layout, and PDF generation. This is where ~all real logic lives.

### content.js internals

Pipeline is split into three stages: parse → transpose (optional) → render.

- `parseSongFromPage()` ([content.js:513](content.js#L513)) — site-specific DOM scraping. Picks a parser by `window.location.hostname`:

  | Hostname | Site |
  |---|---|
  | `app.theworshipinitiative.com` | The Worship Initiative |
  | `www.worshiptogether.com` (or `worshiptogether.com`) | Worship Together |
  | `tabs.ultimate-guitar.com` | Ultimate Guitar |

- `renderSongToPdf(song, data)` ([content.js:793](content.js#L793)) — pure read over the cached song: calls `song.toText(columns, maxWidth)` and builds the jsPDF. Rendering does **not** mutate the song, so no clone is needed.

Each parser builds a `SongTab` ([content.js:84](content.js#L84)) → `SongTabSection` → `SongTabLine` model. A `SongTabLine` is a list of `[chord, lyrics]` pairs (tuples — not `{chord, lyric}` objects) where chord and lyric strings are intentionally space-padded so chord position aligns above lyric position in monospace.

Key model behaviors:
- `SongTab.toText(columns, maxWidth)` ([content.js:178](content.js#L178)) — the only render entry point. Wraps each section's lines at `maxWidth` into a local render-only view (`{ header, lines, width, height }`), allocates sections to columns, and emits a single array of strings using internal markup `[ch]…[/ch]` for chords and `[b]…[/b]` for bold (title/section header). The PDF renderer splits on those tags to apply font weight and color. If you introduce a new style, extend both the emitter and the renderer. Wrapping happens inside `toText` precisely so the cached `SongTab` is never mutated by rendering.
- `SongTab.computeAllocations(sectionsHeights, columns)` ([content.js:133](content.js#L133)) — binary-searches the minimum column height that fits all sections into the requested column count (a "split array into k subarrays minimizing max sum" problem). Takes heights as input so `toText` can pass *post-wrap* heights. Don't replace with a simpler greedy without preserving this invariant.
- `SongTabLine.splitLines(maxLineWidth)` ([content.js:408](content.js#L408)) — pure: returns a new array of wrapped `SongTabLine`s. Wraps long lines on lyric whitespace while keeping chords aligned with the syllable they sit above. Called by `SongTab.toText`; not invoked elsewhere.
- `SongTab.clone()` ([content.js:101](content.js#L101)) — deep copy. Currently unused now that rendering is non-mutating; kept as a utility.
- Transposition (`transposeChord`, [content.js:20](content.js#L20)) is a regex replace over note tokens; the third arg `useFlats` toggles sharp vs. flat output tables. `keyDetect` ([content.js:31](content.js#L31)) scores each of the 12 transpositions of the song against a hand-written C-major chord-frequency profile, then chooses the conventional spelling (flats for F, Bb, Eb, Ab, Db; sharps elsewhere). `SongTab.transpose(d)` derives `useFlats` from the *new* key and threads it through `SongTabSection.transpose` / `SongTabLine.transpose`, so chord bodies match the key's accidental.

PDF output uses jsPDF (bundled in [libs/](libs/)) with the Roboto Mono font embedded as base64 in [fonts.js](fonts.js) (~90 KB, do not edit by hand — manifest loads it before content.js so the constants are visible). Page dimensions are computed from character count × `fontAspectRatio = 0.632`; the layout assumes a monospace font, so swapping fonts requires re-tuning that ratio.

### Action dispatch

All four actions (`preview`, `increase`, `decrease`, `openTab`) flow through `handleAction` ([content.js:938](content.js#L938)):

1. `getOrParseSong()` ([content.js:928](content.js#L928)) parses the page once and caches the `SongTab` on `window.cachedSong`, keyed by `window.location.href`. Subsequent calls in the same tab reuse the cached song — so the **cached parsed song is the source of truth for transpositions, not the page DOM**. If you navigate to a new URL the cache invalidates.
2. For `increase` / `decrease`, mutate the cached song via `song.transpose(±1)` *before* rendering. This is why transposition works on every site, including ones whose DOM the extension can't write back into.
3. `renderSongToPdf(song, request.data)` produces the PDF. Every action returns `{ pdfDataUrl }` to the popup so it can show the iframe preview; `openTab` additionally creates a Blob object URL and calls `window.open(blobUrl, "_blank")` from the page context.
