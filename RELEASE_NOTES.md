**2026.23.5**

### Changes

* Changed the Dashboard Topbar to the new Taskbar style, which is very similar to the old Legacy Window Mode.
* Changed the Dashboard fade effect when scrolling down.
* Increased the size of the Dashboard background.
* Reduced the darkness of the Dashboard background.

### Removed

* Removed Legacy Window Mode because it is no longer needed or maintained.
* Removed the old Dashboard Topbar because it was replaced by the new Taskbar.
* Removed the "Friends" text from the Friends sidebar.
* Removed the Refresh button from the Friends sidebar.
* Removed the left and right sidebar collapse buttons because they are now part of the new Taskbar system.

### Improvements

* Changed image endpoints to use 800+ px images.
* Group, Avatar, User Profile, Own Profile, Event, and other images now load in higher resolution.
* Higher resolution images may slightly increase cache size.
* Enable "Cache Optimizing" if you disabled it before. It is highly recommended.
* Slightly improved VRCNext loading times.

### Fixes

* Fixed several cache-related issues in the ImageCacher.
* Fixed several backend API request systems to improve stability.
* Fixed a bug that could cause the app to freeze.
* Fixed an bug that caused window resizing not to work when trying to resoze on the top bar or the top left and right corners.
