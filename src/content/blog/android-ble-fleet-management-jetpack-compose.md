---
title: "Managing BLE Sensors at Scale on Android with Kotlin & Jetpack Compose"
date: 2026-10-18 10:00
image: /assets/images/blog/android-ble-compose.jpg
headerImage: true
lang: en
tag:
  - android
  - kotlin
  - jetpack-compose
  - ble
  - ota
category: blog
author: mabuonomo
---

Writing an Android app that connects to one Bluetooth Low Energy (BLE) gadget is a pleasant afternoon project. Writing one that **discovers, decodes, configures, and pushes firmware updates to dozens of sensors in the field** is a very different story. Android's `BluetoothGatt` stack has sharp edges: undocumented concurrency limits, silent status `133` disconnects, and radio contention when scanning collides with GATT transfers.

Here is how to tame it cleanly using **Kotlin Coroutines**, **BLE 5.0 Extended Advertising**, and **Jetpack Compose**.

![Android BLE Fleet Management with Kotlin and Jetpack Compose](/assets/images/blog/android-ble-compose.jpg)

## 1. Zero-Connection Diagnostics via Extended Advertising

Before opening a single GATT socket, you can already inspect the entire nearby fleet right from `ScanCallback`. By requesting non-legacy PDUs, Android surfaces BLE 5.0 Extended Advertising packets directly in `ScanResult`:

```kotlin
val scanSettings = ScanSettings.Builder()
    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
    .setLegacy(false) // Essential for BLE 5.0 Extended Advertising
    .setPhy(ScanSettings.PHY_LE_ALL_SUPPORTED)
    .build()

fun parseManufacturerPayload(result: ScanResult): SensorSnapshot? {
    val bytes = result.scanRecord?.getManufacturerSpecificData(COMPANY_ID) ?: return null
    if (bytes.size < MIN_PAYLOAD_SIZE) return null

    return SensorSnapshot(
        mac = result.device.address,
        rssi = result.rssi,
        firmwareRev = bytes[0].toInt() and 0xFF,
        isActive = (bytes[1].toInt() and 0x01) == 1,
        batteryMv = ((bytes[2].toInt() and 0xFF) shl 8) or (bytes[3].toInt() and 0xFF)
    )
}
```

In the UI, each sensor card shows live RSSI strength, firmware version, and battery health immediately. Devices that stop broadcasting for more than 6 seconds automatically drop out of the active list so field operators never tap ghost entries.

## 2. Taming Parallel GATT Connections

When operators need to activate 20 sensors or push a firmware update, doing them one-by-one by hand is painful. Doing them all blindly in parallel crashes the Bluetooth stack.

Three guardrails make batch GATT operations rock-solid:

- **Enforce an RSSI floor**: Ignore devices below `-85 dBm` during bulk operations. A weak radio link will time out and drag down the entire batch.
- **Stop scanning before heavy GATT/OTA work**: Active scanning steals radio airtime. Stopping the scan before starting transfers dramatically improves throughput.
- **Serialize characteristic writes with a `Mutex`**: Android's BLE stack drops writes if you issue a second `writeCharacteristic()` before `onCharacteristicWrite()` fires.

```kotlin
class BleGattSession(private val gatt: BluetoothGatt) {
    private val writeLock = Mutex()

    suspend fun writeCommand(char: BluetoothGattCharacteristic, payload: ByteArray): Boolean =
        writeLock.withLock {
            withTimeoutOrNull(5_000) {
                awaitWriteCallback(gatt, char, payload)
            } ?: false
        }
}
```

## 3. Two-Phase OTA Firmware Updates

Over-the-air updates in the field should be boring and predictable. Splitting bulk OTA into two explicit phases prevents half-updated fleets:

1. **Pre-flight Validation**: Before opening any connection, validate the `.gbl` / binary file locally (magic header, end tag, and **CRC32** checksum) and skip any sensor already running the exact target version.
2. **Phase 1 — Transfer**: Stream firmware chunks to selected sensors, queueing transient failures for an automatic retry pass.
3. **Phase 2 — Verify & Reactivate**: Wait for sensors to reboot into application mode, reconnect briefly via GATT to confirm the new firmware version, and sync the current UNIX timestamp so recording resumes automatically.

## 4. Keeping the UI Calm with Jetpack Compose

Using `StateFlow` backed by a clean `ViewModel` lets Jetpack Compose render live progress bars, expandable ADV telemetry cards, and a final batch summary (*transferred*, *verified*, *failed*, *unreachable*) without fighting RecyclerView diffing bugs. In dark mode with high-contrast status pills, field operators can tell at a glance what succeeded and what needs another look.
