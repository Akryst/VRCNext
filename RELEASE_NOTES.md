**2026.25.1**

**New Features**
* Quick `Switch Accounts` button in the App menu of the taskbar.
* New `Sign In` button for disconnected accounts. Just enter your password to come back online.
* Warning card on the Accounts page so you know what to expect from secondary accounts.

**Space Flight**
* Changed the hard limit from Max 50m (X,Y,Z) to 500m.
That means you can space drag far away from your origin point

**Taskbar**
* Added "Report Bug" to the "Help" entry
* Added "Feature Request" to the "Help" entry

**Debounce Search Settings**
* Added a new **Debounce** setting under **Settings > Advanced > Performance**.
* The default value is **500ms**, which is fast and stable for both small lists with around **20-100 entries** and large lists with around **500-1500 entries**, including friends, groups, worlds and avatars.
* It is recommended to keep this setting at **500ms**.
* You can lower the value for faster search responses if you have smaller lists. For example, users with around **100-200 friends** can safely use values below **500ms**.
* Smart Search now uses the same debounce as the global debouncer.

**Improvements**
* Each secondary account now keeps its own friends, favorites, inventory and other lists separate from your main account.
* Account profile pictures use your VRChat user icon now, not your current avatar.
* Account badges match the rest of the app.
* 2FA window closes automatically after a successful login.
* Space Flight drag range increased from 50 to 500 meters.

**Bug Fixes**
* Fixed empty Blocked and Muted lists after a fresh app start. They now always show the correct people.
* Fixed text getting cut off in the switch-account confirmation window.
* Fixed the user icon in the App menu not updating when you log in or out.
