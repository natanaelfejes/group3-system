# web

React + TypeScript frontend, built with Vite. Needs Node 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:5173, /api is proxied to the backend on port 3000
npm run build    # type-check and build into dist/
npm run lint
```

`docker compose up --build` from the repo root serves the built app with nginx on http://localhost:8081.
