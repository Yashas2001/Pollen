# Pollen on Render (or any Docker host). Playwright's image brings Chrome and the system
# libraries both Playwright (site screenshots) and Remotion (video renders) need.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

# ffmpeg/ffprobe: footage prep, screenshot crops, voice cuts.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Remotion's own headless Chrome, fetched at build time instead of on the first render.
RUN npx remotion browser ensure
# Remotion bundle + Next build. NEXT_PUBLIC_* values come from .env.production.
RUN npm run build

ENV NODE_ENV=production
# Jobs, users, links and clicks live in /app/data: mount a persistent disk there.
RUN mkdir -p /app/data
EXPOSE 10000
CMD ["npm", "start"]
