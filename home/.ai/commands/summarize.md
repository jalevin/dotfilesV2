---
description: Fetch and summarize a web article
argument-hint: [your instruction] <url>
allowed-tools: Bash
---

Fetch and summarize a web article based on this request: $ARGUMENTS

Steps:
1. Extract the URL from the request (look for http:// or https://)
2. Fetch the article by running: `curl -s "https://r.jina.ai/{url}"`
3. Using the fetched content, respond to the specific instruction in the request.
   - If no instruction was given, provide a concise TL;DR followed by key takeaways as bullet points.
   - If an instruction was given (e.g. "ignore the hype", "what's important to know?"), apply that lens to the summary.
   - Keep the response focused and skip boilerplate, ads, and navigation text.
