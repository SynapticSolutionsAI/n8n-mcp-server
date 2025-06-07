FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

USER node

EXPOSE 3000

CMD ["sh", "-c", "node build/index.js"]
