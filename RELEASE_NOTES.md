**2026.31.3**

**Mutual Network**
* Added non-friend support.
* When opening a user profile that is not friends with you but shares mutual friends, this person will now be added to the Mutual Network.
* Non-friends are shown with a black-and-white profile image and a different line color so they can be clearly distinguished from friends.
* Added Searchbar to find friends and non-friends.
* Added Filter button "Show-Non-Friends"

**Fixes**
* Fixed an Caching issue causing images to be wiped while runtime.
* Fixed the image cache being trimmed down to 5 GB regardless of the configured Max Cache Size. The VR subprocess used the default 5 GB limit and trimmed the shared cache, deleting cached images (even on desktop while the overlay was off). The VR subprocess now uses the configured cache limit, and its cache activity is now visible in the activity log.