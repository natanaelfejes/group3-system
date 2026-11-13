# Deploying the desk simulator (SCRUM-33)

## Run it locally

```bash
cp .env.example .env        # then put your own key in SIMULATOR_API_KEY
docker compose up --build
curl http://localhost:8000/api/v2/<your key>/desks
```

The frontend (`web/`) is served on http://localhost:3000.

The backend then uses `SIMULATOR_URL=http://localhost:8000` (as in `backend/backend-README.md`) and the same key.
Extra simulator options go in `command:` in `docker-compose.yml`, e.g. `["--desks", "10", "--no-user-simulation"]`.

## What the simulator needs from a host

Read from the source (course repo, pinned commit in `simulator/Dockerfile`):

| Fact | Consequence |
|---|---|
| Python standard library only, 741 lines | Tiny image, no pip step |
| `main.py` binds to `"localhost"` | Unreachable from outside a container. The Dockerfile patches it to `0.0.0.0` |
| Desk state lives in memory, a background thread moves the desks | Needs an always-on process. Scale-to-zero or sleeping hosts reset the desks |
| State is saved to `data/desks_state.json` on Ctrl+C only | Compose stops it with SIGINT and keeps `data/` in a volume |
| The API key is part of the URL path | The simulator must not be public. Only our backend should reach it |
| Single-threaded `HTTPServer` | Fine for one poller. Not for load tests |

## Where to host it

Prices are from third-party summaries unless noted, so check each provider's page before paying.

| Option | Fits? | Why |
|---|---|---|
| **Azure VM (Azure for Students) running `docker compose`** | **Yes, recommended** | A real VPS: always-on, same compose file as local, the simulator stays unexposed, and we choose which ports are open (matters for the Pico W). $100 credit with no card per the Student Pack summaries, and only the account owner needs to qualify. The credit runs out, so the end date goes in the doc |
| Hetzner VPS | Yes, if Azure falls through | Same setup. CX23 is about €4/month (aggregator figure, and some sources report new servers temporarily unavailable). Needs a card |
| Google Compute Engine VM | Yes, but a card is needed | Same setup. The $300 free trial lasts 90 days, needs a card, and the account stops after that unless upgraded. This is the standard trial, not a student offer. An always-free e2-micro exists but only in US regions, with about 1 GB RAM |
| Home server + Cloudflare Tunnel | Fallback | Free, but the demo depends on one person's machine and network |
| Fly.io | Works | About $2.19/month for a 256 MB machine, no free allowance for new accounts (unconfirmed). Needs a card |
| Railway | Works | Hobby plan $5/month including $5 of usage |
| Render free | No | Spins down after 15 minutes without traffic and has no persistent disk, so desks reset. The group also had spin-up and connectivity problems with Render last semester |
| Google Cloud Run | No | Scale-to-zero resets the desks. Always-on CPU is billed for the whole instance lifetime, and the monthly free allowance covers only about 9% of one always-on vCPU |
| Vercel | Frontend only | Functions are short-lived (300 s default), so there is nowhere to run a process that keeps ticking. Fine for hosting the React build |

## Open points for the group

1. **Pico W and TLS.** `backend-README.md` has the Pico call the API over plain HTTP. On a public VPS that means unencrypted traffic, so the API must not rely on a secret that appears in it. Either keep the Pico demo on a local network, or put TLS on the Pico (more firmware work).
2. **Who owns the VPS account.** One account, credentials in a password manager, not in the repo.
3. **End date.** Delete the server after the exam, and write the date here when the VM is created.
