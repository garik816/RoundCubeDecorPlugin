(function () {
    'use strict';
    const wideMenu = window.matchMedia('(min-width: 769px)');

    function positionMenuLogo() {
        const header = document.querySelector('#layout-menu .popover-header');
        const menu = document.getElementById('taskmenu');
        const link = header?.querySelector('.tc-logo-link') || menu?.querySelector('.tc-logo-link');
        if (!link || !header || !menu) return;
        link.classList.toggle('tc-menu-brand', wideMenu.matches);
        if (wideMenu.matches) menu.prepend(link);
        else header.prepend(link);
    }

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
        positionMenuLogo();
    }

    wideMenu.addEventListener('change', positionMenuLogo);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', linkLogos, { once: true });
    else linkLogos();
})();
