# VC demo preview

- Scope: Orbit PNG/JPEG paste or upload for the current turn; quiz starts on deliberate Start practice; less default copy in Orbit and Usage.
- An owned, ready, unused screenshot is bounded to one per message and goes only to the paying answer call. Voting and specialist calls do not receive the image. Existing reservation and settlement controls remain in the call path. No schema changes.
- Quiz uses existing launch and start guards. Automatically submits once for a newly launched session, not when reopening a saved session; the launch prompt stays out of the composer and initial visible chat for that launch.
- Offline Orbit routes, attachments, attribution, vote panel and usage rendering: 93 tests passed. Authenticated preview rehearsal, live model image compatibility, large folders and plugins are not verified by these mocks.
- Separate preview branch from main at 0a70fd1. Production and automated release are out of scope. Remove preview/close branch or revert the preview commit if needed.
