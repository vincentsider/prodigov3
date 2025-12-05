FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Expose port (Railway will override PORT env var)
EXPOSE 3000

# Create volume mount point
RUN mkdir -p /data/uploads

# Set environment variables
ENV NODE_ENV=production
ENV RAILWAY_VOLUME_MOUNT_PATH=/data/uploads

CMD ["node", "dist/server.js"]
