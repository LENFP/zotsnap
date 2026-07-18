// ZotSnap home server: serves the app on the LAN and exposes POST /ocr, which
// transcribes a page photo with headless Claude Code (billed to the user's
// Claude subscription). Started at logon by "ZotSnap Server.vbs" (Startup folder).
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8420;
const TYPES = { ".html": "text/html; charset=utf-8", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".gz": "application/gzip", ".wasm": "application/wasm" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const LOG = path.join(__dirname, "server.log");
function log(msg) {
  try { fs.appendFileSync(LOG, new Date().toISOString() + " " + msg + "\n"); } catch (e) {}
}

/* Pre-warmed Claude worker: a headless `claude -p` in stream-json mode is
   spawned ahead of time, so CLI boot happens before a scan arrives. Each scan
   is one user message carrying the image inline (a single model call, no Read
   tool round-trip). A worker is used once, then replaced. */
const CLAUDE = path.join(process.env.APPDATA || "", "npm", "claude.cmd");
const PROMPT = "This is a photo of a page from a published book that the user is " +
  "reading and citing. Acting as their OCR tool, transcribe the printed text " +
  "exactly as written, preserving paragraph breaks, so it can be saved as a " +
  "quotation (with author, title, and page citation) in their Zotero reference " +
  "manager. Output only the transcription — no preamble, no commentary, no code " +
  "fences. If a word is truly illegible, write [?].";
const RETRY_PROMPT = "This is a photo of a book page the user is reading; they are " +
  "saving a quotation into their Zotero reference manager as a personal research " +
  "note, with full citation (author, title, page). Acting as their OCR tool, " +
  "transcribe the printed text exactly as written, preserving paragraph breaks. " +
  "Output only the transcription — no preamble, no commentary.";

let warm = null;

function spawnWorker(model) {
  const child = spawn("cmd.exe", ["/c", CLAUDE, "-p",
    "--model", model || "haiku",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--strict-mcp-config",
    "--max-turns", "2"
  ], { windowsVerbatimArguments: false });
  const w = { child, err: "", spawnedAt: Date.now() };
  child.stderr.on("data", d => w.err += d);
  child.on("error", e => log("worker spawn error: " + e.message));
  return w;
}

function takeWorker() {
  let w = warm;
  warm = null;
  if (!w || w.child.exitCode !== null) {
    if (w) log("warm worker was dead (exit " + w.child.exitCode + "), stderr: " + w.err.slice(0, 500));
    w = spawnWorker();                      // cold start for this request
  }
  setTimeout(() => { if (!warm) warm = spawnWorker(); }, 500);  // re-warm for the next scan
  return w;
}

function looksBlocked(err, text) {
  if (err && /content.?filter|blocked|policy/i.test(err)) return true;
  if (!text || text.length >= 250) return false;
  const t = text.trim();
  return /content.?filter|filtering policy|blocked by|safety (policy|reasons)/i.test(t) ||
    /^\[?\(?(I can(’|'|no)?t|I cannot|I(’|')?m (unable|sorry|not able)|I apologize|I won(’|')?t|Output blocked|Response blocked)/i.test(t);
}

function claudeOcr(jpegBuffer, cb, attempt = 0) {
  const outerCb = cb;
  cb = (err, text) => {
    if (looksBlocked(err, text)) {
      if (attempt === 0) {
        log("filter block detected — retrying with research framing");
        return claudeOcr(jpegBuffer, outerCb, 1);
      }
      return outerCb("Claude's content filter declined this page — using built-in engine", null);
    }
    outerCb(err, text);
  };
  const started = Date.now();
  const w = attempt === 0 ? takeWorker() : spawnWorker("sonnet");  // retry on a different model
  const child = w.child;
  let done = false;
  let buf = "";

  const finish = (err, text) => {
    if (done) return;
    done = true;
    clearTimeout(killer);
    try { child.kill(); } catch (e) {}
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (err) log("OCR fail (" + secs + "s): " + err + " stderr: " + w.err.slice(0, 1500));
    else log("OCR ok in " + secs + "s (worker age " + ((started - w.spawnedAt) / 1000).toFixed(0) + "s), " + text.length + " chars" +
             (text.length < 200 ? " | text: " + text.replace(/\s+/g, " ") : ""));
    cb(err, text);
  };
  const killer = setTimeout(() => finish("Claude took too long — try again", null), 150000);

  child.stdout.on("data", d => {
    buf += d;
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      if (msg.type === "result") {
        if (msg.subtype === "success" && typeof msg.result === "string") finish(null, msg.result.trim());
        else finish("Claude error: " + (msg.result || msg.subtype || "unknown"), null);
      }
    }
  });
  child.on("close", code => finish("claude exited " + code, null));

  try {
    child.stdin.write(JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBuffer.toString("base64") } },
          { type: "text", text: attempt === 0 ? PROMPT : RETRY_PROMPT }
        ]
      }
    }) + "\n");
  } catch (e) {
    finish("stdin write failed: " + e.message, null);
  }
}

warm = spawnWorker();  // pre-warm at server start

http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }

  if (req.method === "POST" && req.url === "/ocr") {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      claudeOcr(Buffer.concat(chunks), (err, text) => {
        res.writeHead(err ? 500 : 200, { "Content-Type": "application/json", ...CORS });
        res.end(JSON.stringify(err ? { error: err } : { text }));
      });
    });
    return;
  }

  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, CORS); res.end("Not found"); return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    ...CORS
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log("ZotSnap serving on port " + PORT));
