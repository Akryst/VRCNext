**2026.26.3**

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

**Keybinds**

* You can now use the LEFT ARROW and RIGHT ARROW keys to navigate through photos.

**Notifications**

* When you receive a group invite, you can now open the group before accepting or denying the invite.

**Design**

* Redesigned the user and friend item shown across multiple places.
* Added world location information to the user item when a friend is in a world.
* Changed the padding between user items in the People tab to match all other tabs.

**Fixes**

* Fixed the context menu having a lower Z-order than preview modals, causing it to render behind them.
* Fixed the Current Instance card being slightly bigger than the Current World card in user profiles.
* Fixed an issue where hovering over the **World** text in the Photo Modal did not show the clickable hand cursor.
* Fixed an issue where one event could be shown twice on the dashboard.
* Fixed an issue where one event could be shown twice in the calendar.
* Fixed an issue in Inventory where **Prints** were not shown after uploading one and pressing **Refresh**.
* Fixed an issue where deleted **Prints** could still be shown after restarting VRCN because of FFC caching.
