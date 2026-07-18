# ZotSnap 📚

Point your iPhone camera at a book page → the text lands in your Zotero library as a
note on the right item, with page number and tags. No App Store, no Apple Developer
account, no Mac — it's a single HTML file that runs in Safari and talks to the free
Zotero Web API. Notes sync to your desktop Zotero automatically via Zotero's own sync.

## How it works

- **OCR**: iOS's built-in **Live Text** ("scan text" button on the keyboard). Tap the
  capture box, tap the camera icon above the keyboard, point at the page. Apple's OCR
  is excellent with printed book text and costs nothing.
- **Zotero**: the app calls `api.zotero.org` directly from Safari (Zotero's API allows
  browser access). It searches your library, then either appends to the item's
  **"Captured Quotes"** note or creates a new child note, with your tags and `p. N`.
- **Sync**: Zotero's normal sync brings the note to your PC — nothing to install there.

## Setup (already automated)

The app is live at **<https://lenfp.github.io/zotsnap/>** (GitHub Pages, repo
`LENFP/zotsnap`, deployed from `main`). A service worker caches the app shell, so
once installed it opens instantly and even offline; saving captures needs a
connection to api.zotero.org.

**On the iPhone (once):** scan **`Desktop\ZotSnap-QR.png`** with the camera. It opens
the app with the API key embedded in the URL fragment (`#k=…`) — the app validates it,
stores it in local storage, and strips it from the address bar. Then
**Share → Add to Home Screen** so it launches full-screen like an app.

Key handling:
- The key lives in `host/zotero-key.txt` (**gitignored — never commit or publish it**)
  and in the phone's local storage — nowhere else. URL fragments are never sent over
  the network. `host/make-qr.py` regenerates the Desktop QR
  (`host/public-url.txt` selects the public URL; delete it to fall back to LAN).

Fallback LAN hosting (also set up, optional): `host/server.js` serves this folder on
port 8420, auto-started at logon via `ZotSnap Server.vbs` in the Startup folder, with
a firewall rule for private networks.

## Using it

1. Tap the ZotSnap icon.
2. Pick the book (it remembers the last one — great for long reading sessions;
   the search box also lists recently modified items).
3. Tap the capture box → tap the **scan text** camera button on the keyboard →
   point at the page → Insert. Scan multiple passages if you want.
4. Optional: tap **𝐁 Bold phrases**, then just tap words — or drag a finger across a
   phrase — to bold the important bits (no iOS text selection). Tap again to undo,
   **Done** to keep. Bolding shows as `**markers**` in the text and becomes real
   bold in the Zotero note.
5. Enter page number, tap tag chips (it remembers your recent tags) or type new ones.
6. **Add to Zotero.** Done — text box clears, book stays selected for the next capture.

### Options

- **One "Captured Quotes" note per book** (default): every capture appends to a single
  running note under the item, separated by rules, each stamped with page + date.
  Turn it off to get one note per capture instead.
- Text cleanup is automatic: hyphenated line-breaks are rejoined, hard line breaks
  from the scan are merged, blank lines become paragraphs.

## Files

- `index.html` — the entire app (no build step, no dependencies).
