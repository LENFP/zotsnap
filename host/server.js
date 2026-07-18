// Tiny static server for ZotSnap on the home network. Started at logon by the
// "ZotSnap Server" scheduled task (see host/start-hidden.vbs).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 8420;
const TYPES = { ".html": "text/html; charset=utf-8", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".js": "text/javascript" };

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log("ZotSnap serving on port " + PORT));
