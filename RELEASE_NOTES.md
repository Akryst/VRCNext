**2026.13.4**

**This update focuses on fixing crashes that could happen while VRCNext is running.**

Thank you to everyone who used **Anonymous Crash Reporting**. It helped a lot with finding and fixing several crash causes related to the app runtime, Photino.NET, and the Steam Overlay.

**Fixed**
- Fixed a startup crash that could happen in the background during timer updates.
- Fixed a crash that could happen while the window was closing.
- Fixed a crash that could happen when closing SteamVR while **Space Flight** was active.


**Fixed Dev Notes**
- Fixed a crash on startup/timer tick where `SendWebMessage` was called from a background thread, causing a fatal CLR error (0x80131506 / access violation in coreclr.dll)
- Fixed a crash in `SubclassWndProc` during window teardown caused by a stale WndProc pointer under nested message loops; replaced `SetWindowLongPtr` subclassing with the proper `SetWindowSubclass`/`DefSubclassProc` comctl32 API
- Fixed a crash when closing SteamVR while Space Flight is active: `PollNextEvent` was called on a torn-down native runtime due to a race between quit handling and the poll loop; guarded with a `_vrQuit` flag checked before every native call