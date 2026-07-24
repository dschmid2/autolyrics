# --- Build-Stufe: bündelt Frontend (React) und CSS -------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- Laufzeit-Stufe: nur das, was der Server zur Laufzeit braucht ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY --from=build /app/public ./public

VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server/index.js"]
