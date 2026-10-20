---
name: diagram-from-discussion
description: Use when someone wants to discuss an issue and author a new Diagram Desk lesson with a native Archify diagram.
---

# Diagram from Discussion

Turn the user's description of an issue into a native Archify diagram and MDX lesson in this static repository. The former in-browser editor and save API are retired. Follow the repository source workflow in [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Interview the issue

Start by inviting the user to describe the issue in their own words. Ask one focused question per turn. Clarify only details needed to represent the issue accurately: the people or systems involved, what triggers the issue, the important steps or dependencies, decisions, effects, and the outcome they want to understand. Use a concrete recent example when it helps.

Do not fill gaps with invented causes, steps, or relationships. Ask when an unknown would change the diagram. Choose a diagram form that fits the conversation; if two forms would tell materially different stories, briefly explain the choice and ask which they want.

Once the model is clear, give a short plain-language summary of what the diagram will show. Correct it if the user points out a mismatch.

## Draft and review the source

1. Read an existing `catalog/diagrams/<slug>.json`, its entry in `catalog/index.json`, and its MDX article as examples. Use the vendored Archify schema and CLI documentation for the chosen native diagram type. Keep labels, relationships, and direction faithful to the discussion.
2. Add the native JSON, catalog entry, and article together. Follow the required frontmatter and embed format in `README.md`. New lessons do not need invented legacy UUIDs; preserve existing legacy mappings.
3. Run `npm test`. Start or rebuild the local preview, open the actual article and reader, and inspect the rendered diagram. Correct errors before requesting review.
4. Show the rendered draft and ask whether it represents the issue correctly. Apply requested changes and preview again. Get approval before committing or publishing the new lesson.

Do not call a retired API or write a SQLite database. Preserve unrelated source work. If the preview cannot run, report that limit and leave a reviewable source draft; do not invent a live link.

## Verify and return the link

Confirm the article title, rendered reader, and reader controls in the browser. Return the verified article URL and, when useful, its full reader URL. URLs must include the configured hosting base. Identify whether the link is a local preview or a published page. Do not claim publication until a deployment succeeds and its public URL has been checked.
