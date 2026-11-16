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

We run this compose file on an Azure VM paid from the Azure for Students credit. It's a normal VPS: always on, the same setup as locally, and we decide which ports are open, which matters for the Pico.

Render free and Cloud Run sleep or scale to zero when idle, which means slow first requests and reset desks. We also had spin-up and connection problems with Render last semester.

### The VM

- Created 2026-11-15, France Central, Standard B2ats_v2 (2 vCPU, 1 GB RAM), Ubuntu, resource group `group3-vm_group`. Public IP 4.233.89.145.
- Owner: Natanael (SDU Azure for Students subscription). Delete it after the exam, planned for the end of the semester (confirm the date once the exam is scheduled), by deleting the resource group.
- Port 80 is open to everyone (web). 22 is key-only SSH. The simulator is not published: it listens on 127.0.0.1:8000 on the VM only.
- It has 2 GB swap because 1 GB RAM is tight. Never build images on the VM. Build for `linux/amd64` on a laptop and load them:

```bash
docker buildx build --platform linux/amd64 -t group3-web:prod --load ./web
docker buildx build --platform linux/amd64 -t group3-simulator:prod --load ./simulator
docker save group3-web:prod group3-simulator:prod | gzip | ssh azureuser@<ip> 'gunzip | sudo docker load'
```

- Every push to `main` that passes the checks in `.github/workflows/ci.yml` deploys by itself. The deploy job runs `scripts/deploy.sh` on the GitHub runner (it builds the images, the VM can't). You can also redeploy from the Actions tab (Run workflow on main), or by hand: `VM=azureuser@<ip> KEY=~/.ssh/<your key> scripts/deploy.sh`.
- The workflow needs three repo secrets: `VM_HOST`, `VM_SSH_KEY` (a deploy-only key, separate from the admin key) and `VM_KNOWN_HOSTS`. If the VM is recreated, set all three again.
- CI on every PR: web lint and build, backend install and syntax check, and `docker compose config` for both compose files. `npm test` runs in `web/` and `backend/` as soon as a `test` script exists there.
- On the VM, `~/group3/` holds `docker-compose.yml`, `docker-compose.prod.yml` and a `.env` with its own `SIMULATOR_API_KEY` (not the same as anyone's local one):

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build
```

- To get SSH access, send your public key to the owner, who appends it to `~/.ssh/authorized_keys` on the VM.
- Gotchas: the subscription only allows norwayeast, polandcentral, switzerlandnorth, italynorth and francecentral (policy), and the new VM wizard hides them, so use the "previous experience" wizard. Availability zone 1 hides the B-series, so pick "no infrastructure redundancy".
- Tested on 2026-11-15: web returns 200 from outside, port 8000 is not reachable from outside, simulator is healthy, right key 200 and wrong key 401, and desk state is written to the volume on `docker compose stop`.
- The backend is not in compose yet, so `/api` is not proxied on the VM until it is merged.

## Open points

1. The Pico calls the API over plain HTTP. That works against the VM on port 80, but the traffic is not encrypted, so don't put anything real in it. TLS in the firmware is the proper fix.
2. Credentials stay in a password manager, not the repo.
