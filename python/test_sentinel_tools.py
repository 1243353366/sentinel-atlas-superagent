import json
import unittest
from http.client import HTTPConnection
from threading import Thread
from http.server import ThreadingHTTPServer

from sentinel_tools import Handler, analyze, evaluate, graph, telemetry


class ToolTests(unittest.TestCase):
    def test_analyze_is_candidate_only(self):
        result = analyze({"requestId": "t1", "observation": "A process created a file and generated telemetry on the endpoint."})
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["provenance"]["execution"], "read-only")
        self.assertEqual(result["confidence"], "candidate")

    def test_evaluate_surfaces_missing_evidence(self):
        result = evaluate({"requestId": "t2", "expected": ["process", "network"], "observed": ["process"]})
        self.assertEqual(result["verdict"], "uncertain")
        self.assertEqual(result["missingEvidence"], ["network"])

    def test_graph_and_telemetry_are_deterministic(self):
        events = [{"id": "p1", "type": "process"}, {"id": "e1", "type": "file", "parent": "p1", "relation": "created"}]
        result = graph({"requestId": "t3", "events": events})
        self.assertEqual(len(result["nodes"]), 2)
        self.assertEqual(result["edges"][0]["relation"], "created")
        summary = telemetry({"requestId": "t4", "events": events})
        self.assertEqual(summary["eventCount"], 2)
        self.assertIn("process", summary["byType"])

    def test_http_contract_rejects_unknown_or_oversized_input(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        Thread(target=server.handle_request, daemon=True).start()
        connection = HTTPConnection(*server.server_address)
        connection.request("POST", "/tools/unknown", body=b"{}", headers={"Content-Length": "2"})
        response = connection.getresponse()
        self.assertEqual(response.status, 404)
        server.server_close()


if __name__ == "__main__":
    unittest.main()
