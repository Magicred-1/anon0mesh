import { Camera, CameraView } from 'expo-camera';
import { CaretLeft } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScannerModal({
  visible,
  onClose,
  onScan,
}: QRScannerModalProps) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible) {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
        setScanned(false);
        }
    }, [visible]);

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        if (!scanned) {
        setScanned(true);
        console.log('[QR Scanner] Scanned:', type, data);
        onScan(data);
        onClose();
        }
    };

    if (!visible) {
        return null;
    }

    return (
        <Modal
        visible={visible}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={onClose}
        >
        <View style={styles.container}>
            {hasPermission === null ? (
            <View style={styles.messageContainer}>
                <Text style={styles.messageText}>Requesting camera permission...</Text>
            </View>
            ) : hasPermission === false ? (
            <SafeAreaView style={styles.messageContainer}>
                <Text style={styles.messageText}>No access to camera</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
            </SafeAreaView>
            ) : (
            <>
                <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
                />
                
                {/* Overlay */}
                <View style={styles.overlay}>
                {/* Header */}
                <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.backButton}>
                            <CaretLeft size={24} color="#22D3EE" weight="regular" />
                            <Text style={styles.headerTitle}>Scan</Text>
                        </TouchableOpacity>
                        <View style={styles.placeholder} />
                    </View>
                </SafeAreaView>

                {/* Scanning Area */}
                <View style={styles.scanningArea}>
                    <View style={styles.scanFrame}>
                    {/* Corner borders */}
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                    </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructions}>
                    <Text style={styles.instructionsText}>
                    Position the QR code within the frame
                    </Text>
                </View>

                {/* Bottom padding */}
                <SafeAreaView style={styles.bottomPadding} edges={['bottom']} />
                </View>
            </>
            )}
        </View>
        </Modal>
    );
}

const SCAN_FRAME_SIZE = width * 0.7;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    headerSafeArea: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 2,
        borderBottomColor: '#22D3EE',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    placeholder: {
        width: 40,
    },
    scanningArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: SCAN_FRAME_SIZE,
        height: SCAN_FRAME_SIZE,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#22D3EE',
    },
    cornerTopLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
    },
    cornerTopRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
    },
    cornerBottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
    },
    cornerBottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
    },
    instructions: {
        paddingHorizontal: 40,
        paddingBottom: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    instructionsText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '400',
    },
    bottomPadding: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    messageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0D0D0D',
        padding: 20,
    },
    messageText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    closeButton: {
        backgroundColor: '#22D3EE',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 12,
    },
    closeButtonText: {
        color: '#0D0D0D',
        fontSize: 16,
        fontWeight: '600',
    },
});
