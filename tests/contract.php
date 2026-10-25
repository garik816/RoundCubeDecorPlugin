<?php
// Isolated contract tests for the plugin's server-side rules. No production data is used.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
error_reporting(E_ALL);

class rcube_plugin
{
    public $ID = 'theme_customizer';
    public $buttons = [];
    public $actions = [];
    public function load_config() {}
    public function add_texts($path, $client) {}
    public function register_action($name, $callback) { $this->actions[] = $name; }
    public function add_hook($name, $callback) {}
    public function include_stylesheet($path) {}
    public function include_script($path) {}
    public function add_button($data, $container) { $this->buttons[] = [$data, $container]; }
    public function url($path) { return '/plugins/theme_customizer/' . $path; }
}

class FakeConfig
{
    public $data = [];
    public function get($key, $default = null) { return $this->data[$key] ?? $default; }
    public function set($key, $value) { $this->data[$key] = $value; }
}
class FakeDB
{
    public $prefs = [];
    public function table_name($table, $quoted = false) { return $table; }
    public function query($sql, $id) { return ['preferences' => serialize($this->prefs[$id] ?? [])]; }
    public function fetch_assoc($value) { return $value; }
}
class FakeOutput
{
    public $type = 'html';
    public $env = [];
    public $labels = [];
    public function set_env($key, $value) { $this->env[$key] = $value; }
    public function asset_url($path) { return 'static.php/' . ltrim($path, '/'); }
    public function add_label($name) { $this->labels[] = $name; }
}
class rcmail
{
    public static $instance;
    public $user;
    public $config;
    public $output;
    public $db;
    public $texts = [];
    public function __construct()
    {
        $this->user = (object)['ID' => 10];
        $this->config = new FakeConfig();
        $this->output = new FakeOutput();
        $this->db = new FakeDB();
    }
    public static function get_instance() { return self::$instance; }
    public function get_dbh() { return $this->db; }
    public function url($action, $absolute = false) { return '/?_task=mail&_action=' . $action; }
    public function gettext($name, $domain = null)
    {
        $labels = [];
        require dirname(__DIR__) . '/localization/uk_UA.inc';
        return $labels[$name] ?? '[' . $name . ']';
    }
    public function load_language($lang = null, $add = [], $merge = []) { $this->texts = array_merge($this->texts, $merge); }
}

require dirname(__DIR__) . '/theme_customizer.php';

function callPrivate($object, $method, ...$args)
{
    return (new ReflectionMethod($object, $method))->invoke($object, ...$args);
}
function check($condition, $name)
{
    if (!$condition) throw new RuntimeException($name);
    echo "OK: {$name}\n";
}

$base = sys_get_temp_dir() . '/tc-contract-' . bin2hex(random_bytes(6));
mkdir($base, 0700);
$rc = rcmail::$instance = new rcmail();
$rc->config->data = ['skin' => 'elastic', 'theme_customizer_storage' => $base];
$plugin = new theme_customizer();
$rc->config->data['theme_customizer_storage'] = $base . '/missing';
check(callPrivate($plugin, 'base') === false, 'missing storage root is not created inside an arbitrary path');
$rc->config->data['theme_customizer_storage'] = $base;
$plugin->init();
$plugin->init();
check(count($plugin->buttons) === 1 && $plugin->buttons[0][1] === 'taskbar', 'one navigation button after repeated init');
check($rc->config->get('skin_logo')['elastic:*'] === '/plugins/theme_customizer/assets/logoB.png', 'Elastic uses bundled Textmediary logo');
check(count($plugin->actions) === 2, 'private API and image actions registered');
check(count($rc->output->env['theme_customizer']['presets']) === 7, 'seven presets loaded from manifest');
check(str_starts_with($rc->output->env['theme_customizer']['builtins']['sea']['full'], 'static.php/plugins/'), 'built-in images use Roundcube static route');
$json_plugin = new theme_customizer();
$rc->output = new FakeOutput();
$rc->output->type = 'json';
$json_plugin->init();
check(count($json_plugin->actions) === 2 && count($json_plugin->buttons) === 0 && !$rc->output->env, 'JSON requests register actions without HTML assets');
$rc->output = new FakeOutput();

$defaults = callPrivate($plugin, 'defaults');
check(callPrivate($plugin, 'validate', $defaults) === $defaults, 'default settings accepted');
check($defaults['messageMode'] === 'theme' && $defaults['messageSurface'] === 94, 'message area defaults to theme background');
check($defaults['messageBodyMode'] === 'original', 'existing message bodies keep sender styling by default');
check($defaults['mailView'] === 'single', 'mail defaults to list then full message');
check($defaults['brightness'] === 100, 'existing wallpapers keep their brightness by default');
foreach ([100, 180] as $brightness) {
    $candidate = $defaults; $candidate['brightness'] = $brightness;
    check(callPrivate($plugin, 'validate', $candidate) !== false, $brightness . '% wallpaper brightness accepted');
}
foreach ([99, 181] as $brightness) {
    $candidate = $defaults; $candidate['brightness'] = $brightness;
    check(callPrivate($plugin, 'validate', $candidate) === false, $brightness . '% wallpaper brightness rejected');
}
foreach (['single', 'split'] as $view) {
    $candidate = $defaults; $candidate['mailView'] = $view;
    check(callPrivate($plugin, 'validate', $candidate) !== false, $view . ' mail layout accepted');
}
foreach ([10, 100] as $surface) {
    $candidate = $defaults; $candidate['surface'] = $surface;
    check(callPrivate($plugin, 'validate', $candidate) !== false, $surface . '% panel opacity accepted');
}
foreach (['mode' => 'evil', 'background' => '../../config', 'accent' => 'red', 'surface' => 0, 'density' => 'huge', 'radius' => 25, 'mailView' => 'empty'] as $key => $bad) {
    $candidate = $defaults; $candidate[$key] = $bad;
    check(callPrivate($plugin, 'validate', $candidate) === false, 'invalid ' . $key . ' rejected');
}
foreach ([9, 101] as $surface) {
    $candidate = $defaults; $candidate['surface'] = $surface;
    check(callPrivate($plugin, 'validate', $candidate) === false, $surface . '% panel opacity rejected');
}
foreach (['messageMode' => 'other', 'messageBackground' => '../../config', 'messageFill' => 'white',
    'messageSurface' => 9, 'messageFit' => 'stretch', 'messagePosition' => 'corner',
    'messageBodyMode' => 'script', 'messageBodyFill' => 'url(javascript:evil)'] as $key => $bad) {
    $candidate = $defaults; $candidate[$key] = $bad;
    check(callPrivate($plugin, 'validate', $candidate) === false, 'invalid ' . $key . ' rejected');
}
$candidate = $defaults; $candidate['messageMode'] = 'custom'; $candidate['messageBackground'] = 'sea';
$candidate['messageSurface'] = 10;
check(callPrivate($plugin, 'validate', $candidate) !== false, 'separate message image and 10% opacity accepted');
$candidate = $defaults; $candidate['messageBodyMode'] = 'custom'; $candidate['messageBodyFill'] = '#182632';
check(callPrivate($plugin, 'validate', $candidate) !== false, 'custom message body color accepted');

$id = 'u_' . str_repeat('a', 32);
mkdir($base . '/u10', 0700);
file_put_contents($base . '/u10/' . $id . '.jpg', 'owned image');
file_put_contents($base . '/u10/index.json', json_encode(['saved' => [$id => ['bytes' => 11]], 'pending' => []]));
$candidate = $defaults; $candidate['background'] = $id;
check(callPrivate($plugin, 'validate', $candidate) !== false, 'owned personal image accepted');
$candidate = $defaults; $candidate['messageMode'] = 'custom'; $candidate['messageBackground'] = $id;
check(callPrivate($plugin, 'validate', $candidate) !== false, 'owned personal message image accepted');
check(count(callPrivate($plugin, 'gallery')) === 1, 'owned image appears in gallery');
$old = 'u_' . str_repeat('c', 32);
$fresh = 'u_' . str_repeat('d', 32);
file_put_contents($base . '/u10/' . $old . '.pending.jpg', 'expired');
file_put_contents($base . '/u10/' . $old . '.pending.thumb.jpg', 'expired');
file_put_contents($base . '/u10/' . $fresh . '.pending.jpg', 'active');
file_put_contents($base . '/u10/' . $fresh . '.pending.thumb.jpg', 'active');
file_put_contents($base . '/u10/index.json', json_encode(['saved' => [$id => ['bytes' => 11]], 'pending' => [
    $old => ['tab' => str_repeat('c', 32), 'time' => time() - 90000, 'bytes' => 14],
    $fresh => ['tab' => str_repeat('d', 32), 'time' => time(), 'bytes' => 12],
]]));
callPrivate($plugin, 'cleanup_expired_on_page');
$index = json_decode(file_get_contents($base . '/u10/index.json'), true);
check(!isset($index['pending'][$old]) && isset($index['pending'][$fresh]), 'expired upload removed and active other tab preserved');
check(!is_file($base . '/u10/' . $old . '.pending.jpg') && is_file($base . '/u10/' . $fresh . '.pending.jpg'), 'cleanup only removes expired files');
$rc->user->ID = 11;
check(callPrivate($plugin, 'validate', $candidate) === false, 'other user image rejected');
check(count(callPrivate($plugin, 'gallery')) === 0, 'other user gallery isolated');

$rc->user->ID = 10;
$deleted = $defaults; $deleted['background'] = 'u_' . str_repeat('b', 32); $deleted['preset'] = 'custom';
$deleted['messageMode'] = 'custom'; $deleted['messageBackground'] = 'u_' . str_repeat('b', 32);
$rc->db->prefs[10] = ['language' => 'ru_RU', 'another_plugin' => ['keep' => true], 'theme_customizer' => $deleted];
$safe = callPrivate($plugin, 'settings');
check($safe['background'] === 'none' && $safe['messageBackground'] === 'none' && $safe['rev'] === '',
    'missing images fall back without breaking preferences');
$legacy = $defaults; unset($legacy['messageMode'], $legacy['messageBackground'], $legacy['messageFill'],
    $legacy['messageSurface'], $legacy['messageFit'], $legacy['messagePosition'],
    $legacy['messageBodyMode'], $legacy['messageBodyFill'], $legacy['brightness']);
$legacy['surface'] = 38;
$rc->db->prefs[10]['theme_customizer'] = $legacy;
$safe = callPrivate($plugin, 'settings');
check($safe['messageMode'] === 'theme' && $safe['messageSurface'] === 38 && $safe['messageBodyMode'] === 'original',
    'existing settings migrate without recoloring message bodies');
check($safe['brightness'] === 100, 'existing settings gain neutral wallpaper brightness');
$saving = new ReflectionProperty($plugin, 'saving'); $saving->setValue($plugin, true);
$hook = $plugin->fresh_preferences(['old' => ['stale' => true]]);
check(isset($hook['old']['another_plugin']) && !isset($hook['old']['stale']), 'save merges fresh unrelated preferences');

$unsupported = new theme_customizer();
$rc->config->data['skin'] = 'larry';
$unsupported->init();
check(count($unsupported->buttons) === 0, 'unsupported skin stays untouched');

$guest = rcmail::$instance = new rcmail();
$guest->user = null;
$guest->config->data = ['skin' => 'elastic'];
$guest_plugin = new theme_customizer();
$guest_plugin->init();
check($guest->config->get('skin_logo')['elastic:*'] === '/plugins/theme_customizer/assets/logoB.png', 'login page gets Textmediary logo');
check(count($guest_plugin->buttons) === 0 && count($guest_plugin->actions) === 0, 'guest gets no appearance actions');

$_SESSION['language'] = 'uk_UA';
$uk = rcmail::$instance = new rcmail();
$uk->config->data = ['skin' => 'elastic', 'theme_customizer_storage' => $base];
$uk_plugin = new theme_customizer();
$uk_plugin->init();
check(($uk->texts['notsentwarning'] ?? null) === 'Лист ще не надіслано й містить незбережені зміни. Відкинути ці зміни?'
    && in_array('notsentwarning', $uk->output->labels, true), 'Ukrainian unsaved-compose warning overrides English fallback in client labels');
unset($_SESSION['language']);

@unlink($base . '/u10/' . $id . '.jpg');
@unlink($base . '/u10/' . $fresh . '.pending.jpg');
@unlink($base . '/u10/' . $fresh . '.pending.thumb.jpg');
@unlink($base . '/u10/index.json');
@unlink($base . '/u10/.lock');
@rmdir($base . '/u10');
@rmdir($base);
