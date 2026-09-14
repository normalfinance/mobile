// Full-screen QR scanner for the Send form (expo-camera 17, CameraView with
// barcodeScannerSettings). The camera stays mounted only while the sheet is
// open, one scan is reported, then it closes — no continuous decode loop.

import React from "react";
import { Linking, Modal, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { XStack, YStack } from "tamagui";
import { X } from "lucide-react-native";

import { IconButton, PrimaryButton, SecondaryButton, UiText } from "@/components/home/primitives";
import { radius, space } from "@/lib/theme/tokens";

export const QrScanner = ({
  open,
  onClose,
  onScan
}: {
  open: boolean;
  onClose: () => void;
  /** Return an error string to keep scanning (shown under the frame), or nothing to accept. */
  onScan: (data: string) => string | void;
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = React.useState<string | null>(null);
  const lastRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      lastRef.current = null;
      if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handle = ({ data }: BarcodeScanningResult) => {
    if (!data || data === lastRef.current) return; // the camera fires repeatedly for the same code
    lastRef.current = data;
    const err = onScan(data);
    if (err) {
      setError(err);
      setTimeout(() => {
        if (lastRef.current === data) lastRef.current = null;
      }, 1500);
    }
  };

  return (
    <Modal visible={open} animationType='slide' onRequestClose={onClose}>
      <YStack flex={1} backgroundColor='#000'>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing='back'
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handle}
          />
        ) : null}

        <YStack flex={1} paddingTop={56} paddingHorizontal={space.gutter} paddingBottom={40}>
          <XStack justifyContent='space-between' alignItems='center'>
            <UiText fontSize={16} fontWeight='600' color='#FFF'>
              Scan address
            </UiText>
            <IconButton onPress={onClose} label='Close'>
              <X size={22} color='#FFF' strokeWidth={2} />
            </IconButton>
          </XStack>

          <YStack flex={1} alignItems='center' justifyContent='center' gap={16}>
            {permission?.granted ? (
              <>
                <YStack
                  width={240}
                  height={240}
                  borderRadius={radius.card}
                  borderWidth={2}
                  borderColor={error ? "#FF7A7A" : "rgba(255,255,255,0.9)"}
                />
                <UiText fontSize={13} color={error ? "#FF7A7A" : "rgba(255,255,255,0.7)"} textAlign='center'>
                  {error ?? "Point the camera at a Stellar address QR code"}
                </UiText>
              </>
            ) : permission === null ? null : (
              <YStack gap={12} alignItems='center' paddingHorizontal={16}>
                <UiText fontSize={15} fontWeight='500' color='#FFF' textAlign='center'>
                  Camera access is needed to scan QR codes
                </UiText>
                <UiText fontSize={13} color='rgba(255,255,255,0.7)' textAlign='center'>
                  {permission.canAskAgain
                    ? "Allow camera access to scan an address."
                    : "Camera access was denied. Enable it in Settings to scan."}
                </UiText>
                <YStack width={240} gap={8}>
                  {permission.canAskAgain ? (
                    <PrimaryButton label='Allow camera' onPress={() => void requestPermission()} />
                  ) : (
                    <PrimaryButton label='Open Settings' onPress={() => void Linking.openSettings()} />
                  )}
                  <SecondaryButton label='Cancel' onPress={onClose} />
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>
      </YStack>
    </Modal>
  );
};
