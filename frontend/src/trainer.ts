/**
 * Web Bluetooth control of a smart trainer (Wahoo KICKR etc.) over the standard
 * FTMS — Fitness Machine Service — profile. Lets the app put the trainer in ERG
 * mode and command a target wattage per workout block, plus read live power /
 * cadence / speed back, so you can ride the workout in-app instead of bouncing it
 * through a Garmin Edge.
 *
 * Platform note: Web Bluetooth works in Chrome/Edge on desktop and Android. It is
 * NOT available in any iOS browser (Safari/WebKit). `isSupported()` reflects that.
 */

// FTMS UUIDs (16-bit, expanded by the browser to the full base UUID).
const FTMS_SERVICE = 0x1826;
const CHAR_CONTROL_POINT = 0x2ad9; // Fitness Machine Control Point (write + indicate)
const CHAR_INDOOR_BIKE_DATA = 0x2ad2; // Indoor Bike Data (notify)

// Other services a trainer may advertise. Many trainers (incl. the Wahoo KICKR)
// don't put FTMS in their advertisement packet — they advertise Cycling Power
// and their name, exposing FTMS only after you connect. So we discover broadly
// (by these services and by name) and still drive control over FTMS once connected.
const CYCLING_POWER_SERVICE = 0x1818;
const DEVICE_INFO_SERVICE = 0x180a;

// Control Point op codes.
const OP_REQUEST_CONTROL = 0x00;
const OP_START_RESUME = 0x07;
const OP_SET_TARGET_POWER = 0x05;

export interface TrainerData {
  power?: number; // watts
  cadence?: number; // rpm
  speed?: number; // km/h
}

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as { bluetooth?: unknown }).bluetooth;
}

/** Parse an FTMS "Indoor Bike Data" notification into the fields we care about. */
function parseIndoorBikeData(dv: DataView): TrainerData {
  const flags = dv.getUint16(0, true);
  let i = 2;
  const out: TrainerData = {};

  // Bit 0 = "More Data": when CLEAR, Instantaneous Speed (uint16, 0.01 km/h) is present.
  if ((flags & 0x0001) === 0) {
    out.speed = dv.getUint16(i, true) / 100;
    i += 2;
  }
  if (flags & 0x0002) i += 2; // Average Speed
  if (flags & 0x0004) {
    out.cadence = dv.getUint16(i, true) / 2; // 0.5 rpm resolution
    i += 2;
  }
  if (flags & 0x0008) i += 2; // Average Cadence
  if (flags & 0x0010) i += 3; // Total Distance (uint24)
  if (flags & 0x0020) i += 2; // Resistance Level
  if (flags & 0x0040) {
    out.power = dv.getInt16(i, true); // Instantaneous Power (watts)
    i += 2;
  }
  return out;
}

export class Trainer {
  private device: BluetoothDevice | null = null;
  private controlPoint: BluetoothRemoteGATTCharacteristic | null = null;
  private bikeData: BluetoothRemoteGATTCharacteristic | null = null;

  onData: ((d: TrainerData) => void) | null = null;
  onDisconnect: (() => void) | null = null;

  get name(): string {
    return this.device?.name || "Trainer";
  }

  get connected(): boolean {
    return !!this.device?.gatt?.connected;
  }

  /** Pair, connect, take control and put the trainer into ERG (target-power) mode. */
  async connect(): Promise<void> {
    if (!isSupported()) {
      throw new Error("Web Bluetooth isn't available in this browser. Use Chrome or Edge on a computer or Android.");
    }
    const bt = (navigator as unknown as { bluetooth: Bluetooth }).bluetooth;
    const device = await bt.requestDevice({
      // Match on any of: FTMS, Cycling Power, or a Wahoo/KICKR name — so the
      // trainer shows up in the chooser regardless of which it advertises.
      filters: [
        { services: [FTMS_SERVICE] },
        { services: [CYCLING_POWER_SERVICE] },
        { namePrefix: "KICKR" },
        { namePrefix: "Wahoo" },
      ],
      // We may only access services listed here after connecting.
      optionalServices: [FTMS_SERVICE, CYCLING_POWER_SERVICE, DEVICE_INFO_SERVICE],
    });
    this.device = device;
    device.addEventListener("gattserverdisconnected", () => {
      this.controlPoint = null;
      this.bikeData = null;
      this.onDisconnect?.();
    });

    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(FTMS_SERVICE);

    this.controlPoint = await service.getCharacteristic(CHAR_CONTROL_POINT);
    // Indications carry the trainer's accept/reject for each command. We subscribe
    // so the GATT queue stays healthy, but don't gate on the response.
    await this.controlPoint.startNotifications().catch(() => {});

    try {
      this.bikeData = await service.getCharacteristic(CHAR_INDOOR_BIKE_DATA);
      this.bikeData.addEventListener("characteristicvaluechanged", (e) => {
        const dv = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (dv) this.onData?.(parseIndoorBikeData(dv));
      });
      await this.bikeData.startNotifications();
    } catch {
      // Live data is a nice-to-have; control still works without it.
    }

    await this.write([OP_REQUEST_CONTROL]);
    await this.write([OP_START_RESUME]);
  }

  /** Command a target wattage (ERG mode). */
  async setTargetPower(watts: number): Promise<void> {
    if (!this.controlPoint) return;
    const w = Math.max(0, Math.round(watts));
    const buf = new ArrayBuffer(3);
    const dv = new DataView(buf);
    dv.setUint8(0, OP_SET_TARGET_POWER);
    dv.setInt16(1, w, true);
    await this.controlPoint.writeValue(buf).catch(() => {});
  }

  async disconnect(): Promise<void> {
    try {
      this.device?.gatt?.disconnect();
    } finally {
      this.device = null;
      this.controlPoint = null;
      this.bikeData = null;
    }
  }

  private async write(bytes: number[]): Promise<void> {
    if (!this.controlPoint) return;
    await this.controlPoint.writeValue(new Uint8Array(bytes)).catch(() => {});
  }
}
