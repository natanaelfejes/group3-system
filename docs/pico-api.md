# What the Pico sends

The Pico talks to the backend through web on port 80, the same way the browser does. CI sends the same PUT on every PR (`stack` job, first desk from `/api/desks`), so if it breaks, the PR goes red.

## Move a desk

```http
PUT /api/desks/cd:fb:1a:53:fb:e6/position HTTP/1.1
Host: 4.233.89.145
Content-Type: application/json
Content-Length: 20
Connection: close

{"position_mm":1000}
```

Same thing with curl, to try it from a laptop:

```bash
curl -X PUT -H 'Content-Type: application/json' -d '{"position_mm":1000}' http://4.233.89.145/api/desks/cd:fb:1a:53:fb:e6/position
```

- `position_mm` is a whole number from 680 to 1320. The knob gives 0.0 to 1.0, so send `680 + round(fraction * 640)`.
- Without `Content-Type: application/json` the backend can't read the body and answers 400.
- `Host` is required by HTTP/1.1, nginx rejects the request without it.
- The answer is `{"position_mm":1000}`, the height the desk will go to. The desk moves at about 32 mm/s.
- The desk id is a MAC address. `GET /api/desks` lists the ones that exist. Put the one you use in a config define, not in the code.

## Read a desk

```http
GET /api/desks/cd:fb:1a:53:fb:e6/state HTTP/1.1
```

Answers with `position_mm`, `speed_mms` (0 when it stopped) and `status`.

## Planned: saved position

The return button should go back to the height the user saved, not a value hardcoded on the Pico. That needs a `GET` for the saved position, which needs the database and login first. Tracked in SCRUM-49.

## Errors

| Code | Meaning |
|---|---|
| 400 | Bad desk id, `position_mm` out of range, or broken JSON |
| 404 | Desk doesn't exist or is powered off |
| 429 | Too many requests, slow down (see below) |
| 502, 503 | Simulator error or simulator down. Retry later. |

## Things to know on the firmware side

- lwIP's `http_client` (`pico_lwip_http`) can only do GET. For the PUT, open a TCP connection with lwIP's raw `altcp`/`tcp` API and write the request above as text.
- Don't send on every knob change. The loop runs every 50 ms. Wait until the knob has stopped for about 300 ms, then send once. nginx allows 10 requests per second per IP (burst 20), and everyone behind the same Wi-Fi shares that.
- Plain HTTP, no encryption. Don't send anything real. TLS on the Pico is the proper fix if we ever need it.
- Wi-Fi name and password don't go in the repo (it's public). Pass them in at build time, e.g. `cmake -DWIFI_SSID=... -DWIFI_PASSWORD=...`.
- There is no auth yet. Fine for simulated desks, not for real ones.
