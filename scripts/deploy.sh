#!/usr/bin/env bash
# Redeploy to the Azure VM: build amd64 images here, ship them, restart the stack.
# Usage: VM=azureuser@<ip> KEY=~/.ssh/<your key> scripts/deploy.sh
# The VM has 1 GB RAM, so it never builds. Its own .env (SIMULATOR_API_KEY) stays on the VM.
set -euo pipefail
: "${VM:?set VM=azureuser@<ip>}"
SSH=(ssh ${KEY:+-i "$KEY"} "$VM")
cd "$(dirname "$0")/.."

# The runner has no build cache, so every deploy makes new images and recreates all containers, the simulator too.
# The simulator is stopped with SIGINT, so desk state is saved and survives, but expect a blip of about 20 s.

docker buildx build --platform linux/amd64 -t group3-web:prod --load ./web
docker buildx build --platform linux/amd64 -t group3-simulator:prod --load ./simulator
docker buildx build --platform linux/amd64 -t group3-api:prod --load ./backend

docker save group3-web:prod group3-simulator:prod group3-api:prod | gzip | "${SSH[@]}" 'gunzip | sudo docker load'
"${SSH[@]}" 'mkdir -p ~/group3'
scp ${KEY:+-i "$KEY"} docker-compose.yml docker-compose.prod.yml "$VM:~/group3/"
# --wait fails the deploy if a container does not become healthy.
"${SSH[@]}" 'cd ~/group3 && sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build --wait'
"${SSH[@]}" 'sudo docker image prune -f'
