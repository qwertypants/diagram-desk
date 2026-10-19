---
name: diagram-from-discussion
description: Use when someone wants to talk through an issue and have a new diagram created and saved in the text2diagram app.
---

# Diagram from Discussion

Turn the user's description of an issue into a native Archify diagram in the running text2diagram app. Finish with a verified link to the saved diagram.

## Interview the issue

Start by inviting the user to describe the issue in their own words. Ask one focused question per turn. Clarify only details needed to represent the issue accurately: the people or systems involved, what triggers the issue, the important steps or dependencies, decisions, effects, and the outcome they want to understand. Use a concrete recent example when it helps.

Do not fill gaps with invented causes, steps, or relationships. Ask when an unknown would change the diagram. Choose a diagram form that fits the conversation; if two forms would tell materially different stories, briefly explain the choice and ask which they want.

Once the model is clear, give a short plain-language summary of what the diagram will show. Correct it if the user points out a mismatch.

## Draft and review in the app

Use the user's existing browser session and the app's visible interface. Do not create or save the diagram through an API, database, or direct storage edit. Preserve any unrelated unsaved editor work; if the app warns that navigation would discard it, cancel and ask the user how to proceed.

1. Open **New diagram** in the app.
2. Choose the matching diagram type and enter a concise title and native Archify JSON grounded in the conversation. Use the installed Archify skill and the app's starter for the chosen type. Keep labels clear and relationships/direction faithful to what the user said.
   Add optional learning notes as JSON when they help explain decisions, failure modes, or sources. The selected type must match `diagram_type`; source requires a native `meta.title` and portable `meta.output`.
3. Wait for the app's preview to render successfully. If Archify fails, fix the source in the editor and wait for a successful preview. Never treat source text alone as proof that the diagram works.
4. Show the rendered draft to the user and ask whether it represents the issue correctly before saving. Make requested changes, preview again, and get approval for the revised draft.
5. Save only after the user approves the rendered draft.

If the app or its browser session is unavailable, stop before saving and tell the user what is unavailable. Do not claim completion or invent a link. If saving fails, report the app's visible error and keep the draft available where possible.

## Verify and return the link

After saving, confirm the app has navigated to the new diagram's viewer and that the saved title and rendered diagram are visible. Capture the actual URL from the browser address bar/current page. The app's saved diagram route is `/diagrams/<id>`; do not guess an ID or origin.

Return the exact URL as a clickable Markdown link and identify the diagram by title. Only provide a link after the saved viewer has loaded successfully. If the app is local, the link is reachable only where that app is running; say so briefly when relevant.
