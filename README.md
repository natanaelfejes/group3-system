# group3-system

Part of the Group 3 semester project: a management system for Linak motorized desks (distributed system with embedded elements).

Web app and API for the desk system.

Stack: Node.js (JavaScript) backend, React + TypeScript frontend, PostgreSQL on Supabase, Docker, GitHub Actions. The Pico W firmware (C++) lives in its own repo.

Stack: React + TypeScript (Vite) in `web/`, Node + Express in `backend/`, PostgreSQL on Supabase, Docker Compose to run it all.

How the parts talk to each other:

- `web` calls the backend under `/api` (in dev through the Vite proxy, see `web/vite.config.ts`).
- The backend calls the desk simulator over HTTP. Inside compose that is `http://simulator:8000`.
- The Pico W calls the backend's HTTP API.

Run it: see [docs/deployment.md](docs/deployment.md). Rules for contributing: see [CONTRIBUTING.md](CONTRIBUTING.md).
