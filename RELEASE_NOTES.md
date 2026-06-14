**2026.30.8**

**Changes**
* Changed the "Tools" Icon in sidebar.
* Changed the "Tools" Icon in Taskbar.

**Improvements**

* Added missing i18n to Local Lists/Exports.
* Added warning icon to system tray when not logged in.
* Added warning icon to system tray when VRChat cookies are invalid.

**Fixes**

* Fixed an issue that caused to show "VRCnext is already running" when trying to switch to a different account.
* Fixed an issue that caused Action Flow to send duplicates to Discord servers when using the **Friend Instance** block.
* Fixed an issue that caused the heatmap to show the wrong online status when there was not enough online, offline, or user status content saved in the Timeline.
* Fixed an issue where deleting an image inside a world modal still showed the image until the same world was reopened.
* Fixed an issue where **Export** in the taskbar did not export all entries after category separation.
* Fixed an issue where **Export** in the taskbar did not export local favorites.
* Fixed a 429 backoff limit in the backend that could cause the app to stop working under certain conditions.
* Fixed an issue where VRCN could stop working after heavy workload conditions due to backend handling.
* Fixed an issue where images created with the VRC Camera could show incorrect world data.
* Fixed an issue where webhook urls/names aren't loaded correctly in Media Relay.
* Fixed an issue where Auto-Start Up apps don't open at some cases like the path requires admin rights to execute the file.
