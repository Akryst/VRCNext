**2026.30.2**

**Close with VRChat**

* Added the ability to close all apps that were started with VRChat when VRChat is closed.
* VRCN tools stop running when closing VRChat.

**Start with VRChat**

* Added a new **Always Start with VRChat** toggle, which is now enabled by default.
* When enabled, startup apps will start with VRChat regardless of whether you launch VRChat through VRCNext or Steam.
* Shortcuts also now works for startup.

**VRChat Rewind**

* Added **VRChat Rewind**, which shows your yearly highlights at the end of the year. Be surprised!

**User Profiles**

* Added **Memo** to user profiles so you can easily remember someone, even if they change their username. The memo initially shows the current username, but you can change it.

**Timeline**

* Added an **Edit** pen button next to the refresh button. When enabled, you can select events with checkboxes and delete specific timeline events.
* Added a **Memory Usage** button inside **Settings > Data > Database Optimization** to show how much storage each table uses.
* Added the ability to right-click a timeline event and delete it entirely.
* Added the ability to right-click a timeline filter and bulk delete the last 100 events, the last 500 events, or everything in that category for manual cleanup.
* Every timeline filter now always shows the last “N” events based on the Database settings, instead of using the last “N” event pool from the **All** filter.
* Manually running Database Optimization now deletes everything except the last 100 entries to keep online behavior intact.

**Fixes**

* Fixed an issue in the Timeline where the list could appear empty if one of the other filters had no entries.
* Fixed an issue in the Timeline where the **Unfriended** filter showed the username as **Unknown**.
* Fixed an app-startup issue that caused startup apps to not run on some cases.