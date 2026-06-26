<?php
// Basic configuration for database and security.
//
// Values are read from environment variables in production (e.g. Vercel project
// settings) and fall back to local XAMPP defaults for development, so running
// locally needs no env setup while production stays free of hardcoded secrets.

function env_str(string $key, string $default): string {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : $v;
}

function env_int(string $key, int $default): int {
    $v = getenv($key);
    return ($v === false || $v === '') ? $default : (int) $v;
}

$CONFIG = [
    'db' => [
        'host'    => env_str('DB_HOST', '127.0.0.1'),
        'name'    => env_str('DB_NAME', 'pos_project'),
        'user'    => env_str('DB_USER', 'root'),
        'pass'    => env_str('DB_PASS', ''),
        'port'    => env_int('DB_PORT', 3306),
        'charset' => env_str('DB_CHARSET', 'utf8mb4'),
        // Managed MySQL hosts (Aiven, Railway, TiDB, etc.) require TLS. Set DB_SSL=1.
        'ssl'     => env_str('DB_SSL', '0') === '1',
        // Optional path to a CA bundle (.pem). Leave empty to use TLS without
        // strict server-cert verification.
        'ssl_ca'  => env_str('DB_SSL_CA', ''),
    ],
    'security' => [
        // MUST be overridden in production via the TOKEN_SECRET env var.
        'token_secret'    => env_str('TOKEN_SECRET', 'change-this-secret-please'),
        'token_ttl_hours' => env_int('TOKEN_TTL_HOURS', 168), // 7 days
    ],
    'cors' => [
        // Comma-separated allowlist of allowed origins, e.g.
        // "https://your-app.vercel.app,https://www.yourdomain.com".
        // Default "*" reflects the request origin (fine for local dev and
        // same-origin deploys).
        'allowed_origins' => env_str('ALLOWED_ORIGINS', '*'),
    ],
];
