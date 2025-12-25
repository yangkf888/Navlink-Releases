# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Build Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build

# Runtime Stage
FROM node:20-alpine

WORKDIR /app/backend

# 2. Setup Backend (Production only)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# 3. Copy Backend Code (ignore node_modules via .dockerignore or selective copy)
COPY backend/ ./

# 4. Copy Built Frontend Assets from Builder
# Must match server.js path: path.join(__dirname, '../frontend/dist')
COPY --from=builder /app/frontend/dist /app/frontend/dist
# Also copy index.html if it's not in dist (Vite puts everything in dist)
# Note: If backend serves static files, ensure it points to correct location.
# Based on project structure, backend likely serves 'public' or similar. 
# Let's assume standard Vite output.

# Create data directories
RUN mkdir -p data uploads

ENV NODE_ENV=production
ENV PORT=3010

EXPOSE 3010

CMD ["node", "server.js"]
