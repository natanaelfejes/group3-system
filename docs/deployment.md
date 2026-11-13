# Running and deploying

## Run it locally

```bash
cp .env.example .env        # then set SIMULATOR_API_KEY, e.g. openssl rand -hex 16
docker compose up --build
curl http://localhost:8000/api/v2/<your key>/desks
```

The frontend is on http://localhost:8081. The key lives in the root `.env`, and the backend should read the same one once it runs in compose.
Extra simulator options go in `command:` in `docker-compose.yml`, e.g. `["--desks", "10", "--no-user-simulation"]`.

## What to know about the simulator

It's the course's WiFi2BLE simulator, built from a pinned commit (see `simulator/Dockerfile`). It binds to localhost by default, so the Dockerfile patches it to 0.0.0.0.

Desk state lives in memory and is only saved to `data/desks_state.json` on a clean stop (SIGINT, which compose sends). Saving takes a few seconds, so compose gives it 30 s before killing it. A crash or `docker kill` resets the desks.

By default the simulator also fakes users who move the desks on their own during the simulated day. Add `--no-user-simulation` to `command:` if you want desks to stay where you put them.

The API key is part of the URL, and the simulator logs every request, so the key ends up in `docker logs`. Never expose port 8000 publicly. Only the backend should reach it.

## Hosting

We're going with an Azure VM on the Azure for Students credit, running this compose file. It's a normal VPS: always on, the same setup as locally, and we decide which ports are open, which matters for the Pico. Hetzner (about €4/month) is the fallback.

Render free and Cloud Run sleep or scale to zero when idle, which means slow first requests and reset desks. We also had spin-up and connection problems with Render last semester.

## Open points

1. The Pico calls the API over plain HTTP. Fine on a local network, not on a public server, so either keep the Pico demo on a LAN or add TLS to the firmware.
2. One person owns the Azure account. Credentials go in a password manager, not the repo.
3. Delete the VM after the exam. Write the date here when it's created.
