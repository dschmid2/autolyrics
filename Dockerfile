# --- Build-Stufe: bündelt Frontend (React) und CSS -------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Buildnummer und Commit kommen aus der GitHub Action (siehe .github/workflows/docker-image.yml).
# Ohne diese Build-Args entsteht eine Version "<major>.<minor>.0-dev".
ARG APP_BUILD_NUMBER=
ARG GIT_SHA=
RUN APP_BUILD_NUMBER="$APP_BUILD_NUMBER" GIT_SHA="$GIT_SHA" npm run build

# --- Laufzeit-Stufe: nur das, was der Server zur Laufzeit braucht ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY shared ./shared
COPY --from=build /app/public ./public

VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server/index.js"]
