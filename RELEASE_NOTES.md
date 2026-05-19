**2026.26.2**

**Avatars**
* Avatar changes are now shown live inside the avatar tab regardless on how you changed the avatar.

**Action Flow**

- **New Avatar category** with three blocks:
  - `my current avatar`: returns the ID of the avatar you are currently wearing. Updates live when you switch avatars in-game or via VRCNext.
  - `avatar "avtr_…"`: a literal avatar ID. Use it on the right side of `my current avatar = avatar "avtr_…"` to compare.
  - `is my current avatar "avtr_…"`: boolean shortcut. Drop it straight into an `IF` to check whether you are wearing a specific avatar without needing a comparison.

- **New Instance category** with three blocks:
  - `user count of instance`: returns the number of users in your current instance (you included). Use with compare to react to crowded/empty rooms.
  - `my instance type`: returns the type of the instance you are currently in (public, friends, friends+, invite, invite+, group, group+, group public).
  - `instance type [dropdown]`: a literal instance type with a dropdown picker. Use it on the right side of `my instance type = instance type (Friends)` to compare.

- **New Logic block** `number`: a numeric literal for comparisons like `user count of instance > 10`.
