(function () {
    'use strict';
    if (window.self !== window.top || !window.rcmail || !rcmail.env.theme_customizer || window.themeCustomizerLoaded) return;
    window.themeCustomizerLoaded = true;

    const env = rcmail.env.theme_customizer;
    const t = key => rcmail.gettext(key, 'theme_customizer');
    const clone = value => JSON.parse(JSON.stringify(value));
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let saved = clone(env.settings);
    let draft = clone(saved);
    let images = clone(env.images || []);
    let pending = [];
    let removed = new Set();
    let tab = randomId();
    let panel, opener, busy = false, opened = false, heartbeat = null, recipientPreview = false;
    let pins = clone(env.pins || {});
    const modalInert = new Map();

    function randomId() {
        const data = new Uint8Array(16);
        crypto.getRandomValues(data);
        return Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function el(tag, className, label) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (label !== undefined) node.textContent = label;
        return node;
    }

    function backgroundUrl(id) {
        if (id === 'none') return '';
        if (env.builtins[id]) return new URL(env.builtins[id].full, document.baseURI).href;
        const item = pending.concat(images).find(x => x.id === id && !removed.has(x.id));
        return item ? new URL(item.url, document.baseURI).href : '';
    }

    function messageAppearance(state) {
        const inherited = state.messageMode === 'theme';
        return {
            url: backgroundUrl(inherited ? state.background : state.messageBackground),
            fill: inherited ? state.fill : state.messageFill,
            fit: inherited ? state.fit : state.messageFit,
            position: inherited ? state.position : state.messagePosition,
        };
    }

    function labelFor(id) {
        return id.startsWith('u_') ? t('personalimage') : t(id === 'none' ? 'neutral' : id);
    }

    function contrast(hex) {
        const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255.0);
        const light = rgb.map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        return 0.2126 * light[0] + 0.7152 * light[1] + 0.0722 * light[2] > 0.179 ? '#000000' : '#ffffff';
    }

    function bodyAppearance(state, dark) {
        const active = state.messageBodyMode !== 'original';
        const fill = state.messageBodyMode === 'reading' ? (dark ? '#1d2631' : '#fafcff') : state.messageBodyFill;
        const lightInk = contrast(fill) === '#ffffff';
        return { active, fill, ink: lightInk ? '#ecf2f6' : '#26323d',
            link: lightInk ? '#9ac8ff' : '#155e9b' };
    }

    function syncMessageFrame(dark, lowOpacity, bodyLook) {
        const frame = document.getElementById('messagecontframe');
        if (!frame) return;
        try {
            const doc = frame.contentDocument;
            if (!doc || !doc.body) return;
            const watermark = doc.location.pathname.endsWith('/skins/elastic/watermark.html');
            const message = !!doc.getElementById('message-header');
            if (!watermark && !message) return;
            doc.documentElement.classList.toggle('dark-mode', dark);
            doc.documentElement.classList.toggle('tc-message-low', lowOpacity);
            doc.documentElement.classList.toggle('tc-body-restyled', bodyLook.active);
            doc.documentElement.style.setProperty('--tc-body-fill', bodyLook.fill);
            doc.documentElement.style.setProperty('--tc-body-ink', bodyLook.ink);
            doc.documentElement.style.setProperty('--tc-body-link', bodyLook.link);
            if (message && !doc.getElementById('tc-message-style')) {
                const style = doc.createElement('style');
                style.id = 'tc-message-style';
                style.textContent = [
                    'html,body,#layout,#layout-content,#layout-content>.content.frame-content{background:transparent!important}',
                    'html:not(.tc-body-restyled) .message-htmlpart{background:#fff!important;color:#2c363a!important}',
                    'html.tc-message-low #message-header,html.tc-message-low .message-part{margin:.6rem;padding:.8rem 1rem;border-radius:12px;background:rgba(255,255,255,.86)!important;color:#26323d!important;box-shadow:0 4px 18px rgba(10,24,36,.12)}',
                    'html.dark-mode.tc-message-low #message-header,html.dark-mode.tc-message-low .message-part{background:rgba(24,34,43,.88)!important;color:#ecf2f6!important}',
                    'html.tc-body-restyled .message-htmlpart,html.tc-body-restyled .message-part{background:var(--tc-body-fill)!important;color:var(--tc-body-ink)!important;border-radius:12px;padding:1rem!important}',
                    'html.tc-body-restyled .message-htmlpart :where(*),html.tc-body-restyled .message-part :where(*){background-color:transparent!important;color:var(--tc-body-ink)!important}',
                    'html.tc-body-restyled .message-htmlpart a,html.tc-body-restyled .message-part a{color:var(--tc-body-link)!important}',
                    '@media print{html,body,#layout,#layout-content,#layout-content>.content.frame-content{background:#fff!important}html.tc-message-low #message-header,html.tc-message-low .message-part{background:#fff!important;box-shadow:none!important}html.tc-body-restyled .message-htmlpart,html.tc-body-restyled .message-part{background:#fff!important;color:#222!important}html.tc-body-restyled .message-htmlpart :where(*),html.tc-body-restyled .message-part :where(*){color:#222!important}}',
                ].join('');
                doc.head.append(style);
            }
            if (watermark) {
                doc.getElementById('tc-watermark-brand')?.remove();
                if (!doc.getElementById('tc-watermark-style')) {
                    const style = doc.createElement('style');
                    style.id = 'tc-watermark-style';
                    style.textContent = 'html,body{background:transparent!important}body::before{display:none!important}';
                    doc.head.append(style);
                }
            }
        } catch (_) { /* Message content may be inaccessible; leave it unchanged. */ }
    }

    function syncComposeEditor(bodyLook) {
        if (!document.getElementById('composebodycontainer')) return;
        const themed = bodyLook.active && !recipientPreview;
        root.classList.toggle('tc-compose-themed', themed);
        root.classList.toggle('tc-compose-recipient', recipientPreview);
        document.querySelector('.tc-compose-preview')?.classList.toggle('tc-recipient', recipientPreview);
        const viewButtons = document.querySelectorAll('.tc-compose-view');
        viewButtons.forEach(button => button.setAttribute('aria-pressed',
            String((button.dataset.tcView === 'recipient') === recipientPreview)));

        const editor = window.tinymce?.get?.('composebody');
        if (!editor) return;
        try {
            const doc = editor.getDoc();
            if (!doc || !doc.body) return;
            doc.documentElement.classList.toggle('tc-compose-themed', themed);
            doc.documentElement.classList.toggle('tc-compose-recipient', recipientPreview);
            doc.documentElement.style.setProperty('--tc-body-fill', bodyLook.fill);
            doc.documentElement.style.setProperty('--tc-body-ink', bodyLook.ink);
            doc.documentElement.style.setProperty('--tc-body-link', bodyLook.link);
            if (!doc.getElementById('tc-compose-style')) {
                const style = doc.createElement('style');
                style.id = 'tc-compose-style';
                style.textContent = [
                    'html.tc-compose-themed body{background:var(--tc-body-fill)!important;color:var(--tc-body-ink)!important}',
                    'html.tc-compose-themed body :where(*){background-color:transparent!important;color:var(--tc-body-ink)!important}',
                    'html.tc-compose-themed body a{color:var(--tc-body-link)!important}',
                    'html.tc-compose-recipient body{background:#fff!important;color:#222!important}',
                ].join('');
                doc.head.append(style);
            }
        } catch (_) { /* Editor may be switching between HTML and plain text. */ }
    }

    function mountComposePreview() {
        const container = document.getElementById('composebodycontainer');
        if (!container || document.querySelector('.tc-compose-preview')) return;
        const controls = el('div', 'tc-compose-preview');
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', t('compose_view'));
        controls.append(el('span', 'tc-compose-caption', t('compose_view')));
        [['my', t('compose_my_view')], ['recipient', t('compose_recipient_view')]].forEach(([view, label]) => {
            const button = makeButton(label, 'tc-compose-view', () => {
                recipientPreview = view === 'recipient';
                apply(opened ? draft : saved);
            });
            button.dataset.tcView = view;
            controls.append(button);
        });
        const note = el('small', 'tc-compose-note', t('compose_recipient_note'));
        controls.append(note);
        container.before(controls);
        syncComposeEditor(bodyAppearance(opened ? draft : saved, root.classList.contains('tc-dark')));
    }

    function apply(state) {
        const dark = state.mode === 'dark' || (state.mode === 'system' && media.matches);
        const messageLook = messageAppearance(state);
        const bodyLook = bodyAppearance(state, dark);
        const wallpaper = backgroundUrl(state.background);
        root.classList.add('theme-customizer-enabled');
        root.classList.toggle('dark-mode', dark);
        root.classList.toggle('tc-dark', dark);
        root.classList.toggle('tc-low-opacity', state.surface < 45);
        root.classList.toggle('tc-message-low', state.messageSurface < 70);
        root.classList.toggle('tc-body-restyled', bodyLook.active);
        root.classList.toggle('tc-message-shell', !!(document.getElementById('messagecontframe') || document.getElementById('message-header')));
        root.classList.toggle('tc-wallpaper-contain', !!wallpaper && state.fit === 'contain');
        root.classList.toggle('tc-message-contain', !!messageLook.url && messageLook.fit === 'contain');
        root.classList.toggle('tc-mail-single', state.mailView === 'single' && rcmail.env.task === 'mail'
            && !rcmail.env.action && !!document.getElementById('messagecontframe'));
        if (!root.classList.contains('tc-mail-single')) root.classList.remove('tc-mail-reader');
        syncMessageFrame(dark, state.messageSurface < 70, bodyLook);
        syncComposeEditor(bodyLook);
        root.style.setProperty('--tc-wallpaper', wallpaper ? 'url(' + JSON.stringify(wallpaper) + ')' : 'none');
        root.style.setProperty('--tc-fill', state.fill);
        root.style.setProperty('--tc-dim', String(state.dim / 100));
        root.style.setProperty('--tc-blur', state.blur + 'px');
        root.style.setProperty('--tc-brightness', String(state.brightness / 100));
        root.style.setProperty('--tc-backdrop-brightness', String(Math.min(2.8,
            Math.max(1.25, state.brightness / 100 * (dark ? 1.8 : 1.15)))));
        root.style.setProperty('--tc-fit', state.fit);
        root.style.setProperty('--tc-position', state.position);
        root.style.setProperty('--tc-surface', String(state.surface / 100));
        root.style.setProperty('--tc-message-wallpaper', messageLook.url ? 'url(' + JSON.stringify(messageLook.url) + ')' : 'none');
        root.style.setProperty('--tc-message-fill', messageLook.fill);
        root.style.setProperty('--tc-message-surface', String(state.messageSurface / 100));
        root.style.setProperty('--tc-message-fit', messageLook.fit);
        root.style.setProperty('--tc-message-position', messageLook.position);
        root.style.setProperty('--tc-body-fill', bodyLook.fill);
        root.style.setProperty('--tc-body-ink', bodyLook.ink);
        root.style.setProperty('--tc-body-link', bodyLook.link);
        root.style.setProperty('--tc-radius', state.radius + 'px');
        root.style.setProperty('--tc-text', state.text + 'px');
        root.style.setProperty('--tc-accent', state.accent);
        root.style.setProperty('--tc-accent-text', contrast(state.accent));
        root.dataset.tcDensity = state.density;
        if (panel) panel.querySelector('.tc-hero-current').textContent = labelFor(state.background);
    }

    async function request(op, values, file) {
        const data = new FormData();
        data.set('_op', op);
        data.set('_tab', tab);
        data.set('_token', rcmail.env.request_token);
        Object.keys(values || {}).forEach(key => data.set(key, values[key]));
        if (file) data.set('image', file);
        let response;
        try {
            response = await fetch(env.api, { method: 'POST', body: data, credentials: 'same-origin', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.code || 'save_failed');
            return result;
        } catch (error) {
            if (error instanceof SyntaxError) throw new Error('session_expired');
            throw error;
        }
    }

    function errorText(error) {
        const code = error && error.message;
        const known = ['storage_unconfigured', 'storage_unavailable', 'image_library_unavailable', 'invalid_file', 'image_too_large', 'quota', 'csrf', 'session_expired', 'conflict', 'save_failed', 'invalid_settings', 'background_deleted', 'forbidden'];
        return known.includes(code) ? t(code) : t('network_error');
    }

    function message(value, bad) {
        if (!panel) return;
        const target = panel.querySelector('.tc-message');
        target.textContent = value;
        target.classList.toggle('tc-error', !!bad);
    }

    function makeButton(label, cls, action) {
        const button = el('button', cls, label);
        button.type = 'button';
        button.addEventListener('click', action);
        return button;
    }

    function radioChoice(group, id, title, thumb, selected, action) {
        const button = makeButton('', 'tc-choice', action);
        button.setAttribute('aria-label', title);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.dataset.tcChoice = group + ':' + id;
        const preview = el('span', 'tc-choice-preview');
        if (thumb) preview.style.backgroundImage = 'url(' + JSON.stringify(thumb) + ')';
        else preview.classList.add('tc-neutral-preview');
        button.append(preview, el('span', 'tc-choice-label', title));
        return button;
    }

    function field(label, input, help) {
        const wrap = el('label', 'tc-field');
        wrap.append(el('span', 'tc-field-label', label), input);
        if (help) wrap.append(el('small', 'tc-help', help));
        return wrap;
    }

    function selectField(key, label, options, help) {
        const select = el('select', 'tc-input');
        options.forEach(([value, text]) => {
            const option = el('option', '', text);
            option.value = value;
            select.append(option);
        });
        select.value = draft[key];
        select.addEventListener('change', () => change(key, select.value));
        return field(label, select, help);
    }

    function rangeField(key, label, min, max, unit) {
        const input = el('input', 'tc-input');
        input.type = 'range'; input.min = min; input.max = max; input.value = draft[key];
        const readout = el('output', 'tc-value', draft[key] + unit);
        input.addEventListener('input', () => { readout.textContent = input.value + unit; change(key, Number(input.value)); });
        const wrap = field(label, input);
        wrap.append(readout);
        return wrap;
    }

    function colorField(key, label) {
        const input = el('input', 'tc-input');
        input.type = 'color'; input.value = draft[key];
        input.addEventListener('input', () => change(key, input.value));
        return field(label, input);
    }

    function change(key, value) {
        draft[key] = value;
        if (key !== 'preset') draft.preset = 'custom';
        apply(draft);
        markChoices();
        message('');
    }

    function markChoices() {
        if (!panel) return;
        panel.querySelectorAll('[data-tc-choice]').forEach(node => {
            const [group, id] = node.dataset.tcChoice.split(':');
            node.setAttribute('aria-pressed', String(draft[group] === id));
        });
        const custom = panel.querySelector('.tc-custom-badge');
        if (custom) custom.hidden = draft.preset !== 'custom';
    }

    function makeSections() {
        const tabs = el('div', 'tc-tabs');
        tabs.setAttribute('role', 'tablist');
        const body = el('div', 'tc-body');
        ['themes', 'backgrounds', 'messages', 'interface'].forEach((name, index) => {
            const tabButton = makeButton(t(name), 'tc-tab', () => showTab(name));
            tabButton.id = 'tc-tab-' + name;
            tabButton.setAttribute('role', 'tab');
            tabButton.setAttribute('aria-controls', 'tc-section-' + name);
            tabButton.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tabButton.tabIndex = index === 0 ? 0 : -1;
            tabs.append(tabButton);
            const section = el('section', 'tc-section');
            section.id = 'tc-section-' + name;
            section.setAttribute('role', 'tabpanel');
            section.setAttribute('aria-labelledby', tabButton.id);
            section.hidden = index !== 0;
            body.append(section);
        });
        tabs.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            const list = Array.from(tabs.querySelectorAll('.tc-tab'));
            const current = list.indexOf(document.activeElement);
            if (current < 0) return;
            const next = list[(current + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
            showTab(next.id.replace('tc-tab-', '')); next.focus(); event.preventDefault();
        });
        return [tabs, body];
    }

    function showTab(name) {
        panel.querySelectorAll('.tc-tab').forEach(node => {
            const selected = node.id === 'tc-tab-' + name;
            node.setAttribute('aria-selected', String(selected)); node.tabIndex = selected ? 0 : -1;
        });
        panel.querySelectorAll('.tc-section').forEach(node => { node.hidden = node.id !== 'tc-section-' + name; });
    }

    function uploadField(target, label) {
        const file = el('input', 'tc-upload-input');
        file.type = 'file';
        file.accept = (env.formats || []).map(x => 'image/' + (x === 'JPEG' ? 'jpeg' : x.toLowerCase())).join(',');
        file.disabled = !!env.upload || !(env.formats || []).length;
        file.addEventListener('change', async () => {
            if (!file.files || !file.files[0]) return;
            busy = true; setBusy(); message(t('uploading'));
            try {
                const result = await request('upload', {}, file.files[0]);
                pending.push(result.image);
                change(target, result.image.id);
                renderChoices();
                message(t('upload_ready'));
            } catch (error) { message(errorText(error), true); }
            finally { busy = false; setBusy(); }
        });
        return field(label, file, env.upload ? errorText(new Error(env.upload)) : t('upload_help'));
    }

    function renderChoices() {
        const themes = panel.querySelector('#tc-section-themes');
        const backgrounds = panel.querySelector('#tc-section-backgrounds');
        themes.replaceChildren(); backgrounds.replaceChildren();
        themes.append(el('p', 'tc-intro', t('themes_help')));
        const badge = el('p', 'tc-custom-badge', t('custom_theme'));
        themes.append(badge);
        const themeGrid = el('div', 'tc-grid');
        Object.keys(env.presets).forEach(id => {
            const preset = env.presets[id];
            themeGrid.append(radioChoice('preset', id, t(id), env.builtins[id].thumb, draft.preset === id, () => {
                draft = Object.assign({}, draft, preset, { preset: id });
                apply(draft); renderChoices(); renderControls(); message('');
            }));
        });
        themes.append(themeGrid);
        backgrounds.append(el('p', 'tc-intro', t('background_help')));
        const grid = el('div', 'tc-grid');
        grid.append(radioChoice('background', 'none', t('neutral'), '', draft.background === 'none', () => change('background', 'none')));
        Object.keys(env.builtins).filter(id => id !== 'neutral').forEach(id => {
            grid.append(radioChoice('background', id, t(id), env.builtins[id].thumb, draft.background === id, () => change('background', id)));
        });
        pending.concat(images).filter(item => !removed.has(item.id)).forEach(item => {
            const cell = el('div', 'tc-personal-cell');
            cell.append(radioChoice('background', item.id, labelFor(item.id), item.thumb, draft.background === item.id, () => change('background', item.id)));
            cell.append(makeButton(t('remove'), 'tc-remove', () => {
                removed.add(item.id);
                if (draft.background === item.id) change('background', 'none');
                if (draft.messageBackground === item.id) change('messageBackground', 'none');
                renderChoices();
            }));
            grid.append(cell);
        });
        backgrounds.append(grid);
        backgrounds.append(uploadField('background', t('upload_image')));
        backgrounds.append(colorField('fill', t('fill')),
            selectField('fit', t('fit'), [['cover',t('cover')],['contain',t('contain')]], t('contain_blur_help')),
            selectField('position', t('position'), ['center','top','bottom','left','right'].map(x => [x,t(x)])),
            rangeField('dim', t('dim'), 0, 60, '%'), rangeField('blur', t('blur'), 0, 20, ' px'),
            rangeField('brightness', t('brightness'), 100, 180, '%'));
        renderMessageControls();
        markChoices();
    }

    function renderMessageControls() {
        const section = panel.querySelector('#tc-section-messages');
        section.replaceChildren(el('p', 'tc-intro', t('message_help')));
        const mode = el('select', 'tc-input');
        [['theme', t('message_from_theme')], ['custom', t('message_separate')]].forEach(([value, label]) => {
            const option = el('option', '', label); option.value = value; mode.append(option);
        });
        mode.value = draft.messageMode;
        mode.addEventListener('change', () => { change('messageMode', mode.value); renderMessageControls(); });
        section.append(field(t('message_source'), mode),
            rangeField('messageSurface', t('message_opacity'), 10, 100, '%'));
        if (draft.messageMode === 'custom') {
            section.append(el('p', 'tc-help', t('message_gallery_help')));
            const grid = el('div', 'tc-grid');
            grid.append(radioChoice('messageBackground', 'none', t('neutral'), '', draft.messageBackground === 'none',
                () => change('messageBackground', 'none')));
            Object.keys(env.builtins).filter(id => id !== 'neutral').forEach(id => {
                grid.append(radioChoice('messageBackground', id, t(id), env.builtins[id].thumb,
                    draft.messageBackground === id, () => change('messageBackground', id)));
            });
            pending.concat(images).filter(item => !removed.has(item.id)).forEach(item => {
                grid.append(radioChoice('messageBackground', item.id, labelFor(item.id), item.thumb,
                    draft.messageBackground === item.id, () => change('messageBackground', item.id)));
            });
            section.append(grid, uploadField('messageBackground', t('message_upload')),
                colorField('messageFill', t('message_fill')),
                selectField('messageFit', t('fit'), [['cover',t('cover')],['contain',t('contain')]], t('contain_blur_help')),
                selectField('messagePosition', t('position'), ['center','top','bottom','left','right'].map(x => [x,t(x)])));
        } else {
            section.append(el('p', 'tc-help', t('message_theme_help')));
        }
        const bodyMode = el('select', 'tc-input');
        [['original', t('body_original')], ['reading', t('body_reading')], ['custom', t('body_custom')]].forEach(([value, label]) => {
            const option = el('option', '', label); option.value = value; bodyMode.append(option);
        });
        bodyMode.value = draft.messageBodyMode;
        bodyMode.addEventListener('change', () => { change('messageBodyMode', bodyMode.value); renderMessageControls(); });
        section.append(field(t('body_source'), bodyMode));
        if (draft.messageBodyMode === 'custom') section.append(colorField('messageBodyFill', t('body_fill')));
        section.append(el('p', 'tc-help', t('body_help')));
        markChoices();
    }

    function renderControls() {
        const section = panel.querySelector('#tc-section-interface');
        section.replaceChildren(
            selectField('mailView', t('mail_view'), [['single', t('mail_view_single')], ['split', t('mail_view_split')]]),
            selectField('mode', t('mode'), ['system','light','dark'].map(x => [x,t(x)])),
            colorField('accent', t('accent')),
            rangeField('surface', t('surface'), 10, 100, '%'),
            rangeField('radius', t('radius'), 0, 24, ' px'),
            rangeField('text', t('text'), 12, 18, ' px'),
            selectField('density', t('density'), ['compact','normal','spacious'].map(x => [x,t(x)]))
        );
    }

    function setBusy() {
        if (!panel) return;
        panel.querySelectorAll('button, input, select').forEach(node => { node.disabled = busy; });
    }

    function buildPanel() {
        panel = el('aside', 'tc-panel');
        panel.id = 'tc-panel'; panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'tc-title');
        const header = el('header', 'tc-header');
        const heading = el('div', 'tc-heading');
        const title = el('h2', '', t('appearance')); title.id = 'tc-title';
        heading.append(el('span', 'tc-hero-kicker', t('preview')), title,
            el('span', 'tc-hero-current', labelFor(draft.background)));
        const close = makeButton('×', 'tc-close', () => cancelAndClose());
        close.setAttribute('aria-label', t('close'));
        header.append(heading, close);
        const [tabs, body] = makeSections();
        const footer = el('footer', 'tc-footer');
        footer.append(makeButton(t('reset'), 'tc-secondary', () => {
            draft = Object.assign({}, saved, { preset:'neutral', background:'none', mode:'system', accent:'#3975c6',
                surface:94, radius:12, text:14, density:'normal', dim:0, blur:0, brightness:100,
                fit:'cover', position:'center', fill:'#e8edf3',
                messageMode:'theme', messageBackground:'none', messageFill:'#f7f9fc', messageSurface:94,
                messageFit:'cover', messagePosition:'center', messageBodyMode:'original', messageBodyFill:'#26323d',
                mailView:'single' });
            apply(draft); renderChoices(); renderControls(); message(t('reset_preview'));
        }), makeButton(t('cancel'), 'tc-secondary', () => cancelAndClose()),
        makeButton(t('save'), 'tc-primary', save));
        const status = el('div', 'tc-message'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        panel.append(header, tabs, body, status, footer);
        document.body.append(panel);
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); cancelAndClose(); }
            if (event.key === 'Tab' && window.matchMedia('(max-width: 600px)').matches) {
                const focusable = Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')).filter(x => x.offsetParent !== null);
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
    }

    function open() {
        if (opened) return;
        if (!panel) buildPanel();
        opener = document.activeElement;
        draft = clone(saved); removed.clear();
        tab = randomId(); pending = [];
        renderChoices(); renderControls();
        panel.hidden = false; opened = true;
        root.classList.add('tc-open');
        updateModal();
        heartbeat = window.setInterval(() => { if (opened && pending.length) request('touch').catch(() => {}); }, 60000);
        message('');
        panel.querySelector('.tc-close').focus();
    }

    function updateModal() {
        if (!panel || !opened) return;
        const mobile = window.matchMedia('(max-width: 600px)').matches;
        panel.setAttribute('aria-modal', mobile ? 'true' : 'false');
        if (mobile) {
            Array.from(document.body.children).forEach(node => {
                if (node !== panel && !modalInert.has(node)) {
                    modalInert.set(node, node.inert);
                    node.inert = true;
                }
            });
        } else restoreInert();
    }

    function restoreInert() {
        modalInert.forEach((value, node) => { node.inert = value; });
        modalInert.clear();
    }

    async function cancelAndClose() {
        if (!opened || busy) return;
        apply(saved);
        close();
        if (pending.length) {
            try { await request('cancel'); } catch (_) { /* Expiry cleanup handles unreachable server. */ }
        }
        pending = []; removed.clear();
    }

    function close() {
        panel.hidden = true; opened = false;
        window.clearInterval(heartbeat); heartbeat = null;
        root.classList.remove('tc-open');
        restoreInert();
        if (opener && opener.isConnected) opener.focus();
    }

    function mountMailSelection() {
        if (rcmail.env.task !== 'mail' || rcmail.env.action || !rcmail.message_list) return;
        const list = document.getElementById('messagelist');
        const listPanel = document.getElementById('layout-list');
        if (!list || !listPanel) return;
        root.classList.add('tc-mail-list-ui');

        // Elastic already creates and maintains the real selection checkboxes.
        // Keep its selection model so bulk commands, threads and page changes work.
        list.classList.add('withselection');
        const bar = el('div', 'tc-bulk-actions');
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', t('bulk_actions'));
        const count = el('span', 'tc-bulk-count');
        count.setAttribute('aria-live', 'polite');
        const buttons = [];
        const iconPaths = {
            pin: ['M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z', 'M12 14v7'],
            markread: ['M3 9l9-5 9 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z', 'm3 9 9 7 9-7'],
            markunread: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'm3 7 9 6 9-6'],
            moveto: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z', 'M10 14h8m-3-3 3 3-3 3'],
            delete: ['M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6m4-6v6'],
        };
        const actions = [
            ['pin', 'pin', null],
            ['markread', 'mark', 'read'],
            ['markunread', 'mark', 'unread'],
            ['moveto', 'move', null],
            ['delete', 'delete', null],
        ];
        for (const [label, command, prop] of actions) {
            const button = el('button', 'tc-bulk-button tc-bulk-' + (prop || command));
            button.type = 'button';
            button.title = t('bulk_' + label);
            button.setAttribute('aria-label', button.title);
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('aria-hidden', 'true');
            for (const d of iconPaths[label]) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);
                icon.append(path);
            }
            button.append(icon);
            button.append(el('span', 'tc-bulk-label', t('bulk_' + label)));
            button.disabled = true;
            button.addEventListener('click', async event => {
                if (button.disabled) return;
                if (command === 'pin') {
                    const groups = new Map();
                    for (const uid of rcmail.message_list.get_selection(false)) {
                        const mbox = rcmail.env.messages?.[uid]?.mbox || rcmail.env.mailbox;
                        if (!groups.has(mbox)) groups.set(mbox, []);
                        groups.get(mbox).push(mailUid(uid));
                    }
                    button.disabled = true;
                    try { for (const [mbox, uids] of groups) await setPins(mbox, uids, true); }
                    catch (error) { rcmail.display_message(errorText(error), 'error'); }
                    update();
                } else rcmail.command(command, prop === null ? undefined : prop, button, event);
            });
            buttons.push([button, command]);
        }
        bar.append(count, ...buttons.map(item => item[0]));
        listPanel.insertBefore(bar, document.getElementById('messagelist-content'));

        function update() {
            const selected = rcmail.message_list.get_selection(false).length;
            count.textContent = t('bulk_selected') + ': ' + selected;
            for (const [button, command] of buttons) button.disabled = selected === 0 || (command !== 'pin' && !rcmail.commands[command]);
        }
        rcmail.message_list.addEventListener('select', update);
        rcmail.addEventListener('listupdate', update);
        mountMailRows(list);
        update();
    }

    function mailIcon(name) {
        const paths = {
            pin: ['M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z', 'M12 14v7'],
            flag: ['M5 21V4', 'M5 5c5-4 9 4 14 0v11c-5 4-9-4-14 0'],
            trash: ['M4 7h16', 'M9 7V4h6v3', 'm6 7 1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
            unread: ['M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'm3 7 9 6 9-6'],
            read: ['M3 9l9-5 9 5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z', 'm3 9 9 7 9-7'],
            move: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z', 'M10 14h8', 'm15 11 3 3-3 3'],
            more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
            attachment: ['M20 12.5 11 21a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.3-8.3'],
        };
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        for (const d of paths[name]) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            svg.append(path);
        }
        return svg;
    }

    function envelopeIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        for (const name of ['unread', 'read']) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('tc-envelope-' + name);
            for (const path of mailIcon(name).querySelectorAll('path')) group.append(path.cloneNode());
            svg.append(group);
        }
        return svg;
    }

    function mailUid(uid) {
        return String(uid).match(/^([1-9][0-9]{0,19})(?:\.[0-9.]+)?(?:-.+)?$/)?.[1] || String(uid);
    }

    async function setPins(mbox, uids, pinned) {
        const result = await request('pin', { _mbox: mbox, _uids: JSON.stringify(uids), _pinned: pinned ? '1' : '0' });
        pins = result.pins || {};
        document.querySelectorAll('#messagelist tbody tr.message').forEach(syncMailRow);
        sortPinnedRows();
    }

    function sortPinnedRows() {
        if (rcmail.env.threading === true || rcmail.env.threading === 1 || rcmail.env.threading === '1') return;
        const tbody = document.querySelector('#messagelist tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll(':scope > tr.message'));
        const first = rows.find(row => !row.classList.contains('tc-pinned'));
        for (const row of rows) if (row.classList.contains('tc-pinned')) tbody.insertBefore(row, first || null);
    }

    function syncMailRow(row) {
        if (!row || !row.uid) return;
        const record = rcmail.message_list.rows[row.uid];
        if (!record) return;
        const mbox = rcmail.env.messages?.[row.uid]?.mbox || rcmail.env.mailbox;
        const pinned = !!Object.prototype.hasOwnProperty.call(pins[mbox] || {}, mailUid(row.uid));
        row.classList.toggle('tc-pinned', pinned);
        const actions = row.querySelector('.tc-row-actions');
        if (!actions) return;
        const state = [
            ['pin', pinned ? 'bulk_unpin' : 'bulk_pin', pinned],
            ['read', record.unread ? 'row_read' : 'row_unread', !!record.unread],
            ['flag', record.flagged ? 'row_unflag' : 'row_flag', !!record.flagged],
        ];
        for (const [name, label, active] of state) {
            const button = actions.querySelector('[data-tc-action="' + name + '"]');
            if (!button) continue;
            button.title = t(label);
            button.setAttribute('aria-label', button.title);
            button.classList.toggle('tc-active', !!active);
            if (name === 'read') button.dataset.tcState = record.unread ? 'unread' : 'read';
        }
    }

    function mountMailRows(list) {
        const wrapper = document.getElementById('messagelist-content');
        const tooltip = el('div', 'tc-mail-tooltip');
        tooltip.hidden = true;
        tooltip.setAttribute('role', 'tooltip');
        const menu = el('div', 'tc-mail-context-menu');
        menu.hidden = true;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', t('context_actions'));
        document.body.append(tooltip, menu);
        const snippets = new Map(), pendingSnippets = new Map(), loadingSnippets = new Set();
        let timer, hoverTimer, hovered, menuRow;
        const keyFor = row => (rcmail.env.messages?.[row.uid]?.mbox || rcmail.env.mailbox) + '\0' + mailUid(row.uid);
        const observer = window.IntersectionObserver ? new IntersectionObserver(entries => {
            entries.forEach(entry => { if (entry.isIntersecting) queueSnippet(entry.target); });
        }, { root: wrapper, rootMargin: '250px' }) : null;

        function showTooltip(row) {
            if (hovered !== row || !menu.hidden) return;
            const text = snippets.get(keyFor(row));
            if (!text) return;
            tooltip.textContent = text;
            tooltip.hidden = false;
            const rect = row.getBoundingClientRect();
            tooltip.style.left = Math.max(8, Math.min(rect.left + 170, innerWidth - 520)) + 'px';
            tooltip.style.top = Math.min(rect.bottom + 6, innerHeight - Math.min(tooltip.offsetHeight, 280) - 8) + 'px';
        }

        function queueSnippet(row) {
            if (!row?.uid) return;
            const key = keyFor(row);
            if (snippets.has(key) || pendingSnippets.has(key) || loadingSnippets.has(key)) return;
            pendingSnippets.set(key, row);
            clearTimeout(timer);
            timer = setTimeout(loadSnippets, 80);
        }

        async function loadSnippets() {
            const groups = new Map();
            for (const [key, row] of pendingSnippets) {
                const mbox = rcmail.env.messages?.[row.uid]?.mbox || rcmail.env.mailbox;
                if (!groups.has(mbox)) groups.set(mbox, []);
                groups.get(mbox).push([key, row]);
                pendingSnippets.delete(key);
            }
            for (const [mbox, rows] of groups) {
                for (let i = 0; i < rows.length; i += 12) {
                    const batch = rows.slice(i, i + 12);
                    batch.forEach(([key]) => loadingSnippets.add(key));
                    try {
                        const result = await request('snippets', { _mbox: mbox, _uids: JSON.stringify(batch.map(([, row]) => mailUid(row.uid))) });
                        for (const [key, row] of batch) {
                            const text = result.snippets?.[mailUid(row.uid)] || '';
                            snippets.set(key, text);
                            row.querySelector('.tc-row-snippet')?.replaceChildren(document.createTextNode(text || t('row_preview_empty')));
                            if (hovered === row) showTooltip(row);
                        }
                    } catch (_) { /* A later list update or hover can retry. */ }
                    finally { batch.forEach(([key]) => loadingSnippets.delete(key)); }
                }
            }
        }

        function closeMenu() {
            menu.hidden = true;
            menuRow?.querySelector('.tc-row-more')?.setAttribute('aria-expanded', 'false');
            menuRow = null;
        }

        async function runRowAction(name, row, event) {
            const record = rcmail.message_list.rows[row.uid];
            if (!record) return;
            const mbox = rcmail.env.messages?.[row.uid]?.mbox || rcmail.env.mailbox;
            if (name === 'pin') {
                try { await setPins(mbox, [mailUid(row.uid)], !row.classList.contains('tc-pinned')); }
                catch (error) { rcmail.display_message(errorText(error), 'error'); }
            } else if (name === 'flag') rcmail.mark_message(record.flagged ? 'unflagged' : 'flagged', row.uid);
            else if (name === 'read') rcmail.mark_message(record.unread ? 'read' : 'unread', row.uid);
            else if (name === 'delete') {
                if (record.deleted) rcmail.mark_message('undelete', row.uid);
                else rcmail.delete_messages(event, row.uid);
            } else if (name === 'move') {
                rcmail.folder_selector(event, (folder, button) => {
                    rcmail.command('move', { id: folder, uids: [row.uid] }, button, event, true);
                });
            }
            setTimeout(() => syncMailRow(row), 100);
        }

        function openMenu(event, row) {
            event.preventDefault();
            event.stopPropagation();
            const record = rcmail.message_list.rows[row.uid];
            if (!record) return;
            clearTimeout(hoverTimer);
            tooltip.hidden = true;
            hovered = null;
            menuRow?.querySelector('.tc-row-more')?.setAttribute('aria-expanded', 'false');
            menuRow = row;
            row.querySelector('.tc-row-more')?.setAttribute('aria-expanded', 'true');
            menu.replaceChildren();
            const options = [
                ['pin', 'pin', row.classList.contains('tc-pinned') ? 'bulk_unpin' : 'bulk_pin'],
                ['read', record.unread ? 'read' : 'unread', record.unread ? 'row_read' : 'row_unread'],
                ['flag', 'flag', record.flagged ? 'row_unflag' : 'row_flag'],
                ['move', 'move', 'bulk_moveto'],
                ['delete', 'trash', record.deleted ? 'row_undelete' : 'row_delete'],
            ];
            for (const [action, iconName, label] of options) {
                const button = el('button', 'tc-mail-context-action');
                button.type = 'button';
                button.setAttribute('role', 'menuitem');
                button.dataset.tcAction = action;
                button.append(mailIcon(iconName), el('span', '', t(label)));
                button.addEventListener('click', click => {
                    click.stopPropagation();
                    if (action === 'move') {
                        runRowAction(action, row, click);
                        closeMenu();
                    } else {
                        closeMenu();
                        runRowAction(action, row, click);
                    }
                });
                menu.append(button);
            }
            menu.hidden = false;
            const rect = row.getBoundingClientRect();
            const x = event.clientX > 0 ? event.clientX : rect.left + 12;
            const y = event.clientY > 0 ? event.clientY : rect.bottom;
            menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
            menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
            menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
        }

        function decorate(row) {
            if (!row || row.classList.contains('tc-mail-row')) return;
            const selection = row.querySelector('td.selection');
            const subject = row.querySelector('td.subject');
            if (!selection || !subject) return;
            row.classList.add('tc-mail-row');
            const controls = el('span', 'tc-row-actions');
            for (const name of ['pin', 'read', 'flag', 'more']) {
                const button = el('button', 'tc-row-action tc-row-' + name);
                button.type = 'button'; button.dataset.tcAction = name;
                button.append(name === 'read' ? envelopeIcon() : mailIcon(name));
                if (name === 'more') {
                    button.title = t('context_actions');
                    button.setAttribute('aria-label', button.title);
                    button.setAttribute('aria-haspopup', 'menu');
                    button.setAttribute('aria-expanded', 'false');
                }
                for (const type of ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend']) {
                    button.addEventListener(type, event => { event.stopPropagation(); if (type === 'mousedown') event.preventDefault(); });
                }
                button.addEventListener('click', async event => {
                    if (name === 'more') openMenu(event, row);
                    else {
                        if (name === 'pin') button.disabled = true;
                        try { await runRowAction(name, row, event); }
                        finally { button.disabled = false; }
                    }
                });
                controls.append(button);
            }
            selection.append(controls);
            const content = el('div', 'tc-row-content');
            const first = el('div', 'tc-row-first');
            const from = subject.querySelector(':scope > .fromto');
            const title = subject.querySelector(':scope > .subject');
            if (from) first.append(from);
            if (title) first.append(title);
            const subjectLink = title?.querySelector('a');
            if (subjectLink) {
                subjectLink.removeAttribute('onmouseover');
                subjectLink.removeAttribute('title');
            }
            const snippet = el('div', 'tc-row-snippet', '…');
            content.append(first, snippet);
            const trailing = el('div', 'tc-row-trailing');
            const date = subject.querySelector(':scope > .date');
            if (date) trailing.append(date);
            const attachment = row.querySelector('td.flags > .attachment');
            if (attachment && attachment.querySelector('.attachment')) {
                const icon = el('span', 'tc-row-attachment');
                icon.title = rcmail.gettext('withattachment');
                icon.append(mailIcon('attachment'));
                trailing.append(icon);
            }
            subject.append(content, trailing);
            syncMailRow(row);
            observer?.observe(row);
            if (!observer) queueSnippet(row);
            row.addEventListener('mouseenter', () => {
                hovered = row; queueSnippet(row);
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => showTooltip(row), 450);
            });
            row.addEventListener('mouseleave', () => {
                if (hovered === row) hovered = null;
                clearTimeout(hoverTimer); tooltip.hidden = true;
            });
            row.addEventListener('contextmenu', event => openMenu(event, row));
        }

        rcmail.message_list.addEventListener('initrow', record => decorate(record.obj));
        rcmail.addEventListener('listupdate', () => {
            closeMenu();
            list.querySelectorAll('tbody tr.message').forEach(decorate);
            list.querySelectorAll('tbody tr.message').forEach(syncMailRow);
            sortPinnedRows();
        });
        list.querySelectorAll('tbody tr.message').forEach(decorate);
        sortPinnedRows();
        const changes = new MutationObserver(records => {
            for (const record of records) if (record.type === 'attributes' && record.target.classList.contains('tc-mail-row')) syncMailRow(record.target);
        });
        changes.observe(list.tBodies[0], { subtree: true, attributes: true, attributeFilter: ['class'] });
        document.addEventListener('pointerdown', event => {
            if (!menu.hidden && !menu.contains(event.target)) closeMenu();
        }, true);
        document.addEventListener('keydown', event => {
            if (menu.hidden) {
                if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
                    && document.activeElement?.closest('#messagelist tr.message')) {
                    openMenu(event, document.activeElement.closest('#messagelist tr.message'));
                }
                return;
            }
            if (event.key === 'Escape' || event.key === 'Tab') {
                closeMenu();
                return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const choices = Array.from(menu.querySelectorAll('button:not(:disabled)'));
                const index = choices.indexOf(document.activeElement);
                choices[(index + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length]?.focus();
            }
        }, true);
        wrapper?.addEventListener('scroll', closeMenu, { passive: true });
        window.addEventListener('resize', closeMenu);
    }

    async function save() {
        if (busy) return;
        busy = true; setBusy(); message(t('saving'));
        try {
            const remove = Array.from(removed).filter(id => images.some(x => x.id === id));
            if (removed.has(draft.background)) draft.background = 'none';
            if (removed.has(draft.messageBackground)) draft.messageBackground = 'none';
            const discard = Array.from(removed).filter(id => pending.some(x => x.id === id));
            const result = await request('save', { _settings: JSON.stringify(draft), _remove: JSON.stringify(remove), _discard: JSON.stringify(discard) });
            saved = clone(result.settings); draft = clone(saved);
            images = clone(result.images); pending = []; removed.clear();
            apply(saved); message(t('saved'));
            close();
            rcmail.display_message(t('saved'), 'confirmation');
        } catch (error) { message(errorText(error), true); }
        finally { busy = false; setBusy(); }
    }

    media.addEventListener('change', () => requestAnimationFrame(() => apply(opened ? draft : saved)));
    window.addEventListener('resize', updateModal);
    document.addEventListener('click', event => {
        if (!root.classList.contains('tc-mail-single') || window.innerWidth < 769
            || !event.target.closest('#layout-content .back-list-button')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        root.classList.remove('tc-mail-reader');
        rcmail.show_contentframe(false);
        rcmail.message_list?.clear_selection();
        document.getElementById('messagelist-content')?.focus({ preventScroll: true });
    }, true);
    apply(saved);
    rcmail.addEventListener('init', () => {
        rcmail.register_command('plugin.theme_customizer.open', open, true);
        mountMailSelection();
        if (rcmail.env.task === 'mail' && document.getElementById('messagecontframe')) {
            const originalDoubleClick = rcmail.msglist_dbl_click;
            rcmail.msglist_dbl_click = function (list) {
                if (root.classList.contains('tc-mail-single') && window.innerWidth >= 769) {
                    window.clearTimeout(rcmail.preview_timer);
                    rcmail.msglist_get_preview();
                    return;
                }
                return originalDoubleClick.call(this, list);
            };
        }
        if (Array.isArray(rcmail.env.compose_commands)
            && !rcmail.env.compose_commands.includes('plugin.theme_customizer.open')) {
            rcmail.env.compose_commands.push('plugin.theme_customizer.open');
        }
        mountComposePreview();
        rcmail.addEventListener('editor-load', () => {
            if (document.getElementById('composebodycontainer')) {
                const state = opened ? draft : saved;
                const dark = state.mode === 'dark' || (state.mode === 'system' && media.matches);
                syncComposeEditor(bodyAppearance(state, dark));
            }
        });
        const frame = document.getElementById('messagecontframe');
        if (frame) frame.addEventListener('load', () => {
            const state = opened ? draft : saved;
            syncMessageFrame(root.classList.contains('tc-dark'), root.classList.contains('tc-message-low'),
                bodyAppearance(state, root.classList.contains('tc-dark')));
            if (root.classList.contains('tc-mail-single')) {
                let messageLoaded = false;
                try { messageLoaded = !!frame.contentDocument?.getElementById('message-header'); }
                catch (_) { /* The native preview controls access to its frame. */ }
                root.classList.toggle('tc-mail-reader', messageLoaded);
            }
        });
        apply(saved);
    });
    window.addEventListener('beforeunload', () => {
        if (opened) apply(saved);
        if (pending.length && navigator.sendBeacon) {
            const data = new FormData();
            data.set('_op', 'cancel'); data.set('_tab', tab); data.set('_token', rcmail.env.request_token);
            navigator.sendBeacon(env.api, data);
        }
    });
})();
