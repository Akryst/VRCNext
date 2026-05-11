**2026.24.1**

**Avatar Search**
* Improved Avatar Search so deleted avatars are now displayed correctly.
* Avatar Search now uses its own database for deleted avatars with a TTL of 30 days.
* Avatar content in user profiles now uses the same caching methods as Avatar Search, so avatars are cached correctly.
* Reduced VRChat API Calls to verify if an Avatar still exists by using the 30 Day TTL.

**Settings**
* Grouped settings in different sub tabs by @A31A18B25C9D012
// Extracted from PR #50 and merged to Backend-Refactor-4
* Settings are now grouped in: General, Apperance, Notifications, VRChat, Data, Performance, Avatar Search, Advanced, VRCX, About

**Timeline**

* Added instance information to `Personal / Locations`.
* Added `From` and `To` parameters to `Personal / Locations`.
* Added the `Time Spent` parameter to `Personal / Locations`.
* Added the `Time Spent` parameter to `Friends / Locations`.

**Fixes**

* Fixed the `VRCNext` text not being on the same row as the other elements, which caused it to be slightly offset.
* Fixed several location and instance related issues in Timeline.
* Fixed database issues caused by Timeline locations.