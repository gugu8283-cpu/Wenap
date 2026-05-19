FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV SERVE_DIST=1
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server.cjs ./
COPY db ./db
COPY jobs ./jobs
COPY lib ./lib
COPY routes ./routes
COPY middleware ./middleware
COPY scripts/createTestAccounts.cjs ./scripts/createTestAccounts.cjs
RUN mkdir -p data
EXPOSE 3002
VOLUME ["/app/data"]
CMD ["node", "server.cjs"]
