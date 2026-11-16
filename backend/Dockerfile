FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
# The official node image ships a non-root user.
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
