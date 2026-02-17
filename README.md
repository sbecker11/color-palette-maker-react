# Color Palette Maker (React)

<a href="https://github.com/sbecker11/color-palette-maker-react/releases/download/v1.0.0/gold-blue-2.gif">
  <img src="https://github.com/sbecker11/color-palette-maker-react/releases/download/v1.0.0/gold-2.gif" width="67%" alt="gold" />
</a>

A React + Node.js app for extracting and managing color palettes from images.
Upload via URL or file, extract dominant colors with K-means clustering,
detect image regions with OpenCV, and export palettes as JSON.

## Tech Stack

- **Frontend**: React 19, Vite 5
- **Backend**: Node.js, Express
- **Image Processing**: Sharp, node-kmeans, get-pixels, color-diff (CIEDE2000)
- **Region Detection**: Python 3, OpenCV, NumPy
- **Testing**: Vitest, React Testing Library, happy-dom

## Quick Start

```bash
npm install
cd client && npm install && cd ..
npm run dev
```

Opens at http://localhost:5173 (Vite dev server) with API at http://localhost:3000.

For region detection, also install Python dependencies:

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

## Documentation

| Doc | Description |
|-----|-------------|
| [Changelog](CHANGELOG.md) | Version history and release notes |
| [User Guide](docs/USER_GUIDE.md) | Features, key actions, color sampling, region workflow |
| [API Reference](docs/API.md) | REST endpoints, request/response formats |
| [Architecture](docs/ARCHITECTURE.md) | Region & palette pipeline, data flow, storage format |
| [Development](docs/DEVELOPMENT.md) | Setup, build, test, Docker, project structure |
| [Future Work](docs/FUTURE-WORK.md) | Improvement backlog, SPA/SaaS migration outlines |
| [Single-User SPA → Docker Compose](docs/Single-User-SPA-DockerCompose-migration.md) | Multi-service orchestration outline |
| [Multi-User SaaS → Kubernetes](docs/Multi-User-SaaS-Kubernetes-migration.md) | Kubernetes migration outline |

## License

MIT
