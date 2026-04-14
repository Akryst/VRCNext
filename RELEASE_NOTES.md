**2026.15.4**

**Custom Chatbox**

* Added a **Hide Chatbox Background** option to the Custom Chatbox modules.
  When enabled, the chatbox will appear mostly as a small pillar instead of a full box.

**VR Overlay & Space Flight**

* The VR Overlay and Space Flight now run in a separate process instead of the main process. This change was made because SteamVR can sometimes crash with an unknown exception code or encounter native crashes. In those cases, it could previously take down VRCNext as well. With this change, only the VRCNext subprocess that handles VR-related features will crash, while the main application keeps running.

**Fixes**
* Fixed an issue that caused VRCNext to crash when SteamVR has an random crash
* Fixed an issue that caused VRCNext to crash when Virtual Desktop is hard closed on headsets.
* Fixed an issue that caused VRCNext to crash when VirtualStreame.exe is being killed by Taskkill or sys tray kill.
