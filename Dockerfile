# Color Palette Maker — Node + Python (OpenCV required for region detection)
FROM node:20-slim

# Install Python and OpenCV runtime deps (required for region detection)
# libgl1, libglib2.0 needed for cv2 import in slim images
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* client/

# Install Node deps (root + client)
RUN npm install && cd client && npm install && cd ..

# Install Python deps (required for region detection). --break-system-packages needed for PEP 668 on Debian Bookworm.
# Symlink python/pip for tools that expect those names
COPY requirements.txt ./
RUN ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null || true \
    && ln -sf /usr/bin/pip3 /usr/bin/pip 2>/dev/null || true \
    && pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy app source
COPY . .

# Build React app
RUN npm run build

EXPOSE 3000

# Run with python3 on PATH (region detection); skip venv wrapper in container
# Override PORT at runtime if needed (e.g. -e PORT=8080)
ENV DETECT_REGIONS_PYTHON=python3
ENV PORT=3000
CMD ["node", "server.js"]
