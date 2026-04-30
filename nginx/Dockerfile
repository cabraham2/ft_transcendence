FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-cert.sh /docker-entrypoint.d/40-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/40-generate-cert.sh
