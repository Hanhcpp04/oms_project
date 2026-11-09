#!/bin/sh

# Extract Google Client ID from environment variables
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-$NG_APP_GOOGLE_CLIENT_ID}

# Generate env.js dynamically in Nginx root
echo "window.__OMS_ENV__ = Object.freeze({" > /usr/share/nginx/html/env.js
echo "  googleClientId: \"$GOOGLE_CLIENT_ID\"" >> /usr/share/nginx/html/env.js
echo "});" >> /usr/share/nginx/html/env.js

echo "Generated /usr/share/nginx/html/env.js"

# Run Nginx
exec "$@"
