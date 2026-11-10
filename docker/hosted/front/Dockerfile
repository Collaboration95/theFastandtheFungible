FROM nginxinc/nginx-unprivileged:1.29.8-alpine3.23-slim
USER root
RUN apk add --no-cache tini
COPY docker/hosted/front/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/hosted/paused.html /usr/share/nginx/html/paused.html
ENV NGINX_ENVSUBST_FILTER=VM_UPSTREAM
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
