# Spirited Wines POS — PHP API (Apache + PHP 8.2).
# Runs the existing single-file API unchanged on any Docker host (Railway,
# Render, Fly, etc.). The app's api/.htaccess front-controls every request to
# index.php, so no extra routing config is needed.
FROM php:8.2-apache

# PDO MySQL driver (the app connects to MySQL via PDO) + Apache rewrite so
# .htaccess can route all paths to index.php.
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite \
    && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Copy the API source into the Apache web root.
COPY . /var/www/html/

# Hosting platforms inject $PORT; make Apache listen on it (default 8080).
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen ${PORT}/\" /etc/apache2/ports.conf && sed -i \"s/:80>/:${PORT}>/\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]
