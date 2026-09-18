# Python Research Layer

The Python layer is the laboratory for offline analysis, model evaluation, evidence extraction, graph construction, telemetry summarization, and future corpus processing. It is intentionally not a second control plane.

Run it locally with `python3 python/sentinel_tools.py`. The service listens on `127.0.0.1:8788` and exposes four versioned JSON endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /tools/analyze` | Extract candidate evidence terms from an observation. |
| `POST /tools/evaluate` | Compare expected and observed evidence and surface uncertainty. |
| `POST /tools/telemetry` | Summarize event counts and produce an evidence hash. |
| `POST /tools/graph` | Build a bounded relationship graph from supplied events. |

The service has no permission-escalation capability, does not execute samples, does not make outbound requests, and does not alter the Sentinel Atlas database. The JavaScript/Cloudflare control plane remains authoritative for policy, auth, persistence, and human approval. A future adapter should call these endpoints through a timeout, schema validation, provenance propagation, and explicit failure mapping.
