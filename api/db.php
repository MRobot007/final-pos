<?php
require_once __DIR__ . '/config.php';

function get_db(): PDO {
    global $CONFIG;
    static $pdo = null;
    if ($pdo) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $CONFIG['db']['host'],
        $CONFIG['db']['port'],
        $CONFIG['db']['name'],
        $CONFIG['db']['charset']
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Reuse the DB connection across requests. The PHP built-in server is a
        // single long-lived process, so a persistent connection avoids a fresh
        // TCP+TLS handshake to the (possibly cross-region) managed MySQL on every
        // request — the dominant cost of each API call.
        PDO::ATTR_PERSISTENT => true,
        // Apply the SQL mode at connect time (once per persistent connection)
        // instead of issuing a SET on every request — saves one DB round-trip
        // per API call. See the ANSI_QUOTES note below for why this is needed.
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET SESSION sql_mode = ''",
    ];

    // Managed MySQL providers (Aiven, Railway, TiDB, etc.) require a TLS
    // connection. Enable it with DB_SSL=1; supply DB_SSL_CA to verify the
    // server certificate, otherwise connect over TLS without strict verify.
    if (!empty($CONFIG['db']['ssl'])) {
        if (!empty($CONFIG['db']['ssl_ca'])) {
            $options[PDO::MYSQL_ATTR_SSL_CA] = $CONFIG['db']['ssl_ca'];
        } else {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }
    }

    // This app was written against MariaDB's permissive default SQL mode. Managed
    // MySQL 8 (e.g. Aiven) ships stricter modes — notably ANSI_QUOTES (which makes
    // the app's double-quoted string literals fail) and ONLY_FULL_GROUP_BY. The
    // MYSQL_ATTR_INIT_COMMAND above clears sql_mode at connect time.
    $pdo = new PDO($dsn, $CONFIG['db']['user'], $CONFIG['db']['pass'], $options);

    return $pdo;
}

function pdo_try(callable $fn) {
    try {
        return $fn();
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error', 'detail' => $e->getMessage()]);
        exit;
    }
}
