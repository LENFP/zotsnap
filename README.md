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

## Setup (already automated on this PC)

The PC hosts the app itself — `host/server.js` serves this folder on port **8420**,
started silently at every logon by `ZotSnap Server.vbs` in the user Startup folder,
with a Windows Firewall rule allowing the port on private networks.

**On the iPhone (once):** scan **`Desktop\ZotSnap-QR.png`** with the camera. It opens
the app with the API key embedded in the URL fragment (`#k=…`) — the app validates it,
stores it in local storage, and strips it from the address bar. Then
**Share → Add to Home Screen** so it launches full-screen like an app.

Notes:
- The key lives in `host/zotero-key.txt` (gitignored) and on the phone — nowhere else.
  A URL fragment is never sent over the network by the browser.
- If the PC's LAN IP changes, run `python host/make-qr.py` to regenerate the QR.
- Phone and PC must be on the same Wi-Fi and the PC awake **to load the app**;
  captures then talk straight to api.zotero.org.
- To host it publicly instead (works away from home): push to GitHub Pages —
  **without** the key file — and open `https://<you>.github.io/zotsnap/#k=<key>` once.

## Using it

1. Tap the ZotSnap icon.
2. Pick the book (it remembers the last one — great for long reading sessions;
   the search box also lists recently modified items).
3. Tap the capture box → tap the **scan text** camera button on the keyboard →
   point at the page → Insert. Scan multiple passages if you want.
4. Enter page number, tap tag chips (it remembers your recent tags) or type new ones.
5. **Add to Zotero.** Done — text box clears, book stays selected for the next capture.

### Options

- **One "Captured Quotes" note per book** (default): every capture appends to a single
  running note under the item, separated by rules, each stamped with page + date.
  Turn it off to get one note per capture instead.
- Text cleanup is automatic: hyphenated line-breaks are rejoined, hard line breaks
  from the scan are merged, blank lines become paragraphs.

## Files

- `index.html` — the entire app (no build step, no dependencies).
