---
title: "BLE 5.0 Extended Advertising & ESP32 Telemetry Pipelines"
date: 2026-11-10 10:00
image: /assets/images/blog/ble-esp32-telemetry.jpg
headerImage: true
lang: en
tag:
  - ble
  - esp32
  - esp-now
  - mqtts
  - iot
category: blog
author: mabuonomo
---

If you have ever tried to poll telemetry from a fleet of battery-powered Bluetooth Low Energy (BLE) sensors using classic GATT connections, you know how quickly that model falls apart. Connect, discover services, read a characteristic, disconnect: it works perfectly for two devices on your desk. Scale it to dozens of nodes in a noisy RF environment and you spend half the battery budget on connection handshakes and the other half fighting timeouts, `GATT_ERROR`s and gateways that are always busy talking to the wrong sensor.

That bottleneck pushed us toward **connectionless telemetry**: sensors that never accept a connection during normal operation and simply *broadcast* a compact, self-describing snapshot using **BLE 5.0 Extended Advertising**. A layer of inexpensive **ESP32** boards picks those broadcasts out of the air, relays them over **ESP-NOW**, and a single uplink node ships everything over **MQTTS** into **RabbitMQ**, **InfluxDB** and **Grafana**.

This post walks through the whole pipeline end to end: payload design, the scanning firmware, the radio relay, store-and-forward buffering, and the observability that tells you when something in the chain is quietly lying to you.

![BLE 5.0 Extended Advertising and ESP32 Telemetry Pipeline](/assets/images/blog/ble-esp32-telemetry.jpg)

## The Architecture at a Glance

Before diving in, here is the shape of the system. Each layer has exactly one job, which is what makes it debuggable at 3 AM.

```text
 ┌──────────────┐  BLE 5 ext. adv   ┌──────────────┐   ESP-NOW    ┌──────────────┐  MQTTS   ┌───────────┐
 │  BLE sensor  │ ────────────────▶ │ ESP32 sender │ ───────────▶ │ ESP32 recvr  │ ───────▶ │ RabbitMQ  │
 │ (deep sleep) │   (broadcast)     │  (scanner)   │  (2.4 GHz)   │ (+ microSD)  │  (TLS)   │ (MQTT plg)│
 └──────────────┘                   └──────────────┘              └──────────────┘          └─────┬─────┘
                                                                                                  │ AMQP
                                                          ┌──────────┐      ┌──────────┐    ┌─────▼─────┐
                                                          │ Grafana  │ ◀─── │ InfluxDB │ ◀─ │ consumers │
                                                          └──────────┘      └──────────┘    └───────────┘
```

- **Sensors** wake up, sample, broadcast one extended advertisement, and go back to sleep.
- **Senders** listen continuously, filter by Company ID, enrich each packet with their own identity and the measured RSSI, and relay it.
- **The receiver** is the only node that needs a real network connection. It buffers to microSD when the uplink is down.
- **Consumers** deduplicate, decode and write time series. They are stateless and horizontally scalable.

## Why BLE 5.0 Extended Advertising Changes the Game

In legacy BLE 4.x, an advertising PDU carries at most **31 bytes** of AdvData. Subtract the mandatory Flags structure (3 bytes), the length/type header of a Manufacturer Specific Data structure (2 bytes) and the Company ID (2 bytes), and you are left with roughly **24 bytes** for actual telemetry. That is enough for a temperature, not for a meaningful statistical window.

BLE 5.0 Extended Advertising works differently. The three primary advertising channels (37, 38, 39) carry only a tiny `ADV_EXT_IND` header containing an **AuxPtr**: a pointer telling scanners *"the real payload follows on secondary channel N, at offset T, on PHY P"*. The payload itself is sent in an `AUX_ADV_IND` on one of the 37 secondary channels, with up to **254 bytes** of AdvData per PDU. If that is not enough, `AUX_CHAIN_IND` fragments can be chained for a total of up to **1,650 bytes**.

This has three practical consequences:

1. **Payload room.** A single broadcast can carry a complete window summary (mean, standard deviation, peak frequency, min/max, counters, battery) instead of a single number.
2. **Less congestion on primary channels.** Because the primary channels only carry small headers, crowded environments with lots of legacy beacons hurt less.
3. **PHY choice.** The secondary payload can be sent on **LE 2M** (shorter airtime, less energy per byte) or **LE Coded** (S=2 or S=8, trading throughput for up to roughly 4× the range). The primary header must use LE 1M or LE Coded.

> **Hardware gotcha:** the *original* ESP32 (ESP32-D0WD and friends) only supports **Bluetooth 4.2**, so it cannot receive extended advertisements at all. For scanners you need a BLE 5-capable chip such as the **ESP32-C3**, **ESP32-S3**, **ESP32-C6** or **ESP32-H2**. This is the single most common reason I see "my ESP32 never sees the sensor" bug reports.

## Designing a Payload That Survives Real Life

The payload format is a contract between firmware that will live in the field for years and backend code that will be rewritten several times. Treat it like a public API.

A single Manufacturer Specific Data structure (AD type `0xFF`) can look like this:

| Offset | Field | Size | Purpose |
| :--- | :--- | :--- | :--- |
| `0..1` | Company ID | `2 B` | Fast hardware/software scan filtering (little-endian) |
| `2` | Schema version | `1 B` | Lets the backend decode old and new firmware side by side |
| `3` | Firmware & flags | `1 B` | Active/idle state, low-battery flag, FW revision bits |
| `4..5` | `tx_counter` | `2 B` | Monotonic counter for packet-loss math |
| `6..7` | Battery voltage | `2 B` | Millivolts for proactive battery alerts |
| `8..N` | Window metrics | `N B` | Mean, std dev, peak frequency, range, sample count |

A few rules that paid for themselves many times over:

- **Always include a schema version.** You *will* change the layout. Without a version byte, the backend has to guess from the payload length, and two different layouts eventually end up with the same length.
- **Always include a monotonic `tx_counter`.** Without it, you can never tell whether a sensor stopped transmitting or your radio link is silently dropping 5% of packets. A `uint16_t` is enough as long as you handle wrap-around correctly (more on that later).
- **Use fixed-point integers, not floats.** Send temperature as `int16_t` in hundredths of a degree, voltage as millivolts. It is smaller, endian-safe once you pick an endianness, and avoids NaN surprises.
- **Pick little-endian and document it.** Both Xtensa and RISC-V ESP32 variants are little-endian, as is the Company ID field in the BLE spec, so this is the path of least resistance.
- **Keep it under one PDU if you can.** Chained `AUX_CHAIN_IND` packets work, but every extra fragment is another chance to lose the whole advertisement. Staying under ~250 bytes keeps loss rates noticeably lower.

## The Sender: Extended Scanning with NimBLE

On ESP-IDF, the **NimBLE** host stack exposes extended scanning through `ble_gap_ext_disc()`. Two parameters matter more than any others: **duplicate filtering must be off** (otherwise the controller happily drops every packet after the first one from a given address, and you see one reading per boot) and the **scan window should equal the scan interval** for a continuous duty cycle.

```c
#include "host/ble_hs.h"
#include "host/ble_gap.h"

#define COMPANY_ID 0x1234   /* your assigned Bluetooth SIG Company ID */

static int gap_event_cb(struct ble_gap_event *event, void *arg);

static void start_ext_scan(void)
{
    struct ble_gap_ext_disc_params uncoded = {
        .itvl    = BLE_GAP_SCAN_ITVL_MS(60),
        .window  = BLE_GAP_SCAN_WIN_MS(60),   /* window == interval: ~100% duty */
        .passive = 1,                          /* never send SCAN_REQ */
    };

    int rc = ble_gap_ext_disc(BLE_OWN_ADDR_PUBLIC,
                              0,     /* duration: forever */
                              0,     /* period */
                              0,     /* filter_duplicates: OFF, we want every packet */
                              BLE_HCI_SCAN_FILT_NO_WL,
                              0,     /* limited discovery */
                              &uncoded,
                              NULL,  /* coded PHY params: enable if sensors use LE Coded */
                              gap_event_cb, NULL);
    ESP_ERROR_CHECK(rc == 0 ? ESP_OK : ESP_FAIL);
}
```

The callback walks the AD structures (`[length][type][data…]`), looks for Manufacturer Specific Data with our Company ID, and hands off a compact frame. Crucially, it does **no blocking work**: the NimBLE host task must stay responsive or you start missing advertisements.

```c
static bool find_mfg_data(const uint8_t *adv, uint8_t len,
                          const uint8_t **out, uint8_t *out_len)
{
    uint8_t i = 0;
    while (i + 1 < len) {
        uint8_t field_len = adv[i];
        if (field_len == 0 || i + field_len >= len) break;   /* malformed or truncated */
        uint8_t type = adv[i + 1];
        if (type == 0xFF && field_len >= 3) {
            uint16_t cid = adv[i + 2] | (adv[i + 3] << 8);
            if (cid == COMPANY_ID) {
                *out = &adv[i + 2];
                *out_len = field_len - 1;
                return true;
            }
        }
        i += field_len + 1;
    }
    return false;
}

static int gap_event_cb(struct ble_gap_event *event, void *arg)
{
    if (event->type != BLE_GAP_EVENT_EXT_DISC) return 0;

    const struct ble_gap_ext_disc_desc *d = &event->ext_disc;
    if (d->data_status != BLE_GAP_EXT_ADV_DATA_STATUS_COMPLETE) return 0;

    const uint8_t *mfg; uint8_t mfg_len;
    if (!find_mfg_data(d->data, d->length_data, &mfg, &mfg_len)) return 0;

    ble_telemetry_frame_t frame = { .version = FRAME_VERSION, .rssi = d->rssi };
    memcpy(frame.sensor_mac, d->addr.val, 6);
    frame.payload_len = MIN(mfg_len, sizeof(frame.payload));
    memcpy(frame.payload, mfg, frame.payload_len);

    xQueueSend(relay_queue, &frame, 0);   /* never block inside the GAP callback */
    return 0;
}
```

Note the `data_status` check: with chained advertisements, NimBLE may deliver an `INCOMPLETE` event followed by more data, or a `TRUNCATED` one if the controller ran out of buffer. Silently decoding a truncated payload is how you end up with battery readings of 0 mV in Grafana.

## Splitting the Edge: Senders and Receiver over ESP-NOW

Running Ethernet or reliable Wi-Fi to every corner of a physical site is rarely practical. Splitting the gateway layer into two roles keeps wiring simple:

1. **ESP32 senders** sit near the sensors, scan continuously and relay frames over **ESP-NOW**, Espressif's connectionless 2.4 GHz peer-to-peer protocol. No access point, no DHCP, no TCP: a frame is simply a vendor-specific 802.11 action frame.
2. **The ESP32 receiver** sits where Ethernet or stable Wi-Fi is available, collects ESP-NOW frames from all nearby senders, and forwards them over **MQTTS**.

Here is the packed struct shared between both firmwares. It lives in a single header file included by both projects, so it can never drift:

```c
#define FRAME_VERSION 2

typedef struct __attribute__((packed)) {
  uint8_t  version;          /* bump on any layout change */
  uint8_t  sender_mac[6];
  uint8_t  sensor_mac[6];
  int8_t   rssi;
  uint8_t  payload_len;
  uint8_t  payload[64];
} ble_telemetry_frame_t;     /* 79 bytes, well under the 250 B ESP-NOW limit */

_Static_assert(sizeof(ble_telemetry_frame_t) <= 250, "ESP-NOW v1 payload limit");
```

On the receiver, the ESP-NOW receive callback runs inside the **Wi-Fi task**. Writing to an SD card or a TLS socket from there will stall the Wi-Fi stack and eventually trip the watchdog. The callback should validate and enqueue, nothing more:

```c
static QueueHandle_t ingest_queue;

static void on_esp_now_recv(const esp_now_recv_info_t *info,
                            const uint8_t *data, int len)
{
    if (len != sizeof(ble_telemetry_frame_t)) return;
    if (data[0] != FRAME_VERSION) return;          /* reject unknown layouts */

    ble_telemetry_frame_t frame;
    memcpy(&frame, data, sizeof(frame));
    memcpy(frame.sender_mac, info->src_addr, 6);   /* trust the radio, not the payload */

    if (xQueueSend(ingest_queue, &frame, 0) != pdTRUE) {
        dropped_frames++;                          /* export this as a metric! */
    }
}
```

A separate FreeRTOS task drains `ingest_queue` and decides between publishing and buffering.

### Three ESP-NOW pitfalls worth knowing upfront

- **Channel lock.** ESP-NOW peers must share the same Wi-Fi channel. If the receiver is also connected to an access point, it follows the AP's channel, and if the AP changes channel (auto channel selection loves to do this at night), every sender goes silent. Either pin the AP channel, or have senders scan channels and re-pair when acknowledgements stop arriving.
- **Radio coexistence.** On a single-radio ESP32, BLE and Wi-Fi share the antenna via time-division. A 100% BLE scan duty cycle on a sender starves ESP-NOW transmissions. A 60 ms window every 60 ms works, but leave headroom with `esp_coex` preferences, or batch several frames per ESP-NOW send.
- **Encryption limits.** ESP-NOW supports CCMP encryption with per-peer keys, but only for a small number of peers (configurable, up to 17). With more senders than that, authenticate at the application layer instead: a truncated HMAC over the frame works well.

## Surviving Network Drops with Store-and-Forward

Field networks drop. Brokers restart. TLS handshakes occasionally stall for 30 seconds. If the receiver only buffers frames in RAM, a 10-minute network blip means 10 minutes of lost telemetry, and the gap shows up in exactly the chart someone looks at in the next review meeting.

Adding a microSD slot turns the receiver into a proper store-and-forward edge node with a very simple state machine:

- **MQTTS connected and queue empty:** publish directly.
- **MQTTS down:** append frames to `/queue.bin` on the SD card.
- **MQTTS recovered:** drain `/queue.bin` *in small batches* (for instance 20 frames per loop iteration), interleaving live frames, so you don't starve the Wi-Fi stack or trigger the task watchdog.

Two details make this robust instead of merely functional:

**Fixed-size records with a CRC.** If power is cut mid-write, the last record will be garbage. With fixed-size records you can compute exactly where each record starts and validate it, instead of trying to resynchronise a variable-length stream.

```c
typedef struct __attribute__((packed)) {
  uint32_t              captured_at;   /* receiver uptime or SNTP epoch */
  ble_telemetry_frame_t frame;
  uint32_t              crc32;         /* over the two fields above */
} sd_record_t;
```

**A persisted read cursor.** Store the byte offset of the next record to send in a tiny `/cursor` file, updated after each successful batch (and after the broker's PUBACK, since we publish with QoS 1). When the cursor reaches the end of the file, truncate both. If the receiver reboots mid-drain, it resumes from the cursor instead of resending hours of data or, worse, skipping it.

> **Tip:** call `fsync()` per batch, not per record. SD cards have large erase blocks, and syncing after every 80-byte write will both crush throughput and wear the card out surprisingly quickly.

## MQTTS into RabbitMQ

RabbitMQ's **MQTT plugin** lets the receiver speak plain MQTT 3.1.1/5 over TLS on port `8883`, while backend services consume over AMQP with all of RabbitMQ's routing, acknowledgement and quorum-queue durability.

Under the hood, MQTT publishes land on the `amq.topic` exchange, with `/` in topic names translated into `.` in routing keys. A receiver publishing to `telemetry/rx-01/ble` produces routing key `telemetry.rx-01.ble`, so a consumer queue bound with `telemetry.*.ble` gets frames from every receiver.

A few settings that matter on constrained devices:

- **QoS 1** for telemetry. QoS 0 loses frames silently on reconnect; QoS 2 doubles round trips for little benefit, since the backend deduplicates anyway.
- **Client certificates** (mutual TLS) per receiver, so a stolen device can be revoked individually.
- **A sensible keepalive** (30–60 s) and a **Last Will** on a status topic, so the backend knows a receiver went offline rather than inferring it from silence.
- **Batching:** pack 10–20 frames into one MQTT message when draining the SD backlog. TLS record overhead on an ESP32 is very real.

## Consumers: Deduplication and Packet-Loss Math

Once messages land in RabbitMQ, stateless consumers turn radio frames into clean time series. The first job is **deduplication**: in any decent deployment, several senders hear the same sensor, so the same broadcast arrives two, three or five times with different RSSI values.

The natural key is `(sensor_mac, tx_counter)`. Keep a short-lived cache (a few seconds is plenty), write the first copy, and record every sender's RSSI separately, because that per-sender RSSI is gold for diagnosing coverage.

The second job is **loss accounting**. With a 16-bit counter, wrap-around must be handled explicitly:

```ts
const lastCounter = new Map<string, number>();

export function lostSince(sensor: string, counter: number): number {
  const prev = lastCounter.get(sensor);
  lastCounter.set(sensor, counter);
  if (prev === undefined) return 0;

  const delta = (counter - prev) & 0xffff;   // handles 65535 -> 0
  if (delta === 0) return 0;                 // duplicate that escaped the cache
  if (delta > 0x8000) return 0;              // sensor rebooted / counter reset
  return delta - 1;                          // frames we never saw
}
```

That `delta > 0x8000` guard matters: when a sensor reboots, its counter restarts at zero, and a naive subtraction reports 60,000 lost packets, which is a fun way to trigger a pager alert for no reason.

Points are written to **InfluxDB** with low-cardinality tags (`sensor`, `sender`, `site`) and numeric fields (`rssi`, `battery_mv`, metrics, `lost`). Resist the temptation to tag by firmware version or schema version: make those fields, or your series cardinality grows every time you ship a release.

## Turning Raw Frames into Observability

Grafana is where the pipeline earns its keep. The panels I would build first, in order:

- **Packet loss % per sensor**, computed from summed `lost` versus received frames over 15-minute windows. A sensor slowly drifting from 1% to 8% loss is usually a battery or antenna problem weeks before it dies.
- **RSSI per sender, per sensor** as a heatmap. It instantly reveals dead zones, shifted antennas, or the forklift that is now parked in front of sender 3.
- **Receiver SD queue depth.** Flat at zero is healthy. A sawtooth means intermittent uplink. A ramp means you are about to run out of card, or the drain is broken.
- **Dropped frames in the ingest queue.** Any non-zero value means the receiver is CPU- or I/O-bound and you are losing data *before* it ever reaches the SD card.
- **Battery voltage trends** with an alert at a threshold that leaves weeks, not hours, to schedule a field visit.

A simple Flux query for the loss panel looks like this:

```js
from(bucket: "telemetry")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r._measurement == "ble_frame" and r._field == "lost")
  |> aggregateWindow(every: 15m, fn: sum, createEmpty: false)
  |> group(columns: ["sensor"])
```

## Lessons Learned

After running this kind of pipeline in production, a few principles stand out:

- **Connectionless beats connected for telemetry.** Reserve GATT connections for configuration and firmware updates, where reliability per operation matters more than battery.
- **Every hop needs its own counter.** Sensor `tx_counter`, receiver dropped-frame counter, SD queue depth, consumer lag. When data goes missing, you want to know *which* hop lost it within one glance.
- **Never block in radio callbacks.** Both BLE and ESP-NOW callbacks should copy and enqueue. Everything else belongs in a task.
- **Version everything that crosses a boundary.** The BLE payload, the ESP-NOW frame and the MQTT message each get a version byte.
- **Design for the unhappy path first.** Network drops, reboots mid-write, counter wrap-around and AP channel changes are not edge cases. In the field, they are Tuesday.

Keeping radio capture, local transport, TLS uplink and time-series storage cleanly decoupled is what makes the whole system boring to operate. And for telemetry infrastructure, boring is exactly the goal.
