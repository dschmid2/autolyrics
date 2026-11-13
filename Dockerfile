# Die Stufen "build" und "deps" laufen immer auf der Plattform des Build-Rechners
# ($BUILDPLATFORM), nicht emuliert. Ihr Ergebnis (gebündeltes Frontend bzw. reine
# JavaScript-Pakete) ist plattformunabhängig. So wird im Multi-Arch-Build (amd64 +
# arm64) kein Befehl unter QEMU ausgeführt: Node stürzt dort bei "npm install" ab
# ("qemu: uncaught target signal 4 (Illegal instruction)").

# --- Build-Stufe: bündelt Frontend (React) und CSS -------------------------
FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# Buildnummer und Commit kommen aus der GitHub Action (siehe .github/workflows/docker-image.yml).
# Ohne diese Build-Args entsteht eine Version "<major>.<minor>.0-dev".
ARG APP_BUILD_NUMBER=
ARG GIT_SHA=
RUN APP_BUILD_NUMBER="$APP_BUILD_NUMBER" GIT_SHA="$GIT_SHA" npm run build

# --- Abhängigkeiten zur Laufzeit (ohne Dev-Pakete) --------------------------
# Nur reine JavaScript-Pakete. Kommt je ein Paket mit nativem Code dazu, muss
# es wieder in der Laufzeit-Stufe für die Zielplattform installiert werden.
FROM --platform=$BUILDPLATFORM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# --- Laufzeit-Stufe: nur das, was der Server zur Laufzeit braucht ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

# Keine RUN-Befehle in dieser Stufe (sie würden für arm64 unter QEMU laufen)
COPY package.json package-lock.json* ./
COPY --from=deps /app/node_modules ./node_modules

COPY server ./server
COPY shared ./shared
COPY --from=build /app/public ./public

VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server/index.js"]
