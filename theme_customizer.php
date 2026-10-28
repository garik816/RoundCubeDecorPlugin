<?php

/** Elastic appearance editor for Roundcube. */
class theme_customizer extends rcube_plugin
{
    public $task = 'login|mail|addressbook|settings';
    public $noframe = true;
    private $saving = false;
    private $initialized = false;
    private const KEY = 'theme_customizer';
    private const PIN_KEY = 'theme_customizer_pins';
    private $preset_cache;

    private function presets()
    {
        if ($this->preset_cache !== null) return $this->preset_cache;
        $manifest = json_decode((string) @file_get_contents(__DIR__ . '/backgrounds/manifest.json'), true);
        $items = [];
        foreach (($manifest['presets'] ?? []) as $id => $item) {
            if (!preg_match('/^[a-z][a-z0-9_-]{0,31}$/D', $id) || !is_array($item)) continue;
            if ($id !== 'neutral' && (!is_file(__DIR__ . '/backgrounds/full/' . $id . '.jpg') || !is_file(__DIR__ . '/backgrounds/thumbs/' . $id . '.jpg'))) continue;
            if (!in_array($item['mode'] ?? '', ['light','dark','system'], true) || !preg_match('/^#[0-9a-fA-F]{6}$/D', $item['accent'] ?? '') || !is_int($item['surface'] ?? null) || $item['surface'] < 10 || $item['surface'] > 100) continue;
            $items[$id] = ['background' => $id === 'neutral' ? 'none' : $id, 'mode' => $item['mode'], 'accent' => $item['accent'], 'surface' => $item['surface']];
        }
        if (!isset($items['neutral'])) $items['neutral'] = ['background' => 'none', 'mode' => 'system', 'accent' => '#3975c6', 'surface' => 94];
        return $this->preset_cache = $items;
    }

    public function init()
    {
        if ($this->initialized) return;
        $rc = rcmail::get_instance();
        if ($rc->config->get('skin') !== 'elastic') return;
        $this->load_config();
        $logos = $rc->config->get('skin_logo');
        if (!is_array($logos)) $logos = $logos ? ['*' => $logos] : [];
        $logos['elastic:*'] = $this->url('assets/logo-transparent.svg');
        $rc->config->set('skin_logo', $logos);
        if ($rc->output && $rc->output->type === 'html') {
            $this->include_stylesheet('styles/logo_link.css');
            $this->include_script('js/logo_link.js');
        }
        if (!$rc->user || !$rc->user->ID) return;
        $this->initialized = true;
        $this->add_texts('localization', true);
        $this->register_action('plugin.theme_customizer', [$this, 'api']);
        $this->register_action('plugin.theme_customizer.image', [$this, 'image']);
        $this->add_hook('preferences_update', [$this, 'fresh_preferences']);
        if (!$rc->output || $rc->output->type !== 'html') return;
        if (($_SESSION['language'] ?? '') === 'uk_UA') {
            $warning = $rc->gettext('core_notsentwarning', $this->ID);
            $rc->load_language(null, [], ['notsentwarning' => $warning]);
            $rc->output->add_label('notsentwarning');
        }
        $this->include_stylesheet('styles/theme_customizer.css');
        $this->include_script('js/theme_customizer.js');
        $this->cleanup_expired_on_page();
        $this->add_button([
            'type' => 'link', 'command' => 'plugin.theme_customizer.open',
            'label' => 'appearance', 'title' => 'appearance',
            'class' => 'tc-nav', 'classact' => 'tc-nav', 'innerclass' => 'inner',
            'domain' => $this->ID,
        ], 'taskbar');
        $rc->output->set_env('theme_customizer', [
            'settings' => $this->settings(), 'presets' => $this->presets(),
            'builtins' => $this->builtins(), 'images' => $this->gallery(),
            'logo' => $rc->output->asset_url($this->url('assets/logo-transparent.svg')),
            'api' => $rc->url('plugin.theme_customizer'),
            'image' => $rc->url('plugin.theme_customizer.image'),
            'formats' => $this->formats(),
            'upload' => $this->upload_error(),
            'pins' => $this->pins(),
        ]);
    }

    public function fresh_preferences($p)
    {
        if ($this->saving) {
            $p['old'] = $this->raw_prefs();
        }
        return $p;
    }

    private function raw_prefs()
    {
        $rc = rcmail::get_instance();
        $db = $rc->get_dbh();
        $row = $db->fetch_assoc($db->query('SELECT preferences FROM ' . $db->table_name('users', true) . ' WHERE user_id = ?', $rc->user->ID));
        $value = $row && !empty($row['preferences']) ? @unserialize($row['preferences'], ['allowed_classes' => false]) : [];
        return is_array($value) ? $value : [];
    }

    private function pins()
    {
        $pins = $this->raw_prefs()[self::PIN_KEY] ?? [];
        return is_array($pins) ? $pins : [];
    }

    private function defaults()
    {
        return ['v' => 1, 'rev' => '', 'preset' => 'neutral', 'background' => 'none', 'mode' => 'system',
            'accent' => '#3975c6', 'surface' => 94, 'radius' => 12, 'text' => 14,
            'density' => 'normal', 'dim' => 0, 'blur' => 0, 'brightness' => 100, 'fit' => 'cover',
            'position' => 'center', 'fill' => '#e8edf3',
            'messageMode' => 'theme', 'messageBackground' => 'none', 'messageFill' => '#f7f9fc',
            'messageSurface' => 94, 'messageFit' => 'cover', 'messagePosition' => 'center',
            'messageBodyMode' => 'original', 'messageBodyFill' => '#26323d',
            'mailView' => 'single'];
    }

    private function settings()
    {
        $saved = $this->raw_prefs()[self::KEY] ?? null;
        if (!is_array($saved) || ($saved['v'] ?? null) !== 1) {
            return $this->defaults();
        }
        if (!array_key_exists('messageSurface', $saved)) $saved['messageSurface'] = $saved['surface'] ?? 94;
        $safe = $this->validate($saved, false);
        if (!$safe) return $this->defaults();
        if (str_starts_with($safe['background'], 'u_') && !$this->image_exists($safe['background'])) {
            $safe['background'] = 'none';
            $safe['preset'] = 'custom';
        }
        if (str_starts_with($safe['messageBackground'], 'u_') && !$this->image_exists($safe['messageBackground'])) {
            $safe['messageBackground'] = 'none';
        }
        return $safe;
    }

    private function validate($input, $strict = true)
    {
        if (!is_array($input)) return false;
        $d = $this->defaults();
        $x = array_merge($d, array_intersect_key($input, $d));
        if (($x['v'] !== 1) || !is_string($x['rev']) || !preg_match('/^[a-f0-9]{0,32}$/D', $x['rev'])) return false;
        foreach (['preset' => array_merge(['custom'], array_keys($this->presets())), 'mode' => ['light','dark','system'],
            'density' => ['compact','normal','spacious'], 'fit' => ['cover','contain'], 'messageFit' => ['cover','contain'],
            'position' => ['center','top','bottom','left','right'], 'messagePosition' => ['center','top','bottom','left','right'],
            'messageMode' => ['theme','custom'], 'messageBodyMode' => ['original','reading','custom'],
            'mailView' => ['single','split']] as $key => $allowed) {
            if (!is_string($x[$key]) || !in_array($x[$key], $allowed, true)) return false;
        }
        foreach (['accent','fill','messageFill','messageBodyFill'] as $key) {
            if (!is_string($x[$key]) || !preg_match('/^#[0-9a-fA-F]{6}$/D', $x[$key])) return false;
            $x[$key] = strtolower($x[$key]);
        }
        foreach (['surface' => [10,100], 'messageSurface' => [10,100], 'radius' => [0,24], 'text' => [12,18], 'dim' => [0,60], 'blur' => [0,20], 'brightness' => [100,180]] as $key => $range) {
            if (!is_int($x[$key]) || $x[$key] < $range[0] || $x[$key] > $range[1]) return false;
        }
        foreach (['background','messageBackground'] as $key) {
            if (!is_string($x[$key])) return false;
            if ($x[$key] !== 'none' && ($x[$key] === 'neutral' || !isset($this->presets()[$x[$key]]))) {
                if (!preg_match('/^u_[a-f0-9]{32}$/D', $x[$key])) return false;
                if ($strict && !$this->image_exists($x[$key])) return false;
            }
        }
        return $x;
    }

    private function builtins()
    {
        $output = rcmail::get_instance()->output;
        $list = [];
        foreach ($this->presets() as $id => $p) {
            $list[$id] = ['full' => $id === 'neutral' ? '' : $output->asset_url($this->url('backgrounds/full/' . $id . '.jpg')),
                'thumb' => $id === 'neutral' ? '' : $output->asset_url($this->url('backgrounds/thumbs/' . $id . '.jpg'))];
        }
        return $list;
    }

    private function base()
    {
        $rc = rcmail::get_instance();
        $root = $rc->config->get('theme_customizer_storage', '');
        if (!is_string($root) || $root === '' || $root[0] !== '/') return false;
        $storage = realpath($root);
        if (!$storage || !is_dir($storage)) return false;
        $webroot = defined('INSTALL_PATH') ? realpath(INSTALL_PATH) : false;
        if ($storage && $webroot && ($storage === $webroot || str_starts_with($storage, rtrim($webroot, '/') . '/'))) return false;
        return rtrim($storage, '/') . '/u' . (int)$rc->user->ID;
    }

    private function ensure_base()
    {
        $base = $this->base();
        if (!$base || (!is_dir($base) && !@mkdir($base, 0700, true)) || !is_writable($base)) return false;
        return $base;
    }

    private function read_index($base)
    {
        $data = @json_decode(@file_get_contents($base . '/index.json'), true);
        return is_array($data) && isset($data['saved'], $data['pending']) && is_array($data['saved']) && is_array($data['pending'])
            ? $data : ['saved' => [], 'pending' => []];
    }

    private function write_index($base, $data)
    {
        $tmp = $base . '/index.' . bin2hex(random_bytes(6)) . '.tmp';
        if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_SLASHES), LOCK_EX) === false || !@rename($tmp, $base . '/index.json')) {
            @unlink($tmp); return false;
        }
        @chmod($base . '/index.json', 0600);
        return true;
    }

    private function with_lock($callback)
    {
        $base = $this->ensure_base();
        if (!$base) return $this->reply(false, 'storage_unavailable', 503);
        $fp = @fopen($base . '/.lock', 'c');
        if (!$fp || !flock($fp, LOCK_EX)) return $this->reply(false, 'storage_unavailable', 503);
        if (is_file($base . '/index.json')) {
            $raw = @json_decode((string) @file_get_contents($base . '/index.json'), true);
            if (!is_array($raw) || !isset($raw['saved'], $raw['pending']) || !is_array($raw['saved']) || !is_array($raw['pending'])) {
                $this->reply(false, 'storage_unavailable', 503);
            }
        }
        try { $callback($base); } finally { flock($fp, LOCK_UN); fclose($fp); }
    }

    private function cleanup_expired_on_page()
    {
        $base = $this->base();
        if (!$base || !is_file($base . '/index.json')) return;
        $fp = @fopen($base . '/.lock', 'c');
        if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) { if ($fp) fclose($fp); return; }
        try {
            $index = $this->read_index($base);
            $count = count($index['pending']);
            $this->cleanup($base, $index);
            if (count($index['pending']) !== $count) $this->write_index($base, $index);
        } finally { flock($fp, LOCK_UN); fclose($fp); }
    }

    private function gallery()
    {
        $base = $this->base();
        if (!$base || !is_file($base . '/index.json')) return [];
        $saved = $this->read_index($base)['saved'] ?? [];
        $out = [];
        foreach ($saved as $id => $meta) {
            if (preg_match('/^u_[a-f0-9]{32}$/D', $id) && is_file($base . '/' . $id . '.jpg')) {
                $out[] = ['id' => $id, 'url' => rcmail::get_instance()->url('plugin.theme_customizer.image', false) . '&_id=' . $id,
                    'thumb' => rcmail::get_instance()->url('plugin.theme_customizer.image', false) . '&_id=' . $id . '&_thumb=1'];
            }
        }
        return $out;
    }

    private function image_exists($id)
    {
        $base = $this->base();
        if (!$base) return false;
        $index = $this->read_index($base);
        return isset($index['saved'][$id]) && is_file($base . '/' . $id . '.jpg');
    }

    private function formats()
    {
        if (!extension_loaded('imagick')) return [];
        $formats = array_map('strtoupper', Imagick::queryFormats());
        $out = [];
        foreach (['JPEG','PNG','WEBP'] as $f) if (in_array($f, $formats, true)) $out[] = $f;
        return $out;
    }

    private function upload_error()
    {
        if (!$this->base()) {
            return rcmail::get_instance()->config->get('theme_customizer_storage', '') ? 'storage_unavailable' : 'storage_unconfigured';
        }
        if (!extension_loaded('imagick')) return 'image_library_unavailable';
        if (!is_dir(dirname($this->base())) || !is_writable(dirname($this->base()))) return 'storage_unavailable';
        return '';
    }

    private function reply($ok, $code, $status = 200, $extra = [])
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['ok' => $ok, 'code' => $code] + $extra, JSON_UNESCAPED_SLASHES);
        exit;
    }

    public function api()
    {
        $rc = rcmail::get_instance();
        if (!$rc->user || !$rc->user->ID) $this->reply(false, 'session_expired', 401);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['_token']) || !hash_equals($rc->get_request_token(), (string)$_POST['_token']) || !$rc->check_request()) {
            $this->reply(false, 'csrf', 403);
        }
        $op = $_POST['_op'] ?? '';
        if ($op === 'upload') return $this->upload();
        if ($op === 'cancel') return $this->cancel();
        if ($op === 'touch') return $this->touch();
        if ($op === 'save') return $this->save();
        if ($op === 'pin') return $this->pin();
        if ($op === 'snippets') return $this->snippets();
        $this->reply(false, 'bad_request', 400);
    }

    private function mail_request()
    {
        $mbox = $_POST['_mbox'] ?? null;
        if (!is_string($mbox) || $mbox === '' || strlen($mbox) > 255 || str_contains($mbox, "\0")) {
            $this->reply(false, 'bad_request', 400);
        }
        return $mbox;
    }

    private function pin()
    {
        $rc = rcmail::get_instance();
        $mbox = $this->mail_request();
        $uids = json_decode((string)($_POST['_uids'] ?? ''), true);
        $pinned = $_POST['_pinned'] ?? null;
        if (!is_array($uids) || !array_is_list($uids) || count($uids) < 1 || count($uids) > 100 || !in_array($pinned, ['0', '1'], true)) {
            $this->reply(false, 'bad_request', 400);
        }
        foreach ($uids as $uid) if (!is_string($uid) || !preg_match('/^[1-9][0-9]{0,19}$/D', $uid)) {
            $this->reply(false, 'bad_request', 400);
        }
        $pins = $this->pins();
        $found = 0;
        foreach (array_unique($uids) as $uid) {
            if (!$rc->get_storage()->get_message_headers($uid, $mbox)) continue;
            $found++;
            if ($pinned === '1') $pins[$mbox][$uid] = time();
            else unset($pins[$mbox][$uid]);
        }
        if (!$found) $this->reply(false, 'not_found', 404);
        if (empty($pins[$mbox])) unset($pins[$mbox]);
        // Keep stale folder/UID entries bounded without touching mail flags.
        $flat = [];
        foreach ($pins as $folder => $items) if (is_array($items)) {
            foreach ($items as $id => $time) if (preg_match('/^[1-9][0-9]{0,19}$/D', (string)$id)) {
                $flat[] = [$folder, (string)$id, (int)$time];
            }
        }
        usort($flat, static fn($a, $b) => $b[2] <=> $a[2]);
        $pins = [];
        foreach (array_slice($flat, 0, 500) as [$folder, $id, $time]) $pins[$folder][$id] = $time;
        $this->saving = true;
        try { $ok = $rc->user->save_prefs([self::PIN_KEY => $pins]); }
        finally { $this->saving = false; }
        if (!$ok) $this->reply(false, 'save_failed', 503);
        $this->reply(true, 'saved', 200, ['pins' => (object)$pins]);
    }

    private function snippets()
    {
        $mbox = $this->mail_request();
        $uids = json_decode((string)($_POST['_uids'] ?? ''), true);
        if (!is_array($uids) || !array_is_list($uids) || count($uids) < 1 || count($uids) > 12) {
            $this->reply(false, 'bad_request', 400);
        }
        foreach ($uids as $uid) if (!is_string($uid) || !preg_match('/^[1-9][0-9]{0,19}$/D', $uid)) {
            $this->reply(false, 'bad_request', 400);
        }
        $out = [];
        foreach (array_unique($uids) as $uid) {
            try {
                $mail = new rcube_message($uid, $mbox);
                if (!$mail->headers) continue;
                $body = $mail->first_text_part();
                $body = preg_replace('/\s+/u', ' ', strip_tags((string)$body));
                $out[$uid] = mb_substr(trim((string)$body), 0, 1400);
            } catch (Throwable $e) { $out[$uid] = ''; }
        }
        $this->reply(true, 'snippets', 200, ['snippets' => $out]);
    }

    private function tab()
    {
        $tab = $_POST['_tab'] ?? '';
        return is_string($tab) && preg_match('/^[a-f0-9]{32}$/D', $tab) ? $tab : false;
    }

    private function upload()
    {
        $tab = $this->tab();
        if (!$tab) $this->reply(false, 'bad_request', 400);
        if ($this->upload_error()) $this->reply(false, $this->upload_error(), 503);
        $file = $_FILES['image'] ?? null;
        $limit = (int) rcmail::get_instance()->config->get('theme_customizer_max_file', 10485760);
        if (!$file || in_array($file['error'] ?? 1, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || ($file['size'] ?? 0) > $limit) $this->reply(false, 'image_too_large', 400);
        if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) $this->reply(false, 'invalid_file', 400);
        $info = @getimagesize($file['tmp_name']);
        $types = [IMAGETYPE_JPEG => 'JPEG', IMAGETYPE_PNG => 'PNG', IMAGETYPE_WEBP => 'WEBP'];
        if (!$info || !isset($types[$info[2]]) || !in_array($types[$info[2]], $this->formats(), true)) $this->reply(false, 'invalid_file', 400);
        if ($info[2] === IMAGETYPE_PNG && $this->animated_png($file['tmp_name'])) $this->reply(false, 'invalid_file', 400);
        if ($info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > (int) rcmail::get_instance()->config->get('theme_customizer_max_pixels', 24000000)) $this->reply(false, 'image_too_large', 400);
        if ($info[0] * $info[1] * 12 > 384000000) $this->reply(false, 'image_too_large', 400);
        try {
            $im = new Imagick();
            $im->setResourceLimit(Imagick::RESOURCETYPE_MEMORY, 384);
            $im->setResourceLimit(Imagick::RESOURCETYPE_MAP, 384);
            $im->readImage($file['tmp_name']);
            if ($im->getNumberImages() !== 1 || strtoupper($im->getImageFormat()) !== $types[$info[2]]) throw new RuntimeException();
            if (method_exists($im, 'autoOrient')) $im->autoOrient();
            $im->setIteratorIndex(0);
            $im->thumbnailImage(2560, 2560, true, false);
            $im->setImageBackgroundColor('white');
            $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_REMOVE);
            $im->stripImage();
            $im->setImageFormat('JPEG'); $im->setImageCompressionQuality(85);
            $blob = $im->getImageBlob();
            $im->thumbnailImage(360, 220, true, false);
            $thumb = $im->getImageBlob();
            $im->clear();
        } catch (Throwable $e) { $this->reply(false, 'invalid_file', 400); }
        if (strlen($blob) > $limit) $this->reply(false, 'image_too_large', 400);
        $this->with_lock(function ($base) use ($tab, $blob, $thumb) {
            $index = $this->read_index($base);
            $this->cleanup($base, $index);
            $count = count($index['saved'] ?? []) + count($index['pending'] ?? []);
            $bytes = array_sum(array_column($index['saved'] ?? [], 'bytes')) + array_sum(array_column($index['pending'] ?? [], 'bytes'));
            $new_bytes = strlen($blob) + strlen($thumb);
            if ($count >= (int)rcmail::get_instance()->config->get('theme_customizer_max_images', 20) || $bytes + $new_bytes > (int)rcmail::get_instance()->config->get('theme_customizer_max_bytes', 104857600)) $this->reply(false, 'quota', 409);
            $id = 'u_' . bin2hex(random_bytes(16));
            if (@file_put_contents($base . '/' . $id . '.pending.jpg', $blob, LOCK_EX) === false || @file_put_contents($base . '/' . $id . '.pending.thumb.jpg', $thumb, LOCK_EX) === false) {
                @unlink($base . '/' . $id . '.pending.jpg');
                @unlink($base . '/' . $id . '.pending.thumb.jpg');
                $this->reply(false, 'storage_unavailable', 503);
            }
            @chmod($base . '/' . $id . '.pending.jpg', 0600);
            @chmod($base . '/' . $id . '.pending.thumb.jpg', 0600);
            $index['pending'][$id] = ['tab' => $tab, 'time' => time(), 'bytes' => $new_bytes];
            if (!$this->write_index($base, $index)) {
                @unlink($base . '/' . $id . '.pending.jpg');
                @unlink($base . '/' . $id . '.pending.thumb.jpg');
                $this->reply(false, 'storage_unavailable', 503);
            }
            $url = rcmail::get_instance()->url('plugin.theme_customizer.image') . '&_id=' . $id . '&_tab=' . $tab;
            $this->reply(true, 'uploaded', 200, ['image' => ['id' => $id, 'url' => $url, 'thumb' => $url . '&_thumb=1']]);
        });
    }

    private function animated_png($path)
    {
        $fp = @fopen($path, 'rb');
        if (!$fp) return true;
        try {
            if (fread($fp, 8) !== "\x89PNG\r\n\x1a\n") return true;
            for ($count = 0; $count < 1000; $count++) {
                $header = fread($fp, 8);
                if (strlen($header) !== 8) return true;
                $length = unpack('Nlength', substr($header, 0, 4))['length'];
                $type = substr($header, 4, 4);
                if ($type === 'acTL') return true;
                if ($type === 'IDAT') return false;
                if ($length > 10485760 || fseek($fp, $length + 4, SEEK_CUR) !== 0) return true;
            }
            return true;
        } finally { fclose($fp); }
    }

    private function cancel()
    {
        $tab = $this->tab();
        if (!$tab) $this->reply(false, 'bad_request', 400);
        $this->with_lock(function ($base) use ($tab) {
            $index = $this->read_index($base);
            foreach ($index['pending'] ?? [] as $id => $meta) if (($meta['tab'] ?? '') === $tab) {
                @unlink($base . '/' . $id . '.pending.jpg'); @unlink($base . '/' . $id . '.pending.thumb.jpg'); unset($index['pending'][$id]);
            }
            $this->write_index($base, $index);
            $this->reply(true, 'cancelled');
        });
    }

    private function touch()
    {
        $tab = $this->tab();
        if (!$tab) $this->reply(false, 'bad_request', 400);
        $this->with_lock(function ($base) use ($tab) {
            $index = $this->read_index($base);
            foreach ($index['pending'] as $id => $meta) {
                if (($meta['tab'] ?? '') === $tab) $index['pending'][$id]['time'] = time();
            }
            $this->write_index($base, $index);
            $this->reply(true, 'touched');
        });
    }

    private function cleanup($base, &$index)
    {
        $ttl = (int) rcmail::get_instance()->config->get('theme_customizer_pending_ttl', 86400);
        foreach ($index['pending'] ?? [] as $id => $meta) if (($meta['time'] ?? 0) < time() - $ttl) {
            @unlink($base . '/' . $id . '.pending.jpg'); @unlink($base . '/' . $id . '.pending.thumb.jpg'); unset($index['pending'][$id]);
        }
    }

    private function save()
    {
        $tab = $this->tab();
        $input = json_decode($_POST['_settings'] ?? '', true);
        $remove = json_decode($_POST['_remove'] ?? '', true);
        $discard = json_decode($_POST['_discard'] ?? '[]', true);
        if (!$tab || !is_array($input) || !is_array($remove) || !is_array($discard) || count($remove) > 20 || count($discard) > 20) $this->reply(false, 'bad_request', 400);
        if (!$this->ensure_base()) {
            if ($remove || $discard || str_starts_with((string)($input['background'] ?? ''), 'u_')
                || str_starts_with((string)($input['messageBackground'] ?? ''), 'u_')) $this->reply(false, 'storage_unavailable', 503);
            $this->save_without_storage($input);
        }
        $this->with_lock(function ($base) use ($tab, $input, $remove, $discard) {
            $index = $this->read_index($base);
            $this->cleanup($base, $index);
            $current = $this->settings();
            if (($input['rev'] ?? null) !== $current['rev']) $this->reply(false, 'conflict', 409, ['current' => $current]);
            foreach ($remove as $id) if (!is_string($id) || !preg_match('/^u_[a-f0-9]{32}$/D', $id) || !isset($index['saved'][$id])) $this->reply(false, 'bad_request', 400);
            foreach ($discard as $id) if (!is_string($id) || !preg_match('/^u_[a-f0-9]{32}$/D', $id) || !isset($index['pending'][$id]) || $index['pending'][$id]['tab'] !== $tab) $this->reply(false, 'bad_request', 400);
            $remove = array_values(array_unique($remove));
            foreach (['background','messageBackground'] as $key) {
                $id = $input[$key] ?? '';
                if (in_array($id, $remove, true)) $this->reply(false, 'background_deleted', 400);
                if (is_string($id) && isset($index['pending'][$id]) && $index['pending'][$id]['tab'] !== $tab) $this->reply(false, 'forbidden', 403);
            }
            $staged = [];
            foreach ($index['pending'] ?? [] as $pid => $meta) if (($meta['tab'] ?? '') === $tab) {
                if (in_array($pid, $discard, true)) continue;
                if (!@rename($base . '/' . $pid . '.pending.jpg', $base . '/' . $pid . '.jpg')) {
                    $this->rollback($base, $this->read_index($base), $staged);
                    $this->reply(false, 'storage_unavailable', 503);
                }
                if (!@rename($base . '/' . $pid . '.pending.thumb.jpg', $base . '/' . $pid . '.thumb.jpg')) {
                    @rename($base . '/' . $pid . '.jpg', $base . '/' . $pid . '.pending.jpg');
                    $this->rollback($base, $this->read_index($base), $staged);
                    $this->reply(false, 'storage_unavailable', 503);
                }
                $index['saved'][$pid] = ['bytes' => $meta['bytes']];
                unset($index['pending'][$pid]); $staged[] = $pid;
            }
            $original = $this->read_index($base);
            if (!$this->write_index($base, $index)) {
                $this->rollback($base, $original, $staged);
                $this->reply(false, 'storage_unavailable', 503);
            }
            $valid = $this->validate($input);
            if (!$valid) {
                $this->rollback($base, $original, $staged);
                $this->reply(false, 'invalid_settings', 400);
            }
            $valid['rev'] = bin2hex(random_bytes(16));
            $ok = $this->persist($valid);
            if (!$ok) {
                $this->rollback($base, $original, $staged);
                $this->reply(false, 'save_failed', 503);
            }
            foreach ($remove as $rid) {
                unset($index['saved'][$rid]);
                @unlink($base . '/' . $rid . '.jpg'); @unlink($base . '/' . $rid . '.thumb.jpg');
            }
            foreach ($discard as $did) {
                unset($index['pending'][$did]);
                @unlink($base . '/' . $did . '.pending.jpg'); @unlink($base . '/' . $did . '.pending.thumb.jpg');
            }
            $this->write_index($base, $index);
            $this->reply(true, 'saved', 200, ['settings' => $valid, 'images' => $this->gallery()]);
        });
    }

    private function persist($settings)
    {
        $this->saving = true;
        try { return rcmail::get_instance()->user->save_prefs([self::KEY => $settings]); }
        catch (Throwable $e) { return false; }
        finally { $this->saving = false; }
    }

    private function save_without_storage($input)
    {
        $lock = @fopen(sys_get_temp_dir() . '/theme_customizer-pref-u' . (int)rcmail::get_instance()->user->ID . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) $this->reply(false, 'save_failed', 503);
        try {
            $current = $this->settings();
            if (($input['rev'] ?? null) !== $current['rev']) $this->reply(false, 'conflict', 409, ['current' => $current]);
            $valid = $this->validate($input);
            if (!$valid) $this->reply(false, 'invalid_settings', 400);
            $valid['rev'] = bin2hex(random_bytes(16));
            if (!$this->persist($valid)) $this->reply(false, 'save_failed', 503);
            $this->reply(true, 'saved', 200, ['settings' => $valid, 'images' => []]);
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    private function rollback($base, $original, $staged)
    {
        foreach ($staged as $id) {
            @rename($base . '/' . $id . '.jpg', $base . '/' . $id . '.pending.jpg');
            @rename($base . '/' . $id . '.thumb.jpg', $base . '/' . $id . '.pending.thumb.jpg');
        }
        $this->write_index($base, $original);
    }

    public function image()
    {
        $rc = rcmail::get_instance();
        if (!$rc->user || !$rc->user->ID) { http_response_code(401); exit; }
        $id = $_GET['_id'] ?? '';
        if (!is_string($id) || !preg_match('/^u_[a-f0-9]{32}$/D', $id)) { http_response_code(404); exit; }
        $base = $this->base();
        if (!$base) { http_response_code(404); exit; }
        $index = $this->read_index($base);
        $tab = $_GET['_tab'] ?? '';
        $pending = isset($index['pending'][$id]) && is_string($tab) && $tab !== '' && hash_equals($index['pending'][$id]['tab'], $tab);
        if (!isset($index['saved'][$id]) && !$pending) { http_response_code(404); exit; }
        $suffix = $pending ? '.pending' : '';
        $file = $base . '/' . $id . $suffix . (!empty($_GET['_thumb']) ? '.thumb' : '') . '.jpg';
        if (!is_file($file)) { http_response_code(404); exit; }
        header('Content-Type: image/jpeg'); header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
        readfile($file); exit;
    }
}
