# Running and deploying

## Run it locally

```bash
cp .env.example .env        # then set SIMULATOR_API_KEY, e.g. openssl rand -hex 16
docker compose up --build
curl http://localhost:8081/api/health
```

One command starts the simulator, the backend (`api`) and the frontend. The frontend is on http://localhost:8081, the backend on http://localhost:3000 and the simulator on http://localhost:8000 (all localhost only). The key lives in the root `.env`; compose passes the same one to the simulator and the backend, which reaches the simulator as `http://simulator:8000`.

`/api/` on port 8081 is proxied by nginx (`web/nginx.conf`) to the backend, so the browser only talks to one origin, like the Vite dev proxy. Other paths fall back to `index.html`.
Extra simulator options go in `command:` in `docker-compose.yml`, e.g. `["--desks", "10", "--no-user-simulation"]`.

## What to know about the simulator

It's the course's WiFi2BLE simulator, built from a pinned commit (see `simulator/Dockerfile`). It binds to localhost by default, so the Dockerfile patches it to 0.0.0.0.

Desk state lives in memory and is only saved to `data/desks_state.json` on a clean stop (SIGINT, which compose sends). Saving takes a few seconds, so compose gives it 30 s before killing it. A crash or `docker kill` resets the desks.

By default the simulator also fakes users who move the desks on their own during the simulated day. Add `--no-user-simulation` to `command:` if you want desks to stay where you put them.

The API key is part of the URL, and the simulator logs every request, so the key ends up in `docker logs`. Never expose port 8000 publicly. Only the backend should reach it.

## Hosting

We run this compose file on an Azure VM paid from the Azure for Students credit. It's a normal VPS: always on, the same setup as locally, and we decide which ports are open, which matters for the Pico.

Render free and Cloud Run sleep or scale to zero when idle, which means slow first requests and reset desks. We also had spin-up and connection problems with Render last semester.

### The VM

- Created 2026-11-15, France Central, Standard B2ats_v2 (2 vCPU, 1 GB RAM), Ubuntu, resource group `group3-vm_group`. Public IP 4.233.89.145.
- Owner: Natanael (SDU Azure for Students subscription). Delete it after the exam, planned for the end of the semester (confirm the date once the exam is scheduled), by deleting the resource group.
- Port 80 is open to everyone (web). 22 is key-only SSH. The simulator and the backend are not public: they listen on 127.0.0.1:8000 and 127.0.0.1:3000 on the VM only, and web proxies `/api` to the backend.
- It has 2 GB swap because 1 GB RAM is tight. Never build images on the VM. Build for `linux/amd64` on a laptop and load them:

```bash
docker buildx build --platform linux/amd64 -t group3-web:prod --load ./web
docker buildx build --platform linux/amd64 -t group3-simulator:prod --load ./simulator
docker buildx build --platform linux/amd64 -t group3-api:prod --load ./backend
docker save group3-web:prod group3-simulator:prod group3-api:prod | gzip | ssh azureuser@<ip> 'gunzip | sudo docker load'
```

- Every push to `main` that passes the checks in `.github/workflows/ci.yml` deploys by itself. The deploy job runs `scripts/deploy.sh` on the GitHub runner (it builds the images, the VM can't). You can also redeploy from the Actions tab (Run workflow on main), or by hand: `VM=azureuser@<ip> KEY=~/.ssh/<your key> scripts/deploy.sh`.
- The deploy job runs in the GitHub environment `production`, limited to the `main` branch. It needs three environment secrets there (not repo secrets): `VM_HOST`, `VM_SSH_KEY` and `VM_KNOWN_HOSTS`. `VM_KNOWN_HOSTS` is the VM's host key line: `ssh-keyscan -t ed25519 <ip>` (or read `/etc/ssh/ssh_host_ed25519_key.pub` on the VM). Pushes that only change `*.md` or `docs/` do not trigger CI.
- `VM_SSH_KEY` is a separate key from the admin one, but not a weak one: `azureuser` has `sudo docker`, so it is root on the VM. Treat the key that way. Anyone who can push to `main` can deploy.
- Rollback: revert the commit on `main`, which redeploys. Every deploy recreates all containers, so the simulator blips for about 20 s (desks are saved on stop). Before a demo or the exam, disable the workflow in the Actions tab if you don't want that.
- CI on every PR: web lint and build, backend install and syntax check, and a `stack` job that checks `docker compose config` for the prod file, runs `docker compose up --build --wait` with a throwaway key, and checks web (200), `/api/health` through web (200) and an unknown desk (404). Deploy needs web, backend and stack. After deploying, the job checks `http://<ip>/api/health`. `npm test` runs in `web/` and `backend/` as soon as a `test` script exists there.
- On the VM, `~/group3/` holds `docker-compose.yml`, `docker-compose.prod.yml` and a `.env` with its own `SIMULATOR_API_KEY` (not the same as anyone's local one):

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build
```

- Rebuilding the VM:
  1. Create it (region policy notes below), install Docker, add 2 GB swap.
  2. Create `~/group3/.env` with a fresh `SIMULATOR_API_KEY` (`chmod 600`, never a key from the README or defaults).
  3. Add the deploy public key to `~/.ssh/authorized_keys` and open port 80.
  4. Set the three environment secrets again.
- To get SSH access, send your public key to the owner, who appends it to `~/.ssh/authorized_keys` on the VM.
- Gotchas: the subscription only allows norwayeast, polandcentral, switzerlandnorth, italynorth and francecentral (policy), and the new VM wizard hides them, so use the "previous experience" wizard. Availability zone 1 hides the B-series, so pick "no infrastructure redundancy".
- Tested on 2026-11-15: web returns 200 from outside, port 8000 is not reachable from outside, simulator is healthy, right key 200 and wrong key 401, and desk state is written to the volume on `docker compose stop`.
- The backend has no auth. Through web on port 80, `/api` is public, including `PUT .../position`.

## Accepted risks

- `/api` is public and has no auth. It only controls simulated desks. Auth is required before the backend controls any real desk, because a moving desk is a physical safety risk.
- SSH is open to the world, key-only.
- Every key in `authorized_keys` and everyone who can push to `main` is effectively root on the VM.
- nginx rate limits `/api/` to 10 requests per second per IP (burst 20). That slows abuse a little and does not replace auth.

## Open points

1. The Pico reaches the API through the web proxy on port 80 (`http://<ip>/api/...`). That is plain HTTP, so nothing is encrypted. Don't put anything real in it. TLS in the firmware is the proper fix.
2. Credentials stay in a password manager, not the repo.
