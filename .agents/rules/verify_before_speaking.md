---
trigger: manual
description: Critical operational rule to prevent assumptions and enforce code verification.
---

# Always Verify Before Speaking

Never make assumptions about the state of the codebase, whether a feature is built, or what a document mandates. 

Always perform a deep algorithmic scan (using grep, search, or PowerShell) to verify the exact state of the actual files before giving an answer or writing any document, report, md file, implementation plan, fixes, or code. 

If you are unsure if a file, DOM element, or data attribute exists, you MUST check the filesystem first before responding to the user.