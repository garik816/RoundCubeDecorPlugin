<?php
// Run each case in its own CLI process; plugin JSON replies intentionally exit.
if (PHP_SAPI !== 'cli') exit(1);
class rcube_plugin {}
class FakeDB {
    public array $prefs = [];
    public function table_name($name, $quoted = false) { return $name; }
    public function query($sql, $id) { return ['preferences' => serialize($this->prefs[$id] ?? [])]; }
    public function fetch_assoc($row) { return $row; }
}
class FakeStorage {
    public function get_message_headers($uid, $folder) { return $uid === '901' && $folder === 'INBOX' ? (object)['uid' => $uid] : false; }
    public function get_body($uid) { return '<p>Резервний початок листа.</p>'; }
}
class FakeUser {
    public int $ID = 7;
    public function __construct(private FakeDB $db) {}
    public function save_prefs($items) { $this->db->prefs[$this->ID] = $items + ($this->db->prefs[$this->ID] ?? []); return true; }
}
class rcmail {
    public static self $instance;
    public FakeUser $user;
    private FakeDB $db;
    private FakeStorage $storage;
    public function __construct() { $this->db = new FakeDB(); $this->storage = new FakeStorage(); $this->user = new FakeUser($this->db); }
    public static function get_instance() { return self::$instance; }
    public function get_dbh() { return $this->db; }
    public function get_storage() { return $this->storage; }
    public function get_request_token() { return 'fixture-token'; }
    public function check_request() { return true; }
}
class rcube_message {
    public $headers;
    public function __construct($uid, $folder) { $this->headers = $uid === '901' && $folder === 'INBOX' ? (object)['uid' => $uid] : false; }
    public function first_text_part() { return ($_POST['_fallback'] ?? '') === '1' ? '' : 'Початок <b>листа</b> та наступний рядок.'; }
}
require dirname(__DIR__) . '/theme_customizer.php';
rcmail::$instance = new rcmail();
$_SERVER['REQUEST_METHOD'] = 'POST';
$_POST = ['_token' => 'fixture-token', '_mbox' => 'INBOX', '_uids' => '["901"]'];
switch ($argv[1] ?? '') {
    case 'pin': $_POST['_op'] = 'pin'; $_POST['_pinned'] = '1'; break;
    case 'unpin': $_POST['_op'] = 'pin'; $_POST['_pinned'] = '0'; break;
    case 'snippets': $_POST['_op'] = 'snippets'; break;
    case 'snippets_fallback': $_POST['_op'] = 'snippets'; $_POST['_fallback'] = '1'; break;
    case 'invalid': $_POST['_op'] = 'pin'; $_POST['_pinned'] = '1'; $_POST['_uids'] = '["../901"]'; break;
    default: exit(2);
}
(new theme_customizer())->api();
