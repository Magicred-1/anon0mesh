import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ visible, onClose, onScanned }) => {
  const [scanned, setScanned] = useState(false);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible) {
      if (!permission?.granted) {
        requestPermission();
      }
      setScanned(false);
    }
  }, [visible, permission, requestPermission]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#181c1f', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
          {permission === null ? (
            <Text style={{ color: '#fff', fontSize: 18, marginTop: 40 }}>Requesting camera permission...</Text>
          ) : permission?.granted === false ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18, marginTop: 40, marginBottom: 16 }}>No access to camera</Text>
              <TouchableOpacity
                onPress={onClose}
                style={{ backgroundColor: '#26C6DA', padding: 16, borderRadius: 10 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              ref={cameraRef}
              style={{ width: 320, height: 320, borderRadius: 16, overflow: 'hidden' }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : (result: { data: string }) => {
                setScanned(true);
                onClose();
                onScanned(result.data);
              }}
            />
          )}
          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 32, backgroundColor: '#333', padding: 14, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default QrScannerModal;
