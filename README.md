# RoundCubeDecorPlugin

A standalone appearance plugin for Roundcube 1.7.5 with the Elastic skin. It provides local themes, private per-user wallpapers with adjustable brightness, independent reading and message-body backgrounds, a compose view switch, and a wide mail list that opens messages across the workspace with a Back button. Contain scaling fills unused space with a brighter blurred copy of the wallpaper. The bundled Textmediary logo renders with a transparent background. The mail list has subdued selection checkboxes, labeled bulk actions, compact per-message pin, read, and flag controls, and a context menu with move, delete, and Spam when MarkAsJunk is installed. Two-line rows include text snippets, and the message-text tooltip opens only from the subject or snippet. Active controls show white icons on the configured accent, with a red important flag. Interface labels are available in English, Russian, and Ukrainian.

Pins are saved per user and placed above other messages on the current unthreaded page. Snippets are fetched only for visible rows through an authenticated plugin action; fetching does not mark messages read.

The compose switch shows **My appearance** or a **Recipient view** without the local theme. It changes browser-only styles and leaves the outgoing message HTML unchanged. Recipient mail apps may render the message differently.

Clicking the Textmediary logo on the login page or in the task menu opens https://textmediary.com/ in a new tab.

## Install

Copy this repository into `plugins/theme_customizer` in a Roundcube installation. Add `theme_customizer` to the existing plugin list and set an absolute writable `theme_customizer_storage` directory outside the web root. See [`config.inc.php.dist`](config.inc.php.dist) for settings and [`README_RU.md`](README_RU.md) for deployment and verification details.

The plugin does not modify Roundcube core files or the Elastic skin. Personal images are stored outside the web root and served through authenticated plugin actions. The Textmediary logo is bundled locally; image credits are in [`CREDITS.md`](CREDITS.md).

## Compatibility

Verified with Roundcube 1.7.5, Elastic, and PHP 8.4.26. Other Roundcube versions and skins have not been verified. The plugin stays inactive on non-Elastic skins.
