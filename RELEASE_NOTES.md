**2026.26.3**

**Taskbar and Modal Navigation**

Several actions, such as **Share Profile**, **Share Group**, **Share Avatar**, **Leave Group**, **Join Group**, **Use Avatar**, and many other buttons that were previously located at the bottom of modals, have now been moved to the new taskbar system.

This may feel confusing the first few times, since most actions used to be inside the modal itself. However, it should feel natural after a few minutes.

Moving these actions to the taskbar turned out to be much better, since the taskbar is meant for quick tasks. It also speeds things up, especially when you do not want to scroll up and down or switch between sub-tabs.


**Settings**
* Added a new settings category: **Sidebar**.
* Added **Friends Sidebar Card** to **Sidebar Settings**.
* You can now enable or disable instance information in the sidebar.
* By default, friend items show: **Status Text | World Name**.
* When enabled, they show: **Flag | World Name**. This displays the server location and world name, but hides the user’s status text.

**Improvements**
* Friend items now show world locations.
* Friend items now update world locations live through WebSocket updates, just like the friends sidebar.
* Added **Author** to photo previews.
* Moved the Timeline search bar to the top bar, giving the log list more space.
* Added player count to profile modals under **Current World**.
* Added the age-gated tag to profile modals under **Current World**.
* Added dynamic animations to taskbar.

**Keybinds**
* You can now use the LEFT ARROW and RIGHT ARROW keys to navigate through photos.

**Notifications**
* When you receive a group invite, you can now open the group before accepting or denying the invite.

**Design**
* Redesigned the user and friend item shown across multiple places.
* Added world location information to the user item when a friend is in a world.
* Changed the padding between user items in the People tab to match all other tabs.
* Moved the bottom action buttons of the Avatar, Profile, Event, Group, World, and Own Profile modals into the top header as icon buttons, next to **Share** and **Close**, so actions no longer require scrolling to the bottom.
* Leaving a group now asks for confirmation before you leave.

**VRChat API**
* Some small improvements to reduce GET requests on dashboard.
* Improved request handling in user profiles.

**Fixes**
* Fixed the context menu having a lower Z-order than preview modals, causing it to render behind them.
* Fixed the Current Instance card being slightly bigger than the Current World card in user profiles.
* Fixed an issue where hovering over the **World** text in the Photo Modal did not show the clickable hand cursor.
* Fixed an issue where one event could be shown twice on the dashboard.
* Fixed an issue where one event could be shown twice in the calendar.
* Fixed an issue in Inventory where **Prints** were not shown after uploading one and pressing **Refresh**.
* Fixed an issue where deleted **Prints** could still be shown after restarting VRCN because of FFC caching.
* Fixed a Z-ordering issue in Photo Preview where the delete confirmation dialog rendered behind the photo modal.
* Fixed an issue that caused Photo Preview to open when using the arrow keys, even when it was closed or had not been used.
* Fixed an issue in "Timeline" not repositioning the top buttons when making the window smaller
* Fixed an issue when deleting an image while photo modal wa sopen the modal started to break.
