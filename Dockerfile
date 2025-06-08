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

# Change ownership of the app directory to node user
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "build/index.js"]
