**2026.25.0**

## New Features

### Multi-Account Support

VRCNext now has experimental support for multiple VRChat accounts.
You can now add, switch, disconnect, and remove secondary accounts from **Settings > Accounts**.
Each account is shown with its avatar, display name, status badges, and available actions.

Secondary accounts use their own separate database, so account history stays separated. Your primary account keeps using the main VRCNext database and cannot be removed.
You can also open the new **Switch Accounts** menu from the taskbar. It shows your current account and lets you jump directly to the Accounts page.

## Improvements

* Added an automatic migration for existing users, so your current login is moved into the new account system on first launch.
* Account switching now restarts the app cleanly to avoid broken module states or leftover session data.
* Added support for signing back into a disconnected account without re-adding it.
* Added full 2FA support when adding another account.
* Shared image cache stays available across accounts, so avatars, worlds, and user icons do not need to be downloaded again after switching.
* Improved account session handling to prevent cookies or login data from leaking between accounts.
* Added better protection against account actions being triggered while another account action is already running.
* Added a warning card to the Accounts page explaining that secondary account support is still experimental.
* Improved the performance of the Mutual Network tab, which could freeze the app or use too many resources while in VR.
  PR by @A31A18B25C9D012

## UI Fixes

* Fixed Timeline alignment.
* Fixed Inventory alignment.
* Fixed text wrapping in the switch-account confirmation modal.
* Account badges now use the global badge style for better visual consistency.
* The 2FA modal now closes automatically after successfully adding an account.

## Localization

* Added full localization for the Accounts feature in English, German, Spanish, French, Japanese, and Simplified Chinese.
* Fixed an issue in the Simplified Chinese locale file that prevented it from loading correctly.
