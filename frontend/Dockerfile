FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.js ./
COPY src/ ./src/
COPY public/ ./public/
ARG VITE_API_BASE_URL=http://localhost:8000/api
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build

FROM nginx:stable-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
