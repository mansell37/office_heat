import { useCallback, useEffect, useRef, useState } from "react";
import { Trainer, TrainerData, isSupported } from "./trainer";

export type TrainerStatus = "unsupported" | "idle" | "connecting" | "connected" | "error";

export interface UseTrainer {
  status: TrainerStatus;
  data: TrainerData;
  error: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setTargetPower: (watts: number) => void;
}

/** Manage a single trainer connection and surface its live data to React. */
export function useTrainer(): UseTrainer {
  const ref = useRef<Trainer | null>(null);
  const [status, setStatus] = useState<TrainerStatus>(isSupported() ? "idle" : "unsupported");
  const [data, setData] = useState<TrainerData>({});
  const [error, setError] = useState("");

  // Tear down the connection if the component using the hook unmounts.
  useEffect(() => {
    return () => {
      ref.current?.disconnect();
      ref.current = null;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    setError("");
    setStatus("connecting");
    const t = new Trainer();
    t.onData = (d) => setData((prev) => ({ ...prev, ...d }));
    t.onDisconnect = () => {
      setStatus("idle");
      setData({});
    };
    try {
      await t.connect();
      ref.current = t;
      setStatus("connected");
    } catch (e) {
      // A user cancelling the device chooser is not a real error — go back to idle.
      const msg = (e as Error).message || "Couldn't connect to the trainer.";
      if (/cancel|user/i.test(msg)) {
        setStatus("idle");
      } else {
        setError(msg);
        setStatus("error");
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    await ref.current?.disconnect();
    ref.current = null;
    setStatus("idle");
    setData({});
  }, []);

  const setTargetPower = useCallback((watts: number) => {
    ref.current?.setTargetPower(watts);
  }, []);

  return { status, data, error, connect, disconnect, setTargetPower };
}
