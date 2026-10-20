# Security Policy

## Supported versions

Security fixes target the latest release on the default branch. Older commits and tags are not supported.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use [GitHub's private vulnerability reporting](https://github.com/qwertypants/diagram-desk/security/advisories/new). If unavailable, use a private contact method on the repository profile. If none is listed, request a private reporting channel in an issue without posting vulnerability details.

Include the impact, reproduction steps or input, and the version or commit tested. We credit reporters in release notes unless they prefer otherwise. This is a community-maintained project with no guaranteed response time.

## Threat model

Diagram Desk builds a static public site from version controlled MDX articles and Archify JSON. The deployed site has no database, authentication, write API, or user-specific data. Its main trust boundary is the build: contributors and maintainers review source content, diagrams, scripts, and dependencies before publishing generated HTML and JavaScript.

- Treat MDX, catalog JSON, and external references as public content. Do not commit secrets or private records.
- Archify readers contain generated HTML and JavaScript. Article embeds use an iframe sandbox with scripts, downloads, and user-activated popups allowed, without same-origin access. Popups escape the iframe sandbox so external links can open as normal pages; link decoration adds `noopener noreferrer`. Review diagram changes and dependency updates, then test the built output before publishing.
- GitHub Pages serves public static files. This repository does not configure custom HTTP security response headers on Pages. For control over those headers, choose a host or proxy that supports them. The former application's server headers do not apply to this static deployment.
- Article styling requests fonts from Google Fonts. External reference links also contact third-party sites when followed. No account, write API, or analytics service is configured by this application.
- External reference links may lead away from the site. Readers should verify those destinations independently.
- Build and preview commands run local tools and are intended for trusted repository contributions. Do not execute unreviewed pull request code with privileged credentials.

Vulnerabilities in vendored Archify or other dependencies should be reported privately here and, when appropriate, upstream.
