FROM nginxinc/nginx-unprivileged:1.29.8-alpine3.23-slim@sha256:59678856b05324b7f6371f26eb1520be7fcd8bdc8ab380fc4913db8503e5a842
USER root
RUN apk add --no-cache tini
COPY docker/hosted/front/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/hosted/paused.html /usr/share/nginx/html/paused.html
# HOSTED_VIDEO_URL must exist (empty by default): the entrypoint only substitutes variables that are defined.
ENV HOSTED_VIDEO_URL=
ENV NGINX_ENVSUBST_FILTER="VM_UPSTREAM|HOSTED_VIDEO_URL"
USER 101:101
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
