from http.server import BaseHTTPRequestHandler
import json
import tempfile
from pathlib import Path
from .generate import generate


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            spec = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            if spec.get('dfm_validation_report', {}).get('status') == 'blocked':
                self.send_response(422)
                self.end_headers()
                self.wfile.write(b'Resolve blocking DFM findings before CAD export.')
                return
            with tempfile.TemporaryDirectory() as directory:
                result = generate(spec, directory)
                content = (Path(directory) / result['step']).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', f"attachment; filename={result['step']}")
            self.end_headers()
            self.wfile.write(content)
        except Exception as error:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(error)}).encode())
