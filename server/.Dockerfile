FROM node:20.18.0-alpine3.20 AS base
RUN addgroup -S user -g 1001 \
  && adduser -S -G user -u 1001 user

RUN apk add --no-cache \
  # git to pull repo for kubera
  git

WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.json tsconfig.json
COPY src src
RUN chmod -R 777 /var/log

FROM base AS prod
RUN chown -R user:user /app
USER user:user

WORKDIR /app
RUN npm ci
RUN npm run build && npm prune --production
CMD ["npm", "run", "prod"]
