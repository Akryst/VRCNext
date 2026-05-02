**2026.21.0**

**Dashboard**

* Updated the Dashboard hero section with a cleaner and more modern design.
* Added a new information design to make important details easier to read.

**Theme Update**

* Removed all legacy themes from VRCNext, including Midnight, Ocean, Emerald, Sunset, and Periwinkle.
* Removed the old green Play button style. The Play button now uses your selected theme color.
* Added 5 new VRCNext 2.0 themes: Slates, Blood, Miku, VRChat, and Halloween.
* Removed outlines from Preview Modals.

**Important Note**

If you used a legacy theme and want it back, you can go back to an older version of VRCNext, open the **Theme Editor** while the old theme is active, and save it as a custom theme.

**World Modal**

* Added a new **Info** section with useful world details such as recommended capacity, max capacity, instance count, publish date, update date, and world version.
* Added a new **Community Info** section showing public players, private players, heat, and popularity.
* Updated the World Modal layout to better match the Profile Modal design.
* Moved world instances into their own **Instances** tab.
* The **Instances** tab is now always visible next to **Info** and **Insights**.
* Each instance now shows the world thumbnail, similar to the **Current World** section in the Profile Modal.
* Group badges, join buttons, and friend previews are still available in the new instance layout.

**Dashboard Refresh Improvements**

* Dashboard sections now refresh automatically while the Dashboard tab is open.
* Group Activity refreshes every 10 minutes.
* Recently Visited, Favorite Worlds, and Favorite Avatars refresh every 60 minutes.
* My Avatars and Upcoming Events refresh every 120 minutes.
* Added a manual refresh button to Recently Visited, Favorite Worlds, Favorite Avatars, My Avatars, Group Activity, Group Activity Small, and Upcoming Events.

**Changes**

* Improved how world details are saved and loaded, so information such as heat, popularity, player counts, and world version can appear faster.
* Added more logging for **My Instances** to make issues easier to track down.

**Fixes**

* World Modal: Opening a group from the Instances tab now works correctly with the back button.
* World Modal: Refreshing instances no longer sends you back to the Info tab.
* World Modal: Instance lists can now scroll properly and show up to 5 instances at once before scrolling.
* World Modal: Group badges are visible again in the Instances tab.
* World Modal: Group names in the Instances tab are clickable again.
* World Modal: Join buttons are visible again for each instance.
* World Modal: Some world details could appear late or be missing when opening a world. These details now load faster when available.
* Invite+ instances were shown as **Invite** in the friends sidebar, current instance panel, and instance modal. They now display correctly as **Invite+**.
* Your Instances: Closed instances are now removed properly after refreshing.
* Group Activity and Group Activity Small: Closed instances no longer stay visible after they are gone.
* Recently Visited: The world list now updates properly after the first load.
* Favorite Worlds: The list no longer stays frozen until restarting VRCNext.
* Favorite Avatars: The list no longer stays frozen until restarting VRCNext.
* My Avatars: The list no longer stays frozen until restarting VRCNext.
* Upcoming Events: Events now refresh automatically instead of showing outdated information.
* Hide in System Tray: Clicking the X button now minimizes VRCNext to the system tray instead of closing it.
* Hide in System Tray: This now also works correctly in Legacy Window mode.
