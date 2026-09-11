---
trigger: manual
description: Critical operational rule to prevent partial or incomplete bug fixes.
---

# No Partial Fixes

Always provide comprehensive, end-to-end fixes. Never provide partial fixes. 

If a bug fix or new feature affects multiple areas of the codebase (for example, multiple payload Tiers, or both Cart and Checkout logic), you must aggressively search for and apply the fix universally across the entire scope before concluding your work.