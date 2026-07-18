"""Regenerate the ZotSnap setup QR code on the Desktop.

Encodes http://<current-LAN-IP>:8420/#k=<API key> — scan it with the iPhone
camera to open the app already connected. Re-run this if the PC's LAN IP
changes (the phone app keeps working from its saved key either way; only the
URL part matters after first setup).
"""
import socket
import subprocess
import sys
from pathlib import Path

import segno

PORT = 8420
KEY_FILE = Path(__file__).with_name("zotero-key.txt")
URL_FILE = Path(__file__).with_name("public-url.txt")  # if present, QR uses this instead of the LAN IP
OUT = Path.home() / "Desktop" / "ZotSnap-QR.png"


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no traffic sent; just selects the outbound interface
        return s.getsockname()[0]
    finally:
        s.close()


key = KEY_FILE.read_text().strip() if KEY_FILE.exists() else ""
if not key:
    sys.exit(f"Put the Zotero API key in {KEY_FILE} first.")

base = URL_FILE.read_text().strip().rstrip("/") + "/" if URL_FILE.exists() else f"http://{lan_ip()}:{PORT}/"
url = f"{base}#k={key}"
segno.make(url, error="m").save(str(OUT), scale=10, border=3)
print(f"QR for {url}\nsaved to {OUT}")
try:
    subprocess.run(["cmd", "/c", "start", "", str(OUT)], check=False)
except OSError:
    pass
