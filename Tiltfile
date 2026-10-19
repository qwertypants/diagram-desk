# Diagram Desk is one local Node process over a SQLite file -- no Compose, no
# Kubernetes, nothing to schedule. This file runs the repo's own `npm start`
# (build, then serve) and nothing else. See README.md -> "Development with Tilt".

local_resource(
    "diagram-desk",
    serve_cmd="npm start",
    deps=[
        "package.json",
        "index.html",
        "vite.config.js",
        "server/",
        "src/",
        "catalog/",
        "public/",
        "vendor/archify/",
    ],
    links=["http://127.0.0.1:4317"],
    # npm start builds before serving, so allow for the build, then check the
    # documented API instead of inventing a health endpoint. The port is the
    # default PORT=4317; if you export PORT, update it here or drop the probe.
    readiness_probe=probe(
        http_get=http_get_action(port=4317, path="/api/diagrams"),
        initial_delay_secs=5,
        timeout_secs=60,
    ),
)
