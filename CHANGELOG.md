# Changelog

## 0.9.0 — 2026-10-26

- Made Roundcube's native selection checkboxes visible for every message in the mail list.
- Added a selection action bar for marking messages read or unread, moving them, and deleting them without opening a message.
- Kept the action buttons disabled until messages are selected, with English, Russian, and Ukrainian labels.

## 0.8.0 — 2026-10-25

- Fixed Compact rows being taller than Normal by removing added padding and tightening message line height.
- Removed the 20 px blur from translucent workspace panels so personal wallpapers remain sharp.
- Added a 100–180% wallpaper brightness control, and made the appearance drawer translucent.

## 0.7.1 — 2026-10-25

- Supplied the missing Ukrainian Roundcube warning for leaving a compose window with unsaved changes.
- Registered the translated text for both server rendering and client-side confirmation dialogs without changing Roundcube core files.

## 0.7.0 — 2026-10-25

- Added a per-user mail layout setting, defaulting to a wide message list with the folder menu beside it.
- Opened messages replace the list across the available workspace, and Back returns to the list without an empty preview pane.
- Kept the previous split preview layout as an optional setting.

## 0.6.0 — 2026-10-25

- Applied the selected message-body color scheme to the HTML and plain-text compose editors.
- Added a compose switch between personal appearance and a recipient-style preview without changing the outgoing message content.
- Added English, Russian, and Ukrainian labels and guidance for the compose switch.

## 0.5.1 — 2026-10-24

- Added a complete Ukrainian locale for the appearance menu, controls, hints, and status and error messages.

## 0.5.0 — 2026-10-24

- Added per-user message-body background modes: original, match the reading area, or a custom color.
- Recolored text and cleared nested HTML background colors in the two color modes so bright email templates can fit dark themes.
- Preserved sender formatting by default and kept a one-click return to the original message design.

## 0.4.1 — 2026-10-24

- Removed the logo from the empty message preview so the selected background remains unobstructed.
- Kept the branded logo on the login page and task menu.

## 0.4.0 — 2026-10-23

- Added a Messages tab with a choice between the theme background and an independent built-in or personal image.
- Added independent message background color, fit, position, and 10–100% reading area opacity.
- Applied the reading background to empty previews and opened messages while preserving author-provided HTML content backgrounds.
- Preserved existing users' effective reading opacity during upgrade from earlier preferences.

## 0.3.0 — 2026-10-22

- Extended panel background opacity to the full 10–100% range, including the workspace rail and headers.
- Bundled the original Textmediary logo and used it on Elastic's login page, task menu, and empty message preview.
- Kept actual message content unchanged while making the empty preview transparent to the selected wallpaper.

## 0.2.0 — 2026-10-22

- Reworked Elastic into separate translucent panels with visible wallpaper around the mail workspace.
- Refreshed the appearance drawer with a large live wallpaper preview and clearer theme cards.
- Synced the dark preset with Roundcube's empty message preview watermark without changing message content.
- Checked desktop and mobile layouts in the isolated Roundcube staging instance.

## 0.1.0 — 2026-10-22

- Added seven local themes including a neutral theme, a three-section appearance panel, and responsive controls for Elastic.
- Added private image upload, thumbnail generation, user ownership checks, quotas, temporary uploads, and deferred deletion.
- Added versioned per-user preferences, live preview, Save/Cancel/Reset, and revision conflict detection.
