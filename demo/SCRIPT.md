# The demo, shot by shot

One video, about two and a half minutes. Opens and closes with motion pieces rendered
by HyperFrames; everything in between is the live deployment, driven by hand, captured
as it was. No mock data appears anywhere, and nothing is claimed that the deployment
cannot be asked to confirm with a request.

| # | kind | picture | narration |
|---|---|---|---|
| 1 | motion | title, then the rule it enforces | This is bailiff — a case closes when the outcome is verified, not when someone says it is. |
| 2 | motion | the three rules, one at a time | A case opens with a frozen list of what has to be true. Evidence only counts if it was read after the case opened. A promise is checked against our own recording; a claim about what the other side did needs their record. |
| 3 | live | the board, real cases, the numbers panel | This is the live deployment. Nothing on this screen is sample data. |
| 4 | live | open a case, freeze its requirements, the hash appears | The requirement set is hashed before any call is placed. It cannot be rewritten afterwards — by us or anyone else. |
| 5 | live | one case: requirements, evidence with read times and hashes, the grade, the charge | Every requirement points at the evidence that satisfied it, with the hash of what was read and when. The grade prints its checks. Only a passing grade writes the charge. |
| 6 | live | try to close it: refused, in the backend's own words | Try to close it early and it refuses, naming the requirement that has nothing behind it. The case chases what is outstanding, then gives up honestly rather than sitting open. |
| 7 | live | upload a document; hashed from the bytes; the file offered back | A document is a file, not a paragraph someone retyped. It is hashed as it arrived, filed as the owner's own record, and offered back. |
| 8 | live | three curls: selftest, cases, case?ref= | The deployment checks itself in one request — storage written and read back included — and answers with the same rows the board renders. Every claim in the repository is one of these away from being checked. |
| 9 | motion | the honest line, then the repo | Nine of ten integrations are on. The one that is not says so in its own output, and there is no sample data anywhere in the repository. |
