# WiFi2BLE desk simulator (course repo, MIT). Stdlib-only Python, so no pip step.
# We clone a pinned commit instead of copying the code into this repo.

FROM alpine/git AS src
# Bump this to move to a newer simulator version.
ARG SIM_REF=7b8835f2b9de7c1b8a79e41f4546ae1c77708531
RUN git clone https://source.coderefinery.org/sdm-edu/wifi2ble-box-simulator.git /sim \
 && git -C /sim checkout "$SIM_REF" \
 # main.py binds to "localhost", which is unreachable from outside a container.
 && sed -i 's/("localhost", port)/("0.0.0.0", port)/' /sim/simulator/main.py \
 && grep -q '"0.0.0.0", port' /sim/simulator/main.py

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=src /sim/simulator ./simulator
COPY entrypoint.sh /entrypoint.sh
# The simulator reads config/ and writes data/ relative to the working directory.
RUN chmod +x /entrypoint.sh \
 && useradd --system --no-create-home sim \
 && mkdir config data \
 && chown sim config data
USER sim
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
