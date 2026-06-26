# Spirited Wines POS — PHP API.
# Runs the existing single-file API exactly like local dev: PHP's built-in
# server in front of the app's router.php front-controller. No Apache (its base
# image had an unresolvable "More than one MPM loaded" config conflict), so no
# MPM / .htaccess complications.
FROM php:8.2-cli

# MySQL PDO driver — the app connects to MySQL via PDO.
RUN docker-php-ext-install pdo pdo_mysql

WORKDIR /var/www/html
COPY . /var/www/html/

# Serve through router.php (same front-controller used in local dev). Bind to
# the platform-provided $PORT, defaulting to 8080.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} router.php"]
