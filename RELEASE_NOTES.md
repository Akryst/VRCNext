**2026.26.2**


**Action Flow**

- **New Avatar category** with three blocks:
  - `my current avatar` — returns the ID of the avatar you are currently wearing. Updates live when you switch avatars in-game or via VRCNext.
  - `avatar "avtr_…"` — a literal avatar ID. Use it on the right side of `my current avatar = avatar "avtr_…"` to compare.
  - `is my current avatar "avtr_…"` — boolean shortcut. Drop it straight into an `IF` to check whether you are wearing a specific avatar without needing a comparison.
