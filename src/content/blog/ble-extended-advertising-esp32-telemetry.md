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

If you have ever tried polling telemetry from a fleet of battery-powered Bluetooth Low Energy (BLE) sensors using classic GATT connections, you already know how quickly the model breaks down. Connecting, discovering services, reading characteristics, and disconnecting works fine for one or two devices on your desk. Scale that up to dozens of nodes in a noisy RF environment, and you spend half your battery budget on connection handshakes and the other half fighting timeouts.

That was the exact bottleneck that pushed us toward **connectionless telemetry** built on **BLE 5.0 Extended Advertising**, bridged by **ESP32** gateways over **ESP-NOW** and **MQTTS**.

![BLE 5.0 Extended Advertising and ESP32 Telemetry Pipeline](/assets/images/blog/ble-esp32-telemetry.jpg)

## Why BLE 5.0 Extended Advertising Changes the Game

In legacy BLE 4.x, an advertising packet gives you **31 bytes** of payload. Once you subtract the flags and a short device name, you barely have room for a temperature reading.

BLE 5.0 Extended Advertising removes that ceiling by offloading the payload onto secondary advertising channels (up to **255 bytes** per PDU, or chained up to 1,650 bytes). Suddenly, a sensor can wake up, broadcast a self-contained telemetry snapshot, and go straight back to deep sleep — **zero GATT connections required**.

In practice, a single Manufacturer Specific Data frame can carry:

| Offset | Field | Size | Purpose |
| :--- | :--- | :--- | :--- |
| `0..1` | Company ID | `2 B` | Fast hardware/software scan filtering |
| `2` | Firmware & Flags | `1 B` | Active/idle state + FW revision |
| `3..4` | `tx_counter` | `2 B` | Monotonic counter for packet-loss math |
| `5..6` | Battery Voltage | `2 B` | Millivolts for proactive battery alerts |
| `7..N` | Window Metrics | `N B` | Mean, std dev, peak frequency, range |

> **Tip:** Including a monotonic `tx_counter` in every broadcast is worth its weight in gold. Without it, you can never tell whether a sensor stopped transmitting or whether your radio link is silently dropping 5% of packets.

## Splitting the Edge: ESP32 Senders + Receiver

Running Ethernet or reliable Wi-Fi to every corner of a physical site is rarely practical. Splitting the gateway layer into two roles keeps wiring simple:

1. **ESP32 BLE Senders**: Placed near the sensors. They run a continuous BLE 5.0 extended scan, filter by Company ID, attach their own MAC and measured RSSI, and fire the packet over **ESP-NOW** (connectionless 2.4 GHz peer-to-peer).
2. **ESP32 Receiver**: Sits where Ethernet or stable Wi-Fi is available, collects ESP-NOW frames from all nearby senders, and ships them over **MQTTS** (TLS-encrypted MQTT) to **RabbitMQ**.

Here is the packed struct shared between sender and receiver firmware:

```cpp
typedef struct __attribute__((packed)) {
  uint8_t  sender_mac[6];
  uint8_t  sensor_mac[6];
  int8_t   rssi;
  uint16_t tx_counter;
  uint8_t  payload_len;
  uint8_t  payload[64];
} ble_telemetry_frame_t;

void on_esp_now_recv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len != sizeof(ble_telemetry_frame_t)) return;

  ble_telemetry_frame_t frame;
  memcpy(&frame, data, sizeof(frame));
  enqueue_or_buffer_to_sd(&frame);
}
```

## Surviving Network Drops with SD Card Buffering

Field networks drop. Brokers restart. TLS handshakes occasionally stall. If your receiver only buffers frames in RAM, a 10-minute network blip means 10 minutes of lost telemetry.

Adding a microSD slot turns the receiver into a proper store-and-forward edge node:

- **When MQTTS is connected**: publish directly and advance the cursor.
- **When MQTTS is down**: append binary frames sequentially to `/queue.bin` on the SD card.
- **When MQTTS recovers**: drain `/queue.bin` in small batches (for instance, 20 frames per loop iteration) so you don't starve the Wi-Fi stack or trigger the ESP32 task watchdog.

## Turning Raw Frames into Observability

Once messages land in **RabbitMQ**, stateless consumers deduplicate frames (remember: multiple ESP32 senders often hear the same BLE sensor!) and write clean time-series points into **InfluxDB**.

From there, **Grafana** turns raw radio frames into actionable signals:

- **Packet Loss %** computed from `tx_counter` deltas per sensor
- **RSSI per Sender** to spot dead zones or shifted antennas immediately
- **Receiver SD Queue Depth** to catch flaky uplink connections before data ages out

Keeping radio capture, TLS transport, and time-series storage cleanly decoupled makes the whole pipeline easy to debug when something misbehaves at 3 AM.
