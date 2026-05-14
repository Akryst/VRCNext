**2026.25.3**

**Keybinds**
* Added CTRL + K Keybind to quickly open the Smart Search window global.
* Added CTRL + D Keybind to use Direct Access for world, user, group, instance and avatar URLS/IDs
* Added CTRL + R Keybind for hot-reload VRCNext.

**Dashboard Editor**

* Fixed several issues with the Dashboard Editor.
* Refactored the movement and selection logic to make editing more stable.
* Added Flip Animation

**Smart Search**
* When opening smart search it will close any currently open modals.

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
