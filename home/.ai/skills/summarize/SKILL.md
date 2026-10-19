---
name: summarize
description: Fetch and summarize a web article from a URL, optionally applying the user's requested focus or lens. Use when the user invokes /summarize or asks for an article summary.
---

# Summarize

Fetch and summarize the article requested by the user. Use the invocation arguments
or the user's message for the URL and optional instruction; harnesses that support
interpolation may expose these as `$ARGUMENTS`.

1. Extract the article URL (http:// or https://). If none was provided, ask for it.
2. Fetch the article with `curl -fsSL -- "https://r.jina.ai/{url}"`, replacing
   `{url}` with the full article URL and safely quoting the shell argument.
   For GitHub URLs, use the authenticated `gh` CLI instead.
3. Using the fetched content, respond to the specific instruction in the request.
   - If no instruction was given, provide a concise TL;DR followed by key takeaways as bullet points.
   - If an instruction was given (e.g. "ignore the hype", "what's important to know?"), apply that lens to the summary.
   - Keep the response focused and skip boilerplate, ads, and navigation text.
   - Link to the original article. If fetching fails or the content is incomplete, say so rather than inventing a summary.
