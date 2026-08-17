# Avon Eagles Football — Roster Lookup

Enter a jersey number, see the player. Built for phones on the sideline and in
the press box, and it works with no signal once it has been opened.

**Live:** https://edskimin.github.io/AvonFootball2026/

## Two pages

- **`index.html`** — the lookup. Enter a number, get the player.
- **`roster.html`** — the full roster in jersey number order, two lines per
  player with positions right-aligned on the name's line.

The pill in the top right of the header switches between them: it reads
**Roster** on the lookup page and **Lookup** on the roster page.

## How it behaves

- **The number pad is part of the page**, not the phone's keyboard. iOS puts an
  AutoFill bar (key / card / location icons) above the system keyboard on any
  focused text field, and there is no way for a page to suppress it — it was
  covering the second player on shared numbers. So there is no focusable input
  here at all. The keypad is fixed to the bottom of the screen, the buttons are
  bigger than system keys, and nothing ever covers the card. On a laptop you
  can just type: digits, Backspace, and Enter all work.
- **Two digits fire automatically.** Every number on the roster is one or two
  digits, and 0–9 are all real jerseys, so a single digit can't submit on its
  own — it might be the first half of a two-digit number. For #0 through #9,
  tap the digit and then **GO**.
- **Shared numbers show both players.** 27 of the 91 numbers in use are worn by
  two players. Both appear on one card, higher grade on top. When both players
  are the same grade (#35, #44, #68), the heavier player goes on top.
- **Lookups stack.** The newest card sits at the top under the search bar, with
  the earlier ones below it — scroll down to see what you already looked up.
  Looking up the same number twice moves it back to the top instead of adding a
  duplicate. **Clear lookups** empties the list, and so does a page refresh.
- **Numbers with no player** (#69, #71, #91, #93, #94) get a plain "no player
  wears this" card, which fades and collapses after about three seconds so a
  mistyped number doesn't leave litter in the history. The card below it is
  promoted back to the full hero treatment when it goes. Timing lives in
  `MISSING_LINGER_MS` in `app.js`.

## Updating the roster

Edit `data/roster-2026.csv` — same column layout as the media roster export
(`#, Name, GR, HT, WT, Pos, Pos`) — then regenerate:

```bash
python3 tools/build_roster.py
```

That rewrites `roster.json`, applying the sort order the page depends on:
higher grade first, then heavier player, then last name so the order never
wobbles between builds.

**Then bump the cache version in `sw.js`** (`eagles-roster-v3` → `-v4`) and
push. The service worker is network-first for the page and the roster, so a
phone with a signal picks up the change on the next open; the version bump is
what clears the old files for phones that were offline.

You can also hand-edit `roster.json` directly for a one-off change, but the CSV
is the source of truth and the next build will overwrite you.

## Running it locally

`roster.json` is fetched, and browsers block `fetch` on `file://` URLs, so
opening `index.html` by double-clicking it will show a "Roster didn't load"
message. Serve it instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

While you are changing CSS or JS, the service worker will keep serving cached
copies. In DevTools use Application → Service Workers → Unregister, or tick
"Bypass for network".

## Deploying

The site is plain static files — no build step.

```bash
git add -A && git commit -m "Update roster" && git push
```

GitHub Pages settings for this repo: **Settings → Pages → Source: Deploy from a
branch → Branch: `main` / `(root)`**. A push takes about a minute to go live.

## Adding player photos later

The card layout leaves room for a headshot. When you have them:

1. Drop the images in `assets/players/` named by jersey and last name, e.g.
   `88-skimin.jpg`.
2. Add a `"photo"` key to the player entries in `tools/build_roster.py`.
3. Render it in `buildPlayer()` in `app.js`, and add a rule for the image in
   the `.player` block in `styles.css`.

Until then the jersey number carries the card, which is why it is set large and
in gold.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Lookup page structure and the card templates |
| `roster.html` | Full roster page |
| `styles.css` | All styling for both pages, brand tokens at the top |
| `app.js` | Lookup, card rendering, service worker registration |
| `roster.js` | Renders the full roster list |
| `roster.json` | Generated — do not hand-edit if you can avoid it |
| `sw.js` | Offline cache. Bump `CACHE` on every content change |
| `data/roster-2026.csv` | Source of truth for the roster |
| `tools/build_roster.py` | CSV → `roster.json` |
| `tools/fetch_fonts.py` | Re-downloads the self-hosted fonts (rarely needed) |
| `assets/eagle.png` | Eagle mark, background removed |
| `assets/fonts/` | Bitter, Open Sans, IBM Plex Mono — latin subsets |

## Notes

Colors and type follow the Avon Local Schools draft brand guide: Eagle Purple
`#4B2E83`, Eagle Gold `#FDB515`, Bitter for display, Open Sans for text, IBM
Plex Mono for data. The gold rule under the purple masthead is the district's
signature device and appears once, at the top.

Fonts are self-hosted rather than loaded from Google so the page renders
correctly with no network. Nothing on the page calls out to a third party.

This is an unofficial tool and not an Avon Local Schools publication. The eagle
mark is the district's athletic mark, used here for a district-affiliated
purpose.
