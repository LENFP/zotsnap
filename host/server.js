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

function claudeOcr(imagePath, cb) {
  const prompt = "Use the Read tool to view the image file at " + imagePath +
    " then output ONLY the exact transcription of all printed text in it, " +
    "preserving paragraph breaks. No preamble, no commentary, no code fences. " +
    "If a word is truly illegible, write [?].";
  const CLAUDE = path.join(process.env.APPDATA || "", "npm", "claude.cmd");
  const started = Date.now();
  const child = spawn("cmd.exe", ["/c", CLAUDE, "-p", "--model", "haiku", "--allowedTools", "Read", "--max-turns", "4"], {
    windowsVerbatimArguments: false,
    timeout: 180000
  });
  let out = "", err = "";
  child.stdout.on("data", d => out += d);
  child.stderr.on("data", d => err += d);
  child.on("error", e => { log("OCR spawn error: " + e.message); cb(e.message, null); });
  child.on("close", code => {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (code !== 0) {
      log("OCR fail (exit " + code + ", " + secs + "s) stderr: " + err.slice(0, 2000) + " stdout: " + out.slice(0, 500));
      cb(code === null ? "Claude took too long (>3 min) — try again" :
         "claude exited " + code + (err ? ": " + err.slice(0, 300) : ""), null);
    } else {
      log("OCR ok in " + secs + "s, " + out.length + " chars");
      cb(null, out.trim());
    }
  });
  child.stdin.write(prompt);
  child.stdin.end();
}

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
      const tmp = path.join(os.tmpdir(), "zotsnap-scan-" + Date.now() + ".jpg");
      fs.writeFileSync(tmp, Buffer.concat(chunks));
      claudeOcr(tmp, (err, text) => {
        try { fs.unlinkSync(tmp); } catch (e) {}
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
