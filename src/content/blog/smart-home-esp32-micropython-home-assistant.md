---
title: "Smart Home Automation Beyond YAML: ESP32, MicroPython & Home Assistant"
date: 2026-08-30 10:00
image: /assets/images/blog/smarthome-esp32-ha.jpg
headerImage: true
lang: en
tag:
  - smart-home
  - home-assistant
  - esp32
  - micropython
  - arduino
category: blog
author: mabuonomo
---

Commercial smart home gadgets are great until you realise your hallway light needs a round trip to a server on another continent just to turn on. Or worse, until it stops working entirely the day the vendor sunsets its app, changes its API terms, or goes out of business.

Pairing **Home Assistant** with inexpensive **ESP32** boards running **Arduino** or **MicroPython** gives you local-first automation with sub-second latency, no cloud lock-in, and full control over every sensor and relay in the house. A board that costs a few euros, a sensor that costs a few more, and an evening of tinkering get you a device that does exactly what you want, and keeps doing it for years.

This post goes beyond the "blink an LED over Wi-Fi" stage: how to structure a home built on ESP32 nodes, how to make them register themselves in Home Assistant, how to write firmware that survives Wi-Fi drops and power cuts, and the design rules that keep a smart home from becoming an annoying one.

![Smart Home Automation with ESP32, MicroPython and Home Assistant](/assets/images/blog/smarthome-esp32-ha.jpg)

## The Architecture: Small, Local, Boring

The whole system rests on three pieces, all running inside the house:

```text
 ┌───────────────┐      MQTT       ┌─────────────────┐      MQTT      ┌──────────────────┐
 │ ESP32 nodes   │ ◀─────────────▶ │ Mosquitto broker│ ◀────────────▶ │  Home Assistant  │
 │ (sensors,     │  (Wi-Fi, LAN)   │ (on HA host)    │                │ (automations, UI)│
 │  relays)      │                 └─────────────────┘                └──────────────────┘
 └───────────────┘
```

- **ESP32 nodes** read sensors and drive relays. Each one does a single, well-defined job: *study climate*, *front door contact*, *garden irrigation valves*.
- **Mosquitto**, the MQTT broker, routes messages between nodes and Home Assistant. It runs as a Home Assistant add-on or as a container next to it.
- **Home Assistant** handles everything that spans more than one device: scenes, presence, schedules, notifications and dashboards.

MQTT is the glue because it is tiny, well supported on microcontrollers, and decouples everything. A node doesn't know or care whether Home Assistant is running; it publishes state and listens for commands. Home Assistant can restart for an update without any node noticing.

> **Why not just use ESPHome?** ESPHome is excellent, and for standard sensors it is often the fastest path: YAML in, firmware out, native Home Assistant integration. Writing your own firmware makes sense when you need custom logic at the edge, unusual hardware, BLE scanning, tight power budgets, or simply want to understand and own every line. The patterns in this post apply to both.

## Arduino (C++) vs. MicroPython on the ESP32

You don't have to choose one forever. Each shines in different corners of the house, and I run both side by side.

| | Arduino / C++ (or ESP-IDF) | MicroPython |
| :--- | :--- | :--- |
| **Iteration speed** | Compile and flash: 30–90 s | Edit and run instantly via REPL |
| **Timing precision** | Microseconds, hardware interrupts | Milliseconds; GC pauses possible |
| **Deep sleep current** | Lowest achievable | Good, but slower boot to Python |
| **Memory headroom** | Plenty | Python heap is the constraint |
| **Libraries** | Huge ecosystem | Smaller, but covers common sensors |
| **Best for** | Battery nodes, BLE, precise timing | Mains-powered sensors, prototyping |

My rule of thumb: **mains-powered nodes that read slow-changing values** (temperature, humidity, CO₂, light levels) run MicroPython, because I can connect via USB or WebREPL and tweak a threshold or filter in seconds. **Battery-powered nodes, anything with interrupts, and BLE scanners** run C++, because every millisecond awake costs battery and every microsecond of jitter matters.

## Zero-Config Entities with MQTT Discovery

One of Home Assistant's nicest features is **MQTT Discovery**. Instead of maintaining hundreds of lines of sensor definitions in `configuration.yaml`, each node announces itself on boot by publishing a retained JSON config to a well-known topic:

```text
homeassistant/<component>/<object_id>/config
```

Home Assistant sees the message, creates the entity, and, if the payload includes a `device` block, groups all of a node's entities under a single device card with its model, firmware version and a link to its configuration page.

Here is a complete, production-grade MicroPython node for a study climate sensor. It is longer than a quick demo, because the extra lines are exactly the ones that make it reliable:

```python
import json
import time
import machine
import network
from umqtt.simple import MQTTClient
from secrets import WIFI_SSID, WIFI_PASS, MQTT_HOST, MQTT_USER, MQTT_PASS

NODE_ID = "esp32_study"
BASE = "home/study"
AVAIL_TOPIC = BASE + "/status"
STATE_TOPIC = BASE + "/climate"

DEVICE = {
    "identifiers": [NODE_ID],
    "name": "Study Climate Node",
    "manufacturer": "DIY",
    "model": "ESP32 + SHT31",
    "sw_version": "1.4.0",
}

def discovery(key, name, unit, device_class):
    return {
        "name": name,
        "unique_id": f"{NODE_ID}_{key}",
        "state_topic": STATE_TOPIC,
        "value_template": "{{ value_json.%s }}" % key,
        "availability_topic": AVAIL_TOPIC,
        "unit_of_measurement": unit,
        "device_class": device_class,
        "state_class": "measurement",
        "expire_after": 600,
        "device": DEVICE,
    }

def connect_wifi(timeout_s=20):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        wlan.connect(WIFI_SSID, WIFI_PASS)
        start = time.time()
        while not wlan.isconnected():
            if time.time() - start > timeout_s:
                raise OSError("wifi timeout")
            time.sleep_ms(250)
    return wlan

def connect_mqtt():
    client = MQTTClient(NODE_ID, MQTT_HOST, user=MQTT_USER, password=MQTT_PASS,
                        keepalive=60)                       # required for LWT to fire!
    client.set_last_will(AVAIL_TOPIC, b"offline", retain=True, qos=1)
    client.connect()
    for key, name, unit, cls in (
        ("temperature", "Study Temperature", "°C", "temperature"),
        ("humidity", "Study Humidity", "%", "humidity"),
    ):
        topic = f"homeassistant/sensor/{NODE_ID}_{key}/config"
        client.publish(topic, json.dumps(discovery(key, name, unit, cls)), retain=True)
    client.publish(AVAIL_TOPIC, b"online", retain=True)
    return client
```

Three details in this snippet deserve attention.

**`keepalive=60` is not optional.** The Last Will and Testament (LWT) is published by the broker when it detects that a client has disappeared, and it detects that through missed keepalive pings. With the `umqtt.simple` default of `keepalive=0`, the broker never expects a ping, so a node that loses power may be considered "online" forever. Many tutorials miss this, and it is the reason their "availability" never seems to work.

**`set_last_will(..., retain=True)`** means that if the node drops off Wi-Fi, the broker publishes `offline` to `home/study/status` and keeps it there. Home Assistant marks the entities `unavailable` instead of silently showing a reading from three hours ago. And because the online message is also retained, Home Assistant knows the correct state even right after its own restart.

**`expire_after: 600`** is a second safety net: if no new state arrives within ten minutes, Home Assistant marks the value as unavailable even if the broker still thinks the node is alive (for example, a frozen sensor bus with a working Wi-Fi stack).

## Firmware That Survives Real Life

A smart home node runs unattended for months. It will see Wi-Fi drops, router reboots, broker restarts, brownouts, and sensors that occasionally return garbage. The main loop has to assume all of that:

```python
from sensors import read_sht31   # returns (temp_c, rh) or raises OSError

def median(values):
    s = sorted(values)
    return s[len(s) // 2]

def main():
    wdt = machine.WDT(timeout=30_000)      # reboot if the loop ever hangs
    client = None
    last_sent = {"temperature": None, "humidity": None}
    last_publish = 0
    samples_t, samples_h = [], []

    while True:
        wdt.feed()
        try:
            if client is None:
                connect_wifi()
                client = connect_mqtt()

            t, h = read_sht31()
            samples_t.append(t); samples_h.append(h)
            samples_t, samples_h = samples_t[-5:], samples_h[-5:]

            temp, hum = round(median(samples_t), 1), round(median(samples_h))
            changed = (last_sent["temperature"] is None
                       or abs(temp - last_sent["temperature"]) >= 0.2
                       or abs(hum - last_sent["humidity"]) >= 2)
            heartbeat_due = time.time() - last_publish > 300

            if changed or heartbeat_due:
                payload = json.dumps({"temperature": temp, "humidity": hum})
                client.publish(STATE_TOPIC, payload, retain=True)
                last_sent = {"temperature": temp, "humidity": hum}
                last_publish = time.time()

            client.ping()                      # keeps the keepalive contract
        except OSError as exc:
            print("network/sensor error:", exc)
            try:
                if client:
                    client.disconnect()
            except Exception:
                pass
            client = None
            time.sleep(5)                      # simple backoff before reconnecting
        time.sleep(10)

main()
```

The patterns that matter:

- **Hardware watchdog.** `machine.WDT` reboots the board if the loop stops feeding it, for example after a stuck I²C transaction. A node that reboots itself is infinitely better than one that silently freezes.
- **Reconnect from scratch** on any network error, with a backoff. Trying to "repair" a half-broken socket is not worth the complexity.
- **Median filter** over the last five readings removes the occasional spike that cheap sensors produce. A single 85 °C reading should not trigger your "fire!" automation.
- **Deadband plus heartbeat.** Publish when the value changes meaningfully, *and* at least every five minutes regardless. You get low traffic and clean graphs, without Home Assistant ever wondering whether the node is still alive.

## Arduino for the Fast and the Frugal

For a door contact, MicroPython works, but C++ gives you hardware interrupts and much faster wake-up from deep sleep. Here is the core of a reed switch node using `PubSubClient`, with proper debouncing:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

constexpr int REED_PIN = 4;
constexpr uint32_t DEBOUNCE_MS = 50;

volatile bool edgeSeen = false;
WiFiClient net;
PubSubClient mqtt(net);

void IRAM_ATTR onReedChange() { edgeSeen = true; }   // keep ISRs tiny

void setup() {
  pinMode(REED_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(REED_PIN), onReedChange, CHANGE);
  connectWifiAndMqtt();   // sets LWT, publishes discovery for a binary_sensor
}

void loop() {
  static int lastStable = -1;
  static uint32_t edgeAt = 0;

  if (!mqtt.connected()) connectWifiAndMqtt();
  mqtt.loop();

  if (edgeSeen) { edgeSeen = false; edgeAt = millis(); }
  if (edgeAt && millis() - edgeAt > DEBOUNCE_MS) {
    edgeAt = 0;
    int state = digitalRead(REED_PIN);
    if (state != lastStable) {
      lastStable = state;
      mqtt.publish("home/front_door/contact", state ? "ON" : "OFF", true);
    }
  }
}
```

The interrupt only sets a flag; the actual debounce and publish happen in `loop()`. Doing network I/O inside an ISR is one of the most common causes of random ESP32 crashes.

For battery-powered contacts, the same idea works with **deep sleep and an `ext0` wake-up** on the reed pin: the board sleeps at a few microamps, wakes when the door opens, connects, publishes, and goes back to sleep. With a static IP and a saved Wi-Fi channel/BSSID, the whole wake-connect-publish cycle can drop to well under a second, which makes a pair of AA batteries last for many months.

## Commands, Relays and the Retained-Message Trap

Sensors publish; relays also need to *receive* commands. Home Assistant's MQTT `switch` and `light` entities use a `command_topic` for commands and a `state_topic` for confirmed state. The node subscribes to the command topic, drives the relay, and publishes the new state back.

There is one classic trap here: **never publish commands with `retain=True`**. A retained `ON` on `home/garden/valve/set` will be redelivered every time the node reconnects, so a Wi-Fi blip at 3 AM turns the irrigation back on. Retain *state* topics (so Home Assistant knows the current state after a restart), never *command* topics.

Equally important: **decide the safe boot state for every relay.** After a power cut, should the boiler relay be on or off? Should the garden valve be open? The answer is almost always "off", and it should be enforced in firmware *before* Wi-Fi even connects, not left to whatever the GPIO does at power-up. Choose relay modules and pins that don't glitch high during boot; several ESP32 strapping pins do exactly that.

## Letting Home Assistant Orchestrate

With nodes reliably publishing data, Home Assistant automations become short and readable. For example, a study that turns on the dehumidifier when humidity stays high, but only when someone is home:

```yaml
automation:
  - alias: "Study: dehumidify when humid and occupied"
    trigger:
      - platform: numeric_state
        entity_id: sensor.study_climate_node_study_humidity
        above: 65
        for: "00:10:00"
    condition:
      - condition: state
        entity_id: group.family
        state: home
    action:
      - service: switch.turn_on
        target:
          entity_id: switch.study_dehumidifier
      - wait_for_trigger:
          - platform: numeric_state
            entity_id: sensor.study_climate_node_study_humidity
            below: 55
        timeout: "02:00:00"
      - service: switch.turn_off
        target:
          entity_id: switch.study_dehumidifier
```

Note the `for: "00:10:00"`: hysteresis in time, combined with different on/off thresholds (65% vs 55%), prevents the dehumidifier from cycling every few minutes around a single threshold. This is the kind of logic that belongs in Home Assistant, because it combines data from several devices and people.

## Security: Local Doesn't Mean Unprotected

A home network full of microcontrollers deserves a little defensive design:

- **One MQTT user per node**, with **Mosquitto ACLs** restricting each to its own topic subtree. A compromised plug should not be able to publish commands to your front door lock.
- **A separate IoT VLAN or SSID**, with no internet access for devices that don't need it, and no route from IoT devices to your laptops and NAS.
- **TLS for MQTT** if anything crosses an untrusted network segment. On a dedicated local VLAN it is often an acceptable trade-off to skip it on tiny nodes, but make that a conscious choice.
- **Keep secrets out of source control.** A `secrets.py` (MicroPython) or `secrets.h` (Arduino) excluded via `.gitignore` is enough.
- **OTA updates** (ArduinoOTA, or `mpremote`/WebREPL for MicroPython) protected by a password, so firmware fixes don't require climbing a ladder with a USB cable.

## Three Rules for a Home That Never Annoys You

After years of living in a house full of DIY nodes, the rules that matter most are not technical. They are about not making daily life worse.

1. **Local-first, always.** Automations should keep working when your ISP goes down. Cloud integrations are fine for notifications and remote access, never for turning on a light.
2. **Fail-safe hardware.** Physical wall switches must keep working if Wi-Fi, the router or Home Assistant is rebooting. Wire the switch to the ESP32 input, toggle the relay locally, and *then* publish the new state. Home Assistant observes and enhances; it is never a single point of failure for basic functions.
3. **Smart at the edge, clever in the hub.** Let the ESP32 filter noisy readings, debounce contacts and enforce safe states. Let Home Assistant orchestrate cross-room scenes, presence, schedules and notifications.

And a bonus rule from experience: **if a family member has to ask why the house did something, the automation is too clever.** The best automations are the ones nobody notices.

## Wrapping Up

The combination of ESP32, MicroPython or Arduino, MQTT and Home Assistant is one of the most satisfying stacks in hobby engineering. The hardware is cheap, the software is open, and the result is a home that responds instantly and keeps working regardless of what happens to any cloud service.

The difference between a weekend demo and a system you can live with comes down to the unglamorous details: keepalives and Last Wills, watchdogs and reconnect loops, debounce and hysteresis, safe boot states and non-retained commands. Get those right, and the first time you plug in a new node and watch it appear in Home Assistant, fully configured, in under a second, it is very hard to go back to closed-source hubs.
