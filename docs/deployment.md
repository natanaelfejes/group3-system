# Running and deploying

## Run it locally

```bash
cp .env.example .env        # then set SIMULATOR_API_KEY, e.g. openssl rand -hex 16
docker compose up --build
curl http://localhost:8081/api/health
```

That starts the simulator, the backend (`api`) and the frontend. Web is on http://localhost:8081, the backend on :3000 and the simulator on :8000, all localhost only. The key lives in the root `.env` and compose gives the same one to the simulator and the backend.

nginx (`web/nginx.conf`) proxies `/api/` to the backend, so the browser only talks to one origin, like the Vite dev proxy. Every other path falls back to `index.html`.

Extra simulator options go in `command:` in `docker-compose.yml`, e.g. `["--desks", "10", "--no-user-simulation"]`.

## The simulator

It's the course's WiFi2BLE simulator, built from a pinned commit (see `simulator/Dockerfile`). It binds to localhost by default, so the Dockerfile patches it to 0.0.0.0.

Desk state lives in memory and is only saved to `data/desks_state.json` on a clean stop (SIGINT, which compose sends). Saving takes a few seconds, so compose gives it 30 s before killing it. A crash or `docker kill` resets the desks.

It also fakes users who move the desks on their own during the simulated day. Add `--no-user-simulation` if you want desks to stay where you put them.

The API key is part of the URL and the simulator logs every request, so the key ends up in `docker logs`. Never expose port 8000. Only the backend talks to it.

## Hosting

We run this compose file on an Azure VM, paid from the Azure for Students credit. It's a normal VPS: always on, same setup as locally, and we decide which ports are open, which matters for the Pico.

Render free and Cloud Run sleep when idle, which means slow first requests and reset desks. We also had spin-up and connection problems with Render last semester.

### The VM

- Created 2026-11-15 in France Central. Standard B2ats_v2 (2 vCPU, 1 GB RAM), Ubuntu, resource group `group3-vm_group`, public IP 4.233.89.145.
- It has 2 GB swap because 1 GB RAM is tight, and it can't build images. They're built for `linux/amd64` on the GitHub runner (or your laptop) and loaded over SSH.
- Port 80 is open to everyone and serves web. Port 22 is SSH, key only. The simulator and the backend only listen on 127.0.0.1 on the VM (:8000 and :3000), web proxies `/api` to the backend.
- Owner: Natanael (SDU Azure for Students subscription). Delete it after the exam by deleting the resource group. Planned for the end of the semester, we'll write the date here once the exam is scheduled.
- `~/group3/` on the VM holds `docker-compose.yml`, `docker-compose.prod.yml` and a `.env` with its own `SIMULATOR_API_KEY`, not the same as anyone's local one.

### Deploying

Every push to `main` that passes the checks in `.github/workflows/ci.yml` deploys by itself. The deploy job runs `scripts/deploy.sh` on the GitHub runner, then checks that `http://<ip>/api/health` answers. Pushes that only change `*.md` or `docs/` don't trigger CI.

- By hand: Run workflow on main in the Actions tab, or `VM=azureuser@<ip> KEY=~/.ssh/<your key> scripts/deploy.sh` from a laptop with Docker.
- Rollback: revert the commit on `main` (through a PR) and it redeploys.
- Every deploy recreates all containers. The simulator saves its desks on stop, but expect a blip of about 20 s. Before a demo or the exam, disable the workflow in the Actions tab if you don't want that.

The deploy job runs in the GitHub environment `production`, which only `main` can use. It has three environment secrets (not repo secrets): `VM_HOST`, `VM_SSH_KEY` and `VM_KNOWN_HOSTS`. For the last one use the output of `ssh-keyscan -t ed25519 <ip>`.

`VM_SSH_KEY` is separate from the admin key, but it's not a weak one: `azureuser` has `sudo docker`, so it's root on the VM. A merged change to `ci.yml` could send the key anywhere, so PRs touching `.github/` or `scripts/` get a review first (CONTRIBUTING.md). GitHub doesn't enforce it, we trust each other.

### CI on every PR

- web: lint and build
- backend: install and syntax check
- stack: checks that the prod compose file parses (it doesn't run it), runs `docker compose up --build --wait` with a throwaway key, then expects 200 on web, 200 on `/api/health` through web, 404 for an unknown desk and a working Pico PUT

`npm test` runs in `web/` and `backend/` as soon as a `test` script exists there. Deploy waits for all three.

### Adding a secret (database, login, ...)

1. Add it to the `api` service's `environment:` in `docker-compose.yml`, e.g. `DATABASE_URL: ${DATABASE_URL:?}`.
2. Put a dummy value in the `stack` job's `env:` in `ci.yml`, or CI fails.
3. Add it to `.env.example` with no real value, and to your own `.env`.
4. Ask the VM owner to add the real one to `~/group3/.env` before the PR merges, or the deploy fails.
5. Real values go in the password manager, never in the repo or Discord.

### SSH access

Send your public key to the owner, who adds it to `~/.ssh/authorized_keys` on the VM. You only need it to read logs (`sudo docker compose logs`), deploys don't need it.

### Rebuilding the VM

1. Create it (see the gotchas below), install Docker, add 2 GB swap.
2. Create `~/group3/.env` with a fresh `SIMULATOR_API_KEY`, `chmod 600`. Not one from the README.
3. Add the deploy public key to `~/.ssh/authorized_keys` and open port 80.
4. Set the three environment secrets again.

### Azure gotchas

The subscription only allows norwayeast, polandcentral, switzerlandnorth, italynorth and francecentral (policy), and the new VM wizard hides them, so use the "previous experience" wizard. Availability zone 1 hides the B-series, so pick "no infrastructure redundancy".

Checked on 2026-11-15: web returns 200 from outside, port 8000 isn't reachable from outside, simulator healthy, right key 200 and wrong key 401, and desk state survives a stop/start and a VM reboot.

## Risks we accepted

- `/api` is public and has no auth, `PUT .../position` included. It only controls simulated desks. We need auth before the backend controls a real desk, since a moving desk is a physical safety risk.
- SSH is open to the world, key only.
- Every key in `authorized_keys` and everyone who can merge to `main` is effectively root on the VM.
- nginx limits `/api/` to 10 requests per second per IP (burst 20), then answers 429. That slows abuse a bit and doesn't replace auth. Everyone on SDU Wi-Fi probably shares one IP, so if the demo hits 429s, raise it in `web/nginx.conf`.
- Base images (`node`, `nginx`, `python`) aren't pinned to a digest and every deploy rebuilds them, so a deploy can pick up a newer patch version than CI tested. Each deploy also clones the simulator from source.coderefinery.org, so if that's down, the deploy fails. Rerun it later.
- No memory limits on the containers. If the 1 GB VM runs out, check `sudo docker stats` first.

## Open points

1. The Pico reaches the API through the web proxy on port 80 (`http://<ip>/api/...`, exact requests in [pico-api.md](pico-api.md)). That's plain HTTP, so nothing is encrypted, don't send anything real. TLS in the firmware is the proper fix.
2. Credentials go in a password manager, not the repo.
