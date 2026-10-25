"""Local diagnostic receiver for large, unchanged parity capture reports.

Run from the repository; POST one capture report to /capture/<single-name>.
Existing evidence is never overwritten. This does not control the game.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import re


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--port', type=int, default=4176)
    args = parser.parse_args()
    root = args.root.resolve()
    evidence = (Path(__file__).resolve().parents[1] / 'docs/parity/evidence').resolve()
    if not root.is_relative_to(evidence):
        raise ValueError('Capture root must be inside repository parity evidence')
    root.mkdir(parents=True, exist_ok=True)

    class Handler(BaseHTTPRequestHandler):
        def reply(self, code: int, value: dict) -> None:
            data = json.dumps(value).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

        def do_GET(self) -> None:
            self.reply(200 if self.path == '/health' else 404,
                       {'ready': self.path == '/health', 'root': root.as_posix()})

        def do_POST(self) -> None:
            match = re.fullmatch(r'/capture/([A-Za-z0-9_-]+)', self.path)
            length = int(self.headers.get('Content-Length', '0'))
            if not match or not 0 < length <= 256 * 1024 * 1024:
                self.reply(400, {'error': 'Invalid capture path or payload length'})
                return
            destination = root / match[1]
            if destination.exists():
                self.reply(409, {'error': 'Evidence destination already exists'})
                return
            try:
                report = json.loads(self.rfile.read(length))
                images = report['images']
                decoded: dict[str, bytes] = {}
                for item in images:
                    name = item['name']
                    if not re.fullmatch(r'[A-Za-z0-9_.-]+', name) or name in decoded:
                        raise ValueError('Invalid or duplicate image name')
                    prefix, encoded = item['dataUrl'].split(',', 1)
                    if prefix != 'data:image/png;base64':
                        raise ValueError('Expected actual Canvas PNG')
                    data = base64.b64decode(encoded, validate=True)
                    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
                        raise ValueError('Invalid PNG signature')
                    decoded[name] = data
                trace = {**report, 'images': [
                    {k: v for k, v in item.items() if k != 'dataUrl'} for item in images]}
                trace_bytes = (json.dumps(trace, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
                destination.mkdir()
                hashes = {}
                for name, data in decoded.items():
                    (destination / (name + '.png')).write_bytes(data)
                    hashes[name + '.png'] = hashlib.sha256(data).hexdigest()
                (destination / 'trace.json').write_bytes(trace_bytes)
                hashes['trace.json'] = hashlib.sha256(trace_bytes).hexdigest()
                (destination / 'sha256.json').write_text(json.dumps(hashes, indent=2) + '\n', encoding='utf-8')
                self.reply(201, {'directory': destination.as_posix(), 'frames': len(report['frames']),
                                 'images': len(images), 'receivedBytes': length,
                                 'traceSha256': hashes['trace.json']})
            except (KeyError, TypeError, ValueError) as error:
                self.reply(400, {'error': str(error)})

    print(json.dumps({'listening': args.port, 'root': root.as_posix()}), flush=True)
    HTTPServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
