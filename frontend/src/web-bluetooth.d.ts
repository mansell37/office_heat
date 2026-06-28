/**
 * Minimal ambient declarations for the Web Bluetooth API surface this app uses.
 * The standard TS DOM lib doesn't ship Web Bluetooth types, and we'd rather not
 * pull in @types/web-bluetooth just for a handful of calls. Only the members we
 * actually touch in `trainer.ts` are declared here.
 */

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value?: DataView;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: number | string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: number | string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
  filters?: Array<{ services?: Array<number | string>; name?: string; namePrefix?: string }>;
  optionalServices?: Array<number | string>;
  acceptAllDevices?: boolean;
}

interface Bluetooth {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}
