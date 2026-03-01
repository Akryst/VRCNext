## What's New

- Credentials (password, auth cookie) are now encrypted on disk using Windows DPAPI

## Bug Fixes

- Fixed path traversal in file deletion — only files within watch folders can be deleted. As a local desktop app this was never exploitable in practice, but has been hardened regardless.
- Fixed XSS edge case in group gallery onclick handler. As a local desktop app with no external script execution this posed no real threat, but has been tightened as a precaution.
