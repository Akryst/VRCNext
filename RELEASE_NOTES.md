**2026.25.9**

**Timeline**
* Added more detailed information to the Instance Info tab.
* Added **From** and **Until** entries for each player seen in that instance.
* Added a visual bar that shows when each player was tracked until their **Until** state.

In **Personal > Instances > Instance Info Modal**, **From** and **Until** are now shown for each player you saw in that instance.

This shows when they were tracked during your session. It does not always mean they joined or left at those exact times, since VRCNext cannot know when they joined before you or when they left after you.

**Taskbar**
* Added `Show Keybinds` to the `Help` dropdown.
* Added `Explain This Tab` to the `Help` dropdown.
* The Taskbar is no longer part of the modal overlay layer, so the window can still be moved while a modal is open.

**i18n**
* Added missing localization entries for group modals.

**Groups**
* Added an `Online` count for group members who are currently online.

**Improvements**
* Stored player information from the instance list directly in SQLite to improve profile opening speed.

**Changes**
* Changed the "Friend" badge to an vrcn-badge instead of plain text.

**Fixes**
* Fixed the Group Modal not showing the group creation date.
* Fixed the Group Modal not showing the member join date.
