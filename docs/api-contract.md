# Diagram API

One loopback Node server serves the app and `/api` endpoints. The default origin
is `http://127.0.0.1:4317`. JSON errors use `{ "error": "human-readable text" }`.
Writes require `content-type: application/json`; cross-origin writes receive no
CORS permission. Unsupported methods receive `405` and `Allow`.

## Diagram object

```json
{
  "id": "server-generated UUID",
  "title": "A support agent",
  "source": "{ native Archify JSON as a string }",
  "type": "workflow",
  "lesson": {
    "summary": "Authorization precedes execution.",
    "objectives": ["Locate the permission gate."],
    "walkthrough": [{"title": "Authorize", "detail": "Check the proposed operation."}],
    "references": [{"title": "Reference", "url": "https://example.com"}]
  },
  "createdAt": "2026-10-19T12:00:00.000Z",
  "updatedAt": "2026-10-19T12:00:00.000Z"
}
```

Titles contain 1–200 characters after trimming; source contains 1–100000.
Both are stored exactly as submitted. `type` matches native `diagram_type` and
is one of architecture, workflow, sequence, dataflow, lifecycle, erd, class,
tree, timeline, or waterfall. Typed writes must compile successfully before
persistence. There is no shell interpolation or caller-controlled output path.

`lesson` is optional or null. Its optional text fields are `summary`, `problem`,
and `scope`. Its text-list fields are `objectives`, `decisions`, `failureModes`,
and `takeaways`. `walkthrough` contains objects with text `title` and `detail`;
`references` contains objects with text `title` and HTTP(S) `url`. Text fields
have a 4000-character limit, and lists have at most 50 items. Unknown lesson
fields are rejected. Lesson content renders as text, never authored HTML.

For archival API compatibility, requests without `type` retain the original
opaque-source storage contract. They have no native reader until migrated.
The browser editor always sends native typed candidates. Mermaid is never
parsed or rendered at runtime.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/diagrams?q=term` | `{diagrams: [...]}`, newest first, title tie-breaker; case-insensitive title search |
| GET | `/api/diagrams/:id` | Diagram object, or 404 |
| POST | `/api/diagrams` | Required `title`, `source`; native `type`, optional `lesson`; returns 201 |
| PUT | `/api/diagrams/:id` | Replace title/source and supplied native metadata; returns 200 or 404 |
| DELETE | `/api/diagrams/:id` | Permanent deletion; returns empty 204 or 404 |
| POST | `/api/preview` | Same native input as create; returns `{readerUrl, sourceHash}` without saving |
| GET | `/api/previews/:digest` | Isolated compiled HTML, or 404 after eviction/expiry |
| GET | `/api/diagrams/:id/reader` | Compile/reuse current source and return isolated HTML; 409 for an unmigrated archive |

Invalid input and native render failures return `400`; non-JSON writes return
`415`. Native previews require `type`, even though archival CRUD permits its
absence. Preview URLs last at most ten minutes and may be evicted earlier from
the 32-entry cache. Re-request preview after expiry. The digest binds type,
source, and the pinned renderer version.

A native reader has a separate CSP and an opaque sandbox. Its inline scripts
are allowed by content hashes; connections, forms, and parent access are denied.
The host retains `script-src 'self'`. HTML is derived output, not canonical
storage or client-supplied input.

## Persistence

SQLite stores original `diagrams` records plus `diagram_details` for native
metadata and a `library_meta` seed marker. Typed source and metadata writes are
transactional. Successful responses follow committed writes. Updates preserve
ID and creation time; ordinary edits update `updatedAt`. Catalog migration
preserves both original timestamps. Restarting never resets an initialized
library or resurrects deleted content.
