**2026.29.0**

**Themes**
* Added Light Theme Support
* Added 5 new Themes: Flipper Zerom Rose, Unicorn, Baby, VRCX

**VR Overlay**
* Added a **Req.** button for request invites to the Friends List tab in the VR Overlay.
* Added a **Join** button to the Friends List tab in the VR Overlay.
* Removed the **Dashboard** tab because it is no longer needed.
* Moved the clock and date from the Dashboard to the top of the VR Overlay.
* Moved the Drink Water countdown from the Dashboard to the top of the VR Overlay.
* Added a profile image and status dot to the VR Overlay for quick status checks.
* Added **Dynamic Overlay Visibility**.
  This allows you to keep the overlay active all the time. When the overlay is not focused and not near your headset, it will fade out the farther it is from your head. When you bring it closer and look at it, you can use it again. This is useful for people who want to keep the overlay active and quickly use it by looking at it like a normal watch.

**World Insights**
* Updated World Insights to use a standard chart instead of a line chart.
* Added hover information for metrics to show the exact numbers.
* Added daily metrics for **Peak Players**, **Average Players**, **New Visits**, **New Favorites**, and **Favorite Rate**.

**Changes**
* The taskbar no longer gets dark when opening a modal. This helps prevent issues with light themes.

**Microsoft Bug Fixes**
Something Microsoft should fix not me.
* Added Fix NPSMSvc (Now Playing service)
In Settings > Advanced > Windows Fixes (On by Default)

When this fix is enabled, it will attempt to resolve the Windows Media Control issue introduced in build 10.0.26100, which can cause media controls to completely break. This also fixes an issue where pressing Fn + F5, Fn + F6 or Fn + F7 could cause Windows Explorer to crash. Furthermore, this fixes issues where the OSC Custom Chatbox and VR Overlay may not show the current song information correctly. It checks roughly every 10 minutes and safely restarts the hung service if needed.

**Activity Log**
* Added /fix nps command for manual fix attemps.

**Fixes**
* Fixed a crucial issue in the Insights tab for world creators where updated **Visits** data was not shown.
* Fixed a visual bug where the World Insights modal jumped up and down when opened.
* Fixed an issue where the VR Overlay did not allow joining Group Plus or Group Public instances.
* Fixed an issue where the VR Overlay showed **Request Invite** instead of **Join** when a friend was in a joinable instance.
* Fixed an issue where the taskbar did not have the same darkness effect as the main app container.
* Fixed a visual issue where the breadcrumb search always showed white font instead of the theme color.
* Fixed a visual bug where the dashboard vignette clipped through elements.
* Fixed a visual bug where switching to the Dashboard from a different tab caused a visual flash.
* Fixed a visual bug that caused the taskbar elements to get squished when opening the tools row.
* Fixed a bug that caused **Upcoming Events** to not show any events after opening the Calendar tab.
* Fixed a visual bug where instance modal preview images had an incorrect corner.
