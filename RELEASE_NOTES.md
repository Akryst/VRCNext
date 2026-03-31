**2026.12.8**

**VR Overlay**

* Added a new **Friends** tab in the **VR Overlay** that shows all friends who are currently online in-game.
* The new **Friends** tab now displays each friend's status, world name, and a **Quick Invite** action.
* Added **Quick Invite** to the **Friends** tab so you can quickly invite friends to your current world.
* Added the **SetOnlineFriends()** API, which is now updated whenever the friend list receives a push update.
* Improved shutdown handling for the overlay poll loop. It now waits for the running task to finish before releasing resources.
* World Location Tab is now scrollable.
* Friends Tab is now scrollable.

**Image Cache**

* Changed the image TTL to 14 and 30 days for profile and world images.
* Fixed an issue where **/api/1/file/...** URLs, such as avatar asset bundles, were incorrectly requested as images. This removes the large number of **400** errors that occurred on startup.
* Added persistent storage for permanently failed image URLs using **_permanent_fail.json**, so **400** and **404** image URLs are skipped after the first failed request.
* Failed image compressions are now permanently blocked after 2 attempts.
* Added new awaitable variants for **GetAsync** and **GetWorldAsync**.
* Updated **VROverlay** to use **ImageCacheService** for all images, including notifications and the location tab.
* Fixed an issue where the **VR Overlay** did not display any images.
* Fixed an issue where notification images were not shown in the **VR Overlay**.
* Fixed a critical bug that caused **vrcw** files to be downloaded because the JSON payload exposed them as **apiv1 file** endpoints. These are now filtered out.
* Fixed a critical bug that caused **avtr** files to be downloaded because the JSON payload exposed them as **apiv1 file** endpoints. These are now filtered out.

**Dashboard**

* Fixed the **Reset** button in the **Dashboard Editor** modal.
* The **Reset** button now restores only the 4 default sections:

  * **my_instances**
  * **friend_locations**
  * **discovery**
  * **friend_activity**
* Added in-flight guards for **_recentInFlight**, **_popularInFlight**, and **_activeInFlight** to prevent duplicate requests.
* The 10-minute refresh interval now only runs while the **Dashboard** tab is active.
* Fixed the right-click menu on the **Your Groups** dashboard section.

**Duplicate Request Prevention**

* Fixed excessive **GET** request spam when the cache was full.
* Fixed a duplicate **GET** request on **VRCNext** startup to reduce request spam.

**Bug Fixes and Stability**

* Fixed Time Spent issue that fires a bug when relaunching VRChat causing in adding additional playtime with friends/worlds.
* **VoiceFight:** Added exception handling for **ThreadPool** callbacks and worker loop crash logging.
* **SpaceFlight:** Added exception handling in the **SteamVR** update callback.
* **VoiceFight:** Added crash logging for **Chatbox SendChatbox** when executed in the **ThreadPool**.
* Added **Interlocked** in-flight guards in **AuthController** for **_favWorldsInFlight** and **_favAvatarsInFlight**.
* Added a **_groupsInFlight** guard in **GroupsController**.
* The **FavoriteGroups** API call is now shared between favorite worlds and favorite avatars through **_cachedFavGroups**.

**Fixes**

* Fixed Cookie Auth Corruptions.
* Fixed several **400** errors.
* Fixed Image Cache issues with VR Overlay
