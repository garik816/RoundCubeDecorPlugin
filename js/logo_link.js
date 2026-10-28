(function () {
    'use strict';

    function linkLogos() {
        for (const image of document.querySelectorAll('.task-login #layout-content > img#logo, #layout-menu .popover-header > img#logo')) {
            const link = document.createElement('a');
            link.className = 'tc-logo-link';
            link.href = 'https://textmediary.com/';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = 'textmediary.com';
            link.setAttribute('aria-label', 'textmediary.com');
            image.alt = 'Textmediary';
            image.replaceWith(link);
            link.append(image);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', linkLogos, { once: true });
    else linkLogos();
})();
