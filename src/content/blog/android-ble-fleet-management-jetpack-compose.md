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

Writing an Android app that connects to *one* Bluetooth Low Energy (BLE) gadget is a pleasant afternoon project. Writing one that **discovers, decodes, configures and pushes firmware updates to dozens of sensors in the field** is a very different story.

Android's `BluetoothGatt` API is famously unforgiving. It has undocumented concurrency limits that vary by phone, the infamous status `133` that can mean almost anything, a callback model that silently drops operations if you issue them too fast, and radio contention when scanning collides with GATT transfers. On top of that, the people using a field app are not developers: they are technicians standing in a dusty room with gloves on, and the app has to tell them clearly what worked and what didn't.

This post describes the architecture we converged on for a fleet-management app built with **Kotlin Coroutines**, **BLE 5.0 Extended Advertising** and **Jetpack Compose**: passive diagnostics without connections, safe batch GATT operations, a two-phase OTA pipeline, and a UI that stays calm while dozens of things happen at once.

![Android BLE Fleet Management with Kotlin and Jetpack Compose](/assets/images/blog/android-ble-compose.jpg)

## Architecture: Keep the Radio Behind One Door

The most important decision is structural: **exactly one component talks to the Bluetooth stack**. Every screen, every batch job, every OTA run goes through it. Android's BLE stack is a shared, stateful, single-radio resource, and letting multiple ViewModels open GATT connections independently is the fastest way to discover its undocumented limits.

```text
 Compose UI  ──▶  FleetViewModel (StateFlow<FleetUiState>)
                        │
                        ▼
                 FleetRepository ──────────────┐
                   │          │                │
                   ▼          ▼                ▼
             BleScanner   GattSessionPool   OtaOrchestrator
                   │          │                │
                   └──────────┴───── BleRadioCoordinator (scan ⇄ GATT arbitration)
```

- **`BleScanner`** exposes scan results as a cold `Flow`.
- **`GattSessionPool`** owns all GATT connections, enforces a concurrency limit, and serialises operations per device.
- **`OtaOrchestrator`** runs the multi-phase firmware pipeline on top of the pool.
- **`BleRadioCoordinator`** decides who gets the radio: it pauses scanning during heavy GATT work and resumes it afterwards.

Behind interfaces, all four are trivial to fake in unit tests, which matters more than it sounds: you really don't want to debug batch-retry logic by walking around with a phone.

## Permissions: Get Them Right Once

Since Android 12 (API 31), BLE uses dedicated runtime permissions instead of piggybacking on location:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation"
    tools:targetApi="s" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Legacy devices (Android 11 and below) still need location for scanning -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
```

Be careful with `neverForLocation`: when it is set, Android may filter out some advertisements (notably beacon-style ones) from scan results. If your sensors look like beacons, drop the flag and request location properly.

## 1. Zero-Connection Diagnostics via Extended Advertising

Before opening a single GATT socket, you can already inspect the whole nearby fleet. Our sensors broadcast their status in **BLE 5.0 extended advertisements**: firmware revision, active state and battery voltage, all inside Manufacturer Specific Data.

By default, Android only reports *legacy* advertisements. You have to explicitly opt into extended ones, and check that the phone supports them:

```kotlin
val adapter = context.getSystemService(BluetoothManager::class.java).adapter
val supportsExtended = adapter.isLeExtendedAdvertisingSupported
val supportsCoded = adapter.isLeCodedPhySupported

val scanSettings = ScanSettings.Builder()
    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
    .setLegacy(false)                                  // essential for BLE 5.0 extended advertising
    .setPhy(ScanSettings.PHY_LE_ALL_SUPPORTED)
    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
    .build()

val filters = listOf(
    ScanFilter.Builder()
        .setManufacturerData(COMPANY_ID, byteArrayOf(), byteArrayOf())
        .build()
)
```

The filter matters for two reasons. It offloads matching to the controller on many chipsets (saving battery), and Android **refuses to deliver results while the screen is off unless a non-empty filter is set**. A field app whose scanning stops when the phone auto-locks is a guaranteed support ticket.

Wrapping the callback API in a `callbackFlow` gives us a clean, cancellable stream:

```kotlin
@SuppressLint("MissingPermission")
fun scan(): Flow<ScanResult> = callbackFlow {
    val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            trySend(result)
        }
        override fun onScanFailed(errorCode: Int) {
            close(BleScanException(errorCode))
        }
    }
    scanner.startScan(filters, scanSettings, callback)
    awaitClose { scanner.stopScan(callback) }
}
```

Parsing is plain byte work, but always validate before trusting anything coming from the air:

```kotlin
fun parseManufacturerPayload(result: ScanResult): SensorSnapshot? {
    val bytes = result.scanRecord?.getManufacturerSpecificData(COMPANY_ID) ?: return null
    if (bytes.size < MIN_PAYLOAD_SIZE) return null
    if (result.dataStatus != ScanResult.DATA_COMPLETE) return null   // truncated chain

    return SensorSnapshot(
        mac = result.device.address,
        rssi = result.rssi,
        firmwareRev = bytes[0].toInt() and 0xFF,
        isActive = (bytes[1].toInt() and 0x01) == 1,
        batteryMv = ((bytes[2].toInt() and 0xFF) shl 8) or (bytes[3].toInt() and 0xFF),
        seenAtNanos = result.timestampNanos,
    )
}
```

### Expiring ghost devices

BLE has no "device left" event. A sensor that walks out of range (or whose battery dies) simply stops appearing. We keep a map of the latest snapshot per MAC and periodically prune anything not seen for more than **6 seconds**, comparing against `SystemClock.elapsedRealtimeNanos()`, which is the same monotonic clock as `ScanResult.timestampNanos`:

```kotlin
val fleet: StateFlow<List<SensorSnapshot>> = scan()
    .mapNotNull(::parseManufacturerPayload)
    .runningFold(emptyMap<String, SensorSnapshot>()) { acc, s -> acc + (s.mac to s) }
    .combine(tickerFlow(1.seconds)) { map, _ ->
        val now = SystemClock.elapsedRealtimeNanos()
        map.values.filter { now - it.seenAtNanos < STALE_AFTER.inWholeNanoseconds }
    }
    .map { list -> list.sortedByDescending { it.rssi } }
    .stateIn(scope, SharingStarted.WhileSubscribed(5_000), emptyList())
```

The result: each sensor card shows live RSSI, firmware version and battery health immediately, and operators never tap on ghost entries.

### Don't fight scan throttling

Since Android 7, the system silently stops delivering results if an app **starts scanning more than 5 times in 30 seconds**. There is no error; results just stop arriving. If your UI restarts the scan on every screen resume or filter change, you will hit this limit. Keep one long-lived scan in the repository and filter results in memory instead.

## 2. Taming Parallel GATT Connections

When operators need to activate 20 sensors or push configuration to a whole room, doing it one by one by hand is painful. Doing it all blindly in parallel crashes the Bluetooth stack, often in a way that requires toggling Bluetooth off and on to recover.

Four guardrails make batch GATT operations reliable.

**Enforce an RSSI floor.** Exclude devices below about `-85 dBm` from bulk operations. A weak link will time out, retry, and hold a connection slot for 30 seconds while doing nothing useful. The UI marks them as *"move closer"* rather than failing them.

**Limit concurrency with a `Semaphore`.** Phones support a limited number of simultaneous BLE connections, and the real number varies wildly by chipset and Android version. Assume **4** is safe and tune from there:

```kotlin
class GattSessionPool(private val maxConcurrent: Int = 4) {
    private val slots = Semaphore(maxConcurrent)

    suspend fun <T> withSession(device: BluetoothDevice, block: suspend (GattSession) -> T): T =
        slots.withPermit {
            val session = connectWithRetry(device)
            try {
                block(session)
            } finally {
                session.disconnectAndClose()   // ALWAYS close, or you leak a client slot
            }
        }
}
```

**Stop scanning before heavy GATT work.** Active scanning steals radio airtime from connections. Pausing the scan during OTA transfers easily doubles throughput on many phones. The `BleRadioCoordinator` handles this with a reference count: the scan pauses while at least one heavy operation is running.

**Serialise operations per connection.** Android's GATT client can only have **one outstanding operation per connection**. Call `writeCharacteristic()` again before `onCharacteristicWrite()` fires and the second write is silently rejected. A `Mutex` combined with a suspending wrapper over the callback makes this impossible to get wrong:

```kotlin
class GattSession(private val gatt: BluetoothGatt, private val callbacks: GattCallbackBridge) {
    private val opLock = Mutex()

    @SuppressLint("MissingPermission")
    suspend fun write(char: BluetoothGattCharacteristic, payload: ByteArray): Boolean =
        opLock.withLock {
            withTimeoutOrNull(5.seconds) {
                val pending = callbacks.expectWrite(char.uuid)
                val status = gatt.writeCharacteristic(
                    char, payload, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                )
                status == BluetoothStatusCodes.SUCCESS && pending.await() == BluetoothGatt.GATT_SUCCESS
            } ?: false
        }
}
```

The `GattCallbackBridge` turns `BluetoothGattCallback` methods into `CompletableDeferred`s keyed by characteristic UUID. Note that the newer `writeCharacteristic(char, value, writeType)` overload (API 33+) returns a status code and takes the value as a parameter: prefer it over mutating `characteristic.value`, which is deprecated and racy.

### Living with status 133

`GATT_ERROR` (133) is Android's generic "something went wrong in the stack" code. In practice, the reliable mitigations are:

- Always connect with `autoConnect = false` and `BluetoothDevice.TRANSPORT_LE` for direct, fast connections.
- **Always call `close()`**, not just `disconnect()`, when you are done or when a connection fails. Leaked `BluetoothGatt` objects consume client slots until the process dies.
- Retry with a short backoff (for example 300 ms, 1 s, 2 s), and a fresh `BluetoothGatt` object each time.
- Wait a moment after a disconnect before reconnecting to the same device. Immediate reconnects are a classic 133 trigger.

After connecting, two calls make a big difference for anything beyond small writes: `requestMtu(247)` to send larger packets, and `requestConnectionPriority(CONNECTION_PRIORITY_HIGH)` during transfers to shorten the connection interval.

## 3. Two-Phase OTA Firmware Updates

Over-the-air updates in the field should be boring and predictable. The worst possible outcome is a half-updated fleet with no clear record of which sensors are on which version. Splitting bulk OTA into explicit phases prevents exactly that.

### Pre-flight validation (no radio involved)

Before opening any connection, validate the firmware file locally. For Silicon Labs `.gbl` images that means checking the header tag, finding the end tag, and verifying the **CRC32** it carries. For other formats, the idea is the same: never stream a corrupt file to fifty devices.

Then filter the target list:

- Skip any sensor already advertising the target version (we know this from the scan, without connecting).
- Skip sensors below the RSSI floor and report them as *unreachable*.
- Skip sensors whose advertised battery is below a safe threshold. A sensor that browns out mid-flash is the most expensive kind of failure.

### Phase 1: transfer

Firmware is streamed in chunks sized to the negotiated MTU (MTU minus 3 bytes of ATT header). For throughput, chunks are sent as **write without response**, but with flow control: on API 33+, `writeCharacteristic` returns `ERROR_GATT_WRITE_REQUEST_BUSY` when the stack's buffer is full, which is the signal to back off briefly and retry rather than drop data.

```kotlin
suspend fun streamImage(session: GattSession, image: ByteArray, mtu: Int, onProgress: (Float) -> Unit) {
    val chunkSize = mtu - 3
    var offset = 0
    while (offset < image.size) {
        val end = minOf(offset + chunkSize, image.size)
        session.writeNoResponseWithBackpressure(dataChar, image.copyOfRange(offset, end))
        offset = end
        onProgress(offset.toFloat() / image.size)
    }
}
```

Transient failures (timeouts, 133s, disconnects) don't fail the batch: the sensor goes into a **retry queue** that is processed after the first pass, once the radio is less busy. Only sensors that fail the retry pass are reported as failed.

### Phase 2: verify and reactivate

A successful transfer does not mean a successful update. After flashing, the sensor reboots into the new application, and only then do we know whether it actually boots.

The verification phase:

1. Restart scanning and wait for each sensor to reappear with the **new firmware revision in its advertisement**. This alone verifies most devices without a connection.
2. For each verified device, connect briefly to **sync the current UNIX timestamp** and reactivate recording, so data collection resumes without a second visit.
3. Devices that don't reappear within a timeout are flagged for manual attention, with their last known RSSI and battery level to help the technician find out why.

This split means a technician can start an update for a whole room, walk away, and come back to an unambiguous result: *transferred*, *verified*, *failed* or *unreachable*.

## 4. Keeping the UI Calm with Jetpack Compose

A batch operation on thirty devices produces hundreds of state changes per minute. The UI has to show all of it without flickering, jumping or lagging.

The ViewModel exposes a single immutable state object:

```kotlin
data class FleetUiState(
    val sensors: List<SensorCardState> = emptyList(),
    val batch: BatchProgress? = null,
    val summary: BatchSummary? = null,
)

data class BatchSummary(
    val transferred: Int,
    val verified: Int,
    val failed: List<String>,
    val unreachable: List<String>,
)
```

And the screen renders it with stable keys, so Compose can update a single card instead of recomposing the whole list:

```kotlin
@Composable
fun FleetScreen(viewModel: FleetViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        state.batch?.let { item(key = "batch") { BatchProgressCard(it) } }
        items(state.sensors, key = { it.mac }) { sensor ->
            SensorCard(sensor, modifier = Modifier.animateItem())
        }
        state.summary?.let { item(key = "summary") { BatchSummaryCard(it) } }
    }
}
```

A few details that made a real difference for field operators:

- **`collectAsStateWithLifecycle()`** stops collection when the app is backgrounded, which avoids wasted work and battery.
- **Throttle high-frequency updates.** RSSI changes several times per second; sampling the fleet flow at about 2 Hz keeps the list readable and cuts recompositions dramatically.
- **Status pills with icons, not just colours.** Green/red alone fails for colour-blind users and in direct sunlight. Each state gets a distinct icon and label.
- **Dark mode by default.** Many installation sites are dimly lit, and a bright white screen at full brightness is painful.
- **Expandable ADV cards** show the raw decoded advertisement for support staff, hidden by default so operators aren't overwhelmed.
- **An exportable batch report** (shared as text or CSV), so results can be attached to a ticket without screenshots.

## Testing Without a Room Full of Sensors

The architecture pays off in testing. Because the radio sits behind `BleScanner` and `GattSessionPool` interfaces, the OTA orchestrator, retry logic and batch summaries are tested with fakes that simulate realistic chaos: random 133s, devices that disappear mid-transfer, sensors that reboot with the old version, phones that only allow two concurrent connections.

Combined with `kotlinx-coroutines-test` and virtual time, a test that simulates a 30-minute batch update across 40 devices runs in milliseconds. Real hardware testing is still essential, but it becomes a confirmation step instead of the only way to find bugs.

## Lessons Learned

- **One owner for the radio.** Centralise all BLE access behind a coordinator that arbitrates between scanning and GATT.
- **Read before you connect.** Extended advertising answers most "what state is this device in?" questions without a single connection.
- **Assume the stack is fragile.** Serialise per-connection operations, limit concurrency, always `close()`, and treat 133 as retryable.
- **Make OTA multi-phase.** Validate offline, transfer with retries, verify by observation, and report each device's outcome explicitly.
- **Design the UI for the person holding the phone**, not for the developer: clear states, readable summaries, and no ghost devices.

Android BLE has a reputation for being painful, and it is earned. But with coroutines to structure the asynchrony, a strict concurrency model, and Compose to render complex state simply, managing a whole fleet of sensors from a phone becomes not just possible but pleasant.
