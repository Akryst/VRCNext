**2026.24.0**

### The New Taskbar

* Removed the old Dashboard Bar and added a new, better working Taskbar.
* Added an "App" tab with scaling options, restart, and close app buttons.
* Added a "Tools" tab, which shows all tools for faster navigation.
* Added a "Help" tab with a Discord join button.
* Added a "View" tab with App Scaling, Sidebar Collapse
* Minimized the tool toggles into a single tool icon that can be opened and closed.
* Reworked Smart Search for better search results and a cleaner UI.
* Added Left/Right Sidebar Collapse buttons
* Used Legacy Windows + VRCN Styled taskbar buttons.

### Tooltip System
* Added a new tooltip system that explains every feature with short, easy to understand descriptions.
* To view a tooltip, open any module, for example Dashboard, VR Overlay, or Permini.
* Click the module title shown in the Taskbar.
* A "What is this?" option will appear.
* Click it to open an info box with a description of the feature you are currently viewing.

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
* Fixed a bug that caused window resizing to not work correctly from the top bar or the top left and top right corners.
