# Spirited Wines POS — PHP API (Apache + PHP 8.2).
# Runs the existing single-file API unchanged on any Docker host (Railway,
# Render, Fly, etc.). The app's api/.htaccess front-controls every request to
# index.php, so no extra routing config is needed.
FROM php:8.2-apache

# PDO MySQL driver + Apache rewrite (for .htaccess) + allow .htaccess overrides.
# ServerName silences the startup warning. A startup script binds Apache to the
# platform-provided $PORT at runtime.
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite \
    && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Apache needs exactly one MPM; the base image can end up with both prefork and
# event enabled ("More than one MPM loaded"). Force prefork (required by mod_php).
RUN a2dismod mpm_event mpm_worker 2>/dev/null; a2enmod mpm_prefork

# Copy the API source into the Apache web root.
COPY . /var/www/html/

# Entry script: rewrite Apache's port to $PORT (default 8080) then run Apache.
RUN printf '#!/bin/sh\nset -e\nPORT="${PORT:-8080}"\nsed -i "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf\nsed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf\nexec apache2-foreground\n' > /usr/local/bin/start.sh \
    && chmod +x /usr/local/bin/start.sh

ENV PORT=8080
EXPOSE 8080
CMD ["/usr/local/bin/start.sh"]
