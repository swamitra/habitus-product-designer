from http.server import BaseHTTPRequestHandler
import json
import tempfile
from pathlib import Path
from .generate import generate


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            spec = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            with tempfile.TemporaryDirectory() as directory:
                result = generate(spec, directory)
                content = (Path(directory) / result['dxf']).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/dxf')
            self.send_header('Content-Disposition', f"attachment; filename={result['dxf']}")
            self.end_headers()
            self.wfile.write(content)
        except Exception as error:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(error)}).encode())
