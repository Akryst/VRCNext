**2026.30.2**

This update is mostly focused on Timeline improvements and bug fixes.

**Timeline**

* Added an **Edit** pen button next to the refresh button. When enabled, you can select events with checkboxes and delete specific timeline events.
* Added a **Memory Usage** button inside **Settings > Data > Database Optimization** to show how much storage each table uses.

**Context Menu**

* Added the ability to right-click a timeline event and delete it entirely.
* Added the ability to right-click a timeline filter and bulk delete the last 100 events, the last 500 events, or everything in that category for manual cleanup.

**Changes**

* Every timeline filter now always shows the last “N” events based on the Database settings, instead of using the last “N” event pool from the “All” filter.
* Database Optimization when runned manually by user deletes everything except the last 100 entries to keep Online behavior intact.

**Fixes**

* Fixed an issue in the Timeline where the list could appear empty if one of the other filters had no entries.
* Fixed an issue in the Timeline where the **Unfriended** filter showed the username as **Unknown**.
