**2026.25.6**

**User Profiles**
* Shows now if other friends are in the same instance in "Current World" section.

**Taskbar**
* Added "VRChat Data" to Tools > Shortcuts which opens the VRChat Data folder.
* Added "VRChat Crash Dump" to Tools > Shortcuts which opens the VRChat Crash Dump folder.
* Added "VRCN Data" to Tools > Shortcuts which opens the VRCNext Data folder.

**Keybinds**
* Added keybinds to VRCNext for power users. You now have a large set of useful shortcuts to do many things faster.
* Added `CTRL + K` to quickly open the Smart Search window globally.
* Added `CTRL + D` to use Direct Access for world, user, group, instance, and avatar URLs/IDs.
* Added `CTRL + R` to hot-reload VRCNext.
* Added `CTRL + I` to quickly change your status text and online status.
* Added `CTRL + P` to show your own user profile.
* Added `ESC` to close any currently open modal.
* Added `CTRL + H` to display the keybind help modal.
* Added `CTRL + LEFT` to open or collapse the navigation sidebar.
* Added `CTRL + RIGHT` to open or collapse the friends sidebar.
* Added `CTRL + T` to open the Timeline tab.
* Added `ALT + V` to start VRChat in SteamVR Mode.
* Added `ALT + D` to start VRChat in Desktop mode.
* Added `CTRL + UP` to navigate between navbar tabs.
* Added `CTRL + DOWN` to navigate between navbar tabs

**Dashboard Editor**
* Fixed several issues with the Dashboard Editor.
* Refactored the movement and selection logic to make editing more stable.
* Added Flip Animation

**Smart Search**
* When opening smart search it will close any currently open modals.
* You can now navigate the smart search with UP/DOWN/LEFT/RIGHT arrow keys on your keyboard to select and choose items.

**Navbar Editor**
* You can now customize the order and content of the left navigation bar.
* Right-click any navigation item and select **Edit Navigation** to start editing.
* Added support for custom folders, custom icons, and hidden sections.
* Navigation items can now be moved into your preferred order.
* Added Flip Animation

**HTTP/2 Support**
* VRCNext now uses HTTP/2 for API and image requests.
* HTTP/2 allows multiple requests to run over a single connection at the same time instead of waiting in a queue.
* This helps images and data load faster, especially when opening profiles, worlds, friend lists, or other pages with many thumbnails.

**Fixes**
* Added the missing `Biography` i18n entry for all languages.
* Fixed a small visual bug where the Windows Close, Maximize, and Minimize buttons shifted to the right when opening the Tools section.
* Fixed an issue that could show the wrong time for when a picture was taken in a world.
* Fixed a Media Library issue where new images added during runtime could show the wrong metadata.
* Fixed an issue where Smart Search could render behind other modals.
* Fixed several z-ordering values for all modals to prevent overlap issues.
* Fixed padding in instance modals
