# Security Policy

## Supported versions

Fixes land on the latest release.

| Version | Supported |
| --- | --- |
| latest on the default branch | Yes |
| older commits and tags | No |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Open a private vulnerability report via GitHub's
"Report a vulnerability" button on the Security tab of the repository. If that
is not available to you, use a private contact method listed on the repository's
GitHub profile. If none is listed, open an issue asking for a private reporting
channel without including vulnerability details.

Please include:

- what the problem is and what an attacker gains
- the exact steps or input needed to reproduce it
- the version, commit, or branch you tested

You can expect an acknowledgement within a few days. Once a fix exists, a patch
will be published and the report credited in the release notes unless you would
rather stay anonymous.

## Threat model

Diagram Desk is a **single-user local tool**. Knowing this makes most of the
design decisions obvious, and it is worth stating plainly:

- The server binds `127.0.0.1` and has no authentication. Anyone who can reach
  the port can read and delete every saved diagram. This is by design — the port
  is loopback-only.
- **Do not expose the port directly to a network.** The server sends no CORS
  headers and rejects writes whose `content-type` is not `application/json`,
  which blocks the simple-request shapes a hostile page can send. That is a
  defense in depth, not an access control. If you need remote access, put an
  authenticating reverse proxy in front of it.
- Diagrams are rendered Mermaid source. Mermaid runs in the browser; a
  Content-Security-Policy is set to block external origins. Do not relax it.
- Deletion is permanent and there is no undo. Back up `data/diagrams.sqlite` if
  a diagram matters to you.
- The SQLite file holds whatever you save. Treat it as private data.

## What is out of scope

- Running the server on a shared or hostile machine — see the threat model.
- Missing authentication on a loopback-only local server.
- Denial of service through local access.
- Vulnerabilities in Mermaid itself; report those
  [upstream](https://github.com/mermaid-js/mermaid/security).
