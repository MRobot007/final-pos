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

    $pdo = new PDO($dsn, $CONFIG['db']['user'], $CONFIG['db']['pass'], $options);

    // Some managed MySQL providers (e.g. Aiven) enable ANSI_QUOTES, under which
    // "..." is an identifier rather than a string literal. The app's bootstrap
    // DDL and queries use double-quoted string values (written against MariaDB's
    // default mode), so drop ANSI_QUOTES for the session to keep them valid.
    try {
        $pdo->exec("SET SESSION sql_mode = REPLACE(@@SESSION.sql_mode, 'ANSI_QUOTES', '')");
    } catch (Throwable $e) {
        // Non-fatal: if sql_mode can't be adjusted, continue with the default.
    }

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
