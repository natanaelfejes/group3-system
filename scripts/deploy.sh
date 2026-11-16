#!/usr/bin/env bash
# Redeploy to the Azure VM: build amd64 images here, ship them, restart the stack.
# Usage: VM=azureuser@<ip> KEY=~/.ssh/<your key> scripts/deploy.sh
# The VM has 1 GB RAM, so it never builds. Its own .env (SIMULATOR_API_KEY) stays on the VM.
set -euo pipefail
: "${VM:?set VM=azureuser@<ip>}"
SSH=(ssh ${KEY:+-i "$KEY"} "$VM")
cd "$(dirname "$0")/.."

docker buildx build --platform linux/amd64 -t group3-web:prod --load ./web
docker buildx build --platform linux/amd64 -t group3-simulator:prod --load ./simulator

"${SSH[@]}" 'mkdir -p ~/group3'
scp ${KEY:+-i "$KEY"} docker-compose.yml docker-compose.prod.yml "$VM:~/group3/"
docker save group3-web:prod group3-simulator:prod | gzip | "${SSH[@]}" 'gunzip | sudo docker load'
"${SSH[@]}" 'cd ~/group3 && sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build'
# up -d recreates only containers whose image changed; the simulator is stopped with SIGINT, so desks are saved.
