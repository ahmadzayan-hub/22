FROM node:20-alpine
RUN apk add --no-cache tmux
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
