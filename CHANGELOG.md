# Changelog

## 0.14.1 — 2026-10-28

- Kept the linked menu logo inside its own width, centered it on desktop and phone, and restored its position when the viewport crosses the desktop/mobile breakpoint. The tiny tablet rail now starts directly with navigation instead of an unreadable logo.

## 0.14.0 — 2026-10-28

- Moved the transparent linked logo into the top of the desktop task menu, removing its separate dark header; softened the About/Logout area.
- Moved Appearance into Settings and combined presets with background selection so the same pictures do not appear on two tabs.
- Added an Empty Trash broom beside the Trash folder, using Roundcube's own confirmation and purge command.
- Put read status, flag, and pin controls in the requested order, removed the inline More button, and separated pinned mail from the rest of the list.
- Increased the second-line snippet size, reduced tooltip text size, and added a fallback body fetch and explicit loading/error states for snippets.

## 0.13.1 — 2026-10-28

- Made the Textmediary logo on the login page and in the task menu link to https://textmediary.com/ in a new tab.

## 0.13.0 — 2026-10-28

- Replaced the opaque black logo background with an exact transparent rendering of the bundled Textmediary artwork.
- Made ordinary row controls gray, active controls white on a readable accent background, and flagged controls red.
- Narrowed the sender area and limited the message-text tooltip to the subject and snippet. Reduced unchecked checkbox prominence and added subtle button feedback.
- Reordered bulk and context actions by frequency, added Spam through the installed MarkAsJunk plugin, and made Pin change to Unpin for pinned selections.

## 0.12.0 — 2026-10-27

- Tightened and reduced the per-message buttons, moved the read indicator beside Pin, and kept icons visible when their state changes. Active icons use the configured accent color.
- Added an accessible message context menu via the More button, right click, or keyboard. Delete and Move are available there and Delete is no longer inline.
- Made the message-text tooltip opaque in both light and dark themes.

## 0.11.0 — 2026-10-27

- Made the blurred Contain filler visible behind very dark personal wallpapers without changing the sharp centered image.
- Restored text beside bulk-action icons and added per-user pinning for selected messages and individual rows.
- Rebuilt mail rows with inline pin, flag, delete, and read-state buttons, sender and subject on the first line, an asynchronous text snippet below, and date and attachment at the far edge.
- Added a message-text tooltip on hover and removed the old hover action menu and redundant list header controls.
- Kept native Roundcube selection and mail commands; pinned messages move to the top of the current unthreaded page.

## 0.10.0 — 2026-10-27

- Replaced the four bulk-action text buttons with compact icons and accessible localized tooltips.
- Filled unused space around Contain wallpapers with a blurred cover layer while keeping the full image sharp.
- Applied the same Contain treatment to independent message-reading backgrounds and the appearance preview.

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
