# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY @types ./@types
RUN npm run build && npm prune --production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=prod
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
# The default LOG_DIR is /var/log/chat-app; create it writable by the non-root
# runtime user so winston's file transport works without an env override.
RUN mkdir -p /var/log/chat-app && chown -R node:node /var/log/chat-app
USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
