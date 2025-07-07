# Custom Dockerfile for Railway deployment with FFmpeg
FROM node:22-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no cache to avoid conflicts)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Railway will override this)
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 