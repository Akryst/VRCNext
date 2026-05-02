**2026.20.7**

**Dashboard**
* Updated the Dashboard hero to look more modern.
* Added New info design.

**Theme Update**

* Removed all legacy themes from VRCNext, including Midnight, Ocean, Emerald, Sunset, and Periwinkle.
* Removed old green Play button theme complitely. Instead theme color is being used now.
* Added 5 VRCNext 2.0 themes: Slates, Blood, Miku, VRChat, and Halloween.

**Important Note:**
If you used a legacy theme and want it back, you can return to an older version of VRCNext, open the **Theme Editor** while the old theme is active, and save it as a custom theme.

**Changes**

* World Modal: Added an **Info** section with Recommended, Max Capacity, Instances, Published, Updated, and Version.
* World Modal: Added a **Community Info** section with Public Players, Private Players, Heat, and Popularity.
* World Modal: Updated the layout to match the Profile Modal style.
* World Modal: Moved instances from the bottom of the Info tab into a dedicated **Instances (n)** tab.
* World Modal: The **Instances (n)** tab is now always visible alongside **Info** and **Insights**.
* World Modal: Each instance now shows the world thumbnail, matching the Profile Modal **Current World** style.
* World Modal: Group badges, join buttons, and friend strips are preserved.
* World cache: Extended the SQLite `world_tracking` table with `heat`, `popularity`, `publicOccupants`, `privateOccupants`, and `version`.
* World cache: These values are now persisted on every background detail fetch.
* Dashboard sections now auto-refresh on a timer while the Dashboard tab is active:

  * Group Activity every 10 minutes
  * Recently Visited, Favorite Worlds, and Favorite Avatars every 60 minutes
  * My Avatars and Upcoming Events every 120 minutes
* Added a manual refresh button (⟳) to Recently Visited, Favorite Worlds, Favorite Avatars, My Avatars, Group Activity, Group Activity Small, and Upcoming Events.
* Added more logging for **My Instances**.

**Fixes**

* World Modal: Clicking a group from the Instances tab now correctly pushes the world onto the breadcrumb stack, so back navigation works.
* World Modal: Refreshing instances no longer jumps back to the Info tab. The active tab is now preserved across refreshes.
* World Modal: Instance lists are now scrollable with a maximum of 5 visible instances at once instead of being cut off.
* World Modal: Group badges were missing after the instances redesign. They have been restored with clickable group names.
* World Modal: Join buttons were missing after the instances redesign. They have been restored for each instance.
* World cache: `heat`, `popularity`, `publicOccupants`, `privateOccupants`, and `version` were missing from the SQLite cache-first response. These values are now served immediately when opening the modal without waiting for the REST call.
* Invite+ instances showed as **Invite** in the friends sidebar, current instance panel, and instance modal. The root cause was `ParseLocation` not checking `~canRequestInvite` in the location string.
* Your Instances: Auto-closed instances with `closedAt` set were not removed on refresh. They are now correctly detected and removed alongside null instances.
* Group Activity and Group Activity Small: Closed instances remained visible because the data was never refreshed.
* Recently Visited: The world list was never updated after the initial load.
* Favorite Worlds: The list stayed frozen until the app was restarted.
* Favorite Avatars: The list stayed frozen until the app was restarted.
* My Avatars: The list stayed frozen until the app was restarted.
* Upcoming Events: Events were not automatically refreshed and showed stale data.
