**2026.15.1**

**Date and Time Refactor**

* Added `DateTimeHelper` to format date and time based on the user's current system settings.
* If the system uses AM/PM, times will now be shown in AM/PM format.
* If the system uses US date formatting, dates will now follow that format as well.

**Profiles**

* Added **Details** to the timeline section in user profiles to show more information.
* Added **Last Active**, which shows when a user was last active on the VRChat website or in-game.

**Fixes**

* Fixed an issue where the crash logger would not write a crash log file in certain cases.
* Fixed some date mismatches between the VRChat REST API and the local machine.
* Fixed the **Last Seen** value in user profiles. It now works correctly.
* Fixed a bug with Group Events where only the start date and time were shown, but not the end date and time.

**Internal Changes**

* Removed hardcoded `en-GB`, `en-US`, and `de-DE` date formats.
* Removed hardcoded `en-GB`, `en-US`, and `de-DE` time formats.
* Added `DateTimeHelper` to format date and time correctly for the end user.
* Reverted some changes to the Watchdog log handler.
