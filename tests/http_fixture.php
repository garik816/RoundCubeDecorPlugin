<?php
// Local-only HTTP fixture. Start with PHP's built-in server in an isolated container.
// Test identity is supplied by X-Test-User solely for this fixture.
if (PHP_SAPI !== 'cli-server' || getenv('TC_TEST_FIXTURE') !== '1') { http_response_code(404); exit; }
error_reporting(E_ALL);
class rcube_plugin { public $ID = 'theme_customizer'; }
class FixtureConfig
{
    public function get($key, $default = null)
    {
        if ($key === 'theme_customizer_storage') return isset($_SERVER['HTTP_X_TEST_NO_STORAGE']) ? '' : '/tmp/theme-customizer-http';
        if ($key === 'theme_customizer_max_images' && isset($_SERVER['HTTP_X_TEST_MAX_IMAGES'])) return (int)$_SERVER['HTTP_X_TEST_MAX_IMAGES'];
        if ($key === 'theme_customizer_max_file' && isset($_SERVER['HTTP_X_TEST_MAX_FILE'])) return (int)$_SERVER['HTTP_X_TEST_MAX_FILE'];
        return $default;
    }
}
class FixtureDB
{
    public function table_name($name, $quote = false) { return $name; }
    public function query($sql, $id)
    {
        $all = json_decode((string)@file_get_contents('/tmp/theme-customizer-http-prefs.json'), true) ?: [];
        return ['preferences' => serialize($all[$id] ?? ['keep_other_plugin' => 42])];
    }
    public function fetch_assoc($row) { return $row; }
}
class FixtureUser
{
    public $ID;
    public function __construct($id) { $this->ID = $id; }
    public function save_prefs($prefs)
    {
        $file = '/tmp/theme-customizer-http-prefs.json';
        $all = json_decode((string)@file_get_contents($file), true) ?: [];
        $all[$this->ID] = $prefs + ($all[$this->ID] ?? ['keep_other_plugin' => 42]);
        return file_put_contents($file, json_encode($all), LOCK_EX) !== false;
    }
}
class rcmail
{
    private static $instance;
    public $user;
    public $config;
    public function __construct()
    {
        if (!is_dir('/tmp/theme-customizer-http')) mkdir('/tmp/theme-customizer-http', 0700);
        $id = (int)($_SERVER['HTTP_X_TEST_USER'] ?? 1);
        $this->user = $id > 0 ? new FixtureUser($id) : null;
        $this->config = new FixtureConfig();
    }
    public static function get_instance() { return self::$instance ??= new self(); }
    public function get_dbh() { return new FixtureDB(); }
    public function get_request_token() { return 'fixture-token'; }
    public function check_request() { return ($_POST['_token'] ?? '') === 'fixture-token'; }
    public function url($action, $absolute = false) { return '/?op=image'; }
}
require dirname(__DIR__) . '/theme_customizer.php';
$plugin = new theme_customizer();
if (($_GET['op'] ?? '') === 'image') $plugin->image();
$plugin->api();
