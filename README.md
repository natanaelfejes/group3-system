# group3-system

Part of the Group 3 semester project: a management system for Linak motorized desks (distributed system with embedded elements).

Web app and API for the desk system. The Pico W firmware (C++) lives in its own repo.

Stack: React + TypeScript (Vite) in `web/`, Node + Express in `backend/`, PostgreSQL on Supabase, Docker Compose to run it all.

How the parts talk to each other:

- `web` calls the backend under `/api`. In dev that goes through the Vite proxy (`web/vite.config.ts`), in compose through nginx (`web/nginx.conf`), so it is always same origin.
- The backend calls the desk simulator over HTTP. Inside compose that is `http://simulator:8000`.
- The Pico W calls the backend's HTTP API, the same `/api` the browser uses. Exact requests: [docs/pico-api.md](docs/pico-api.md).
- Only the backend talks to the simulator. The simulator's API key is in its URL, so it must never end up in the web app or the firmware (both are public).

`docker compose up --build` starts all three (simulator, backend, web). Run it: see [docs/deployment.md](docs/deployment.md). Rules for contributing: see [CONTRIBUTING.md](CONTRIBUTING.md).
