#!/usr/bin/env python3
"""Sentinel Atlas Python research layer.

This service is intentionally read-only: it analyzes supplied observations and
telemetry, builds evidence relationships, and returns provenance. It never
executes code, downloads samples, changes permissions, or makes network calls.
"""
from __future__ import annotations

import hashlib
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

VERSION = "v1"
MAX_BODY = 32_000


def provenance(request: dict[str, Any], tool: str) -> dict[str, Any]:
    return {
        "tool": tool,
        "version": VERSION,
        "requestId": str(request.get("requestId", "unknown")),
        "execution": "read-only",
        "authority": "no permission escalation",
    }


def analyze(request: dict[str, Any]) -> dict[str, Any]:
    observation = str(request.get("observation", "")).strip()
    if not 10 <= len(observation) <= 1800:
        raise ValueError("observation must be between 10 and 1800 characters")
    terms = sorted(set(re.findall(r"\b(?:process|file|task|login|dns|network|telemetry|endpoint|user|host)\b", observation.lower())))
    return {
        "version": VERSION,
        "status": "ok",
        "summary": "Python research layer extracted evidence-bearing terms without asserting compromise.",
        "entities": [{"type": "term", "value": term} for term in terms],
        "confidence": "candidate" if terms else "uncertain",
        "provenance": provenance(request, "analyze"),
    }


def evaluate(request: dict[str, Any]) -> dict[str, Any]:
    expected = {str(item) for item in request.get("expected", [])}
    observed = {str(item) for item in request.get("observed", [])}
    if not expected or not isinstance(request.get("observed", []), list):
        raise ValueError("expected and observed telemetry lists are required")
    missing = sorted(expected - observed)
    matched = sorted(expected & observed)
    verdict = "supported" if not missing else "uncertain" if matched else "unsupported"
    return {
        "version": VERSION,
        "status": "ok",
        "verdict": verdict,
        "matchedEvidence": matched,
        "missingEvidence": missing,
        "provenance": provenance(request, "evaluate"),
    }


def graph(request: dict[str, Any]) -> dict[str, Any]:
    events = request.get("events", [])
    if not isinstance(events, list) or len(events) > 500:
        raise ValueError("events must be a list with at most 500 items")
    nodes: dict[str, dict[str, str]] = {}
    edges: list[dict[str, str]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        event_id = str(event.get("id", "event-unknown"))
        nodes[event_id] = {"id": event_id, "type": str(event.get("type", "event"))}
        parent = event.get("parent")
        if parent:
            parent_id = str(parent)
            nodes.setdefault(parent_id, {"id": parent_id, "type": "parent"})
            edges.append({"from": parent_id, "to": event_id, "relation": str(event.get("relation", "related"))})
    return {
        "version": VERSION,
        "status": "ok",
        "nodes": list(nodes.values()),
        "edges": edges,
        "provenance": provenance(request, "graph"),
    }


def telemetry(request: dict[str, Any]) -> dict[str, Any]:
    events = request.get("events", [])
    if not isinstance(events, list) or len(events) > 500:
        raise ValueError("events must be a list with at most 500 items")
    counts: dict[str, int] = {}
    for event in events:
        kind = str(event.get("type", "unknown")) if isinstance(event, dict) else "invalid"
        counts[kind] = counts.get(kind, 0) + 1
    digest = hashlib.sha256(json.dumps(events, sort_keys=True).encode()).hexdigest()
    return {
        "version": VERSION,
        "status": "ok",
        "eventCount": len(events),
        "byType": counts,
        "evidenceHash": digest,
        "provenance": provenance(request, "telemetry"),
    }


TOOLS = {"analyze": analyze, "evaluate": evaluate, "graph": graph, "telemetry": telemetry}


class Handler(BaseHTTPRequestHandler):
    server_version = "SentinelPythonTools/1.0"

    def _write(self, status: int, body: dict[str, Any]) -> None:
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:  # noqa: N802
        match = re.fullmatch(r"/tools/(analyze|evaluate|telemetry|graph)", self.path)
        if not match:
            self._write(404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("request body is empty or too large")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("request must be a JSON object")
            result = TOOLS[match.group(1)](payload)
            self._write(200, result)
        except (ValueError, json.JSONDecodeError) as exc:
            self._write(400, {"error": "invalid_input", "message": str(exc), "version": VERSION})
        except Exception:
            self._write(503, {"error": "tool_failure", "retryable": False, "version": VERSION})

    def log_message(self, *_args: Any) -> None:
        return


def serve(host: str = "127.0.0.1", port: int = 8788) -> None:
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    serve()
