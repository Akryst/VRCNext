**2026.28.5**

**Microsoft Bug Fixes**

Something Microsoft should fix not me.
* Added Fix NPSMSvc (Now Playing service)
In Settings > Advanced > Windows Fixes (On by Default)

When this fix is enabled, it will attempt to resolve the Windows Media Control issue introduced in build 10.0.26100, which can cause media controls to completely break. This also fixes an issue where pressing Fn + F5, Fn + F6 or Fn + F7 could cause Windows Explorer to crash. Furthermore, this fixes issues where the OSC Custom Chatbox and VR Overlay may not show the current song information correctly. It checks roughly every 10 minutes and safely restarts the hung service if needed.

**Activity Log**
* Added /fix nps command for manual fix attemps.