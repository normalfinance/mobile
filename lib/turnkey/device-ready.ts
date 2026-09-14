// "Has THIS phone proven it can sign for THIS wallet?" — remembered per device,
// per wallet, so the setup prompt shows once and money actions can gate on it.
// Set after a successful passkey signature here, after device enrolment, or
// after creating the wallet on this phone. Cleared never (a new phone has its
// own storage; a wiped phone starts over, correctly).

import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

const key = (subOrgId: string) => `device_ready:${subOrgId}`;

export const isDeviceReady = async (subOrgId: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(key(subOrgId))) === "1";
  } catch {
    return false;
  }
};

export const markDeviceReady = async (subOrgId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key(subOrgId), "1");
  } catch {
    /* non-fatal: the next signature marks it again */
  }
  listeners.forEach((l) => l(subOrgId));
};

const listeners = new Set<(subOrgId: string) => void>();

/** `ready` is null while loading; false = never verified on this phone. */
export const useDeviceReady = (subOrgId: string | null | undefined) => {
  const [ready, setReady] = React.useState<boolean | null>(null);

  const refresh = React.useCallback(async () => {
    if (!subOrgId) {
      setReady(null);
      return;
    }
    setReady(await isDeviceReady(subOrgId));
  }, [subOrgId]);

  React.useEffect(() => {
    void refresh();
    const onMark = (id: string) => {
      if (id === subOrgId) setReady(true);
    };
    listeners.add(onMark);
    return () => {
      listeners.delete(onMark);
    };
  }, [refresh, subOrgId]);

  return { ready, refresh };
};
