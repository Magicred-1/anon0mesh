package com.anon0mesh.bleadvertiser

import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.*

class BLEAdvertiserModule : Module() {
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var advertiseCallback: AdvertiseCallback? = null
    private var gattServer: BluetoothGattServer? = null
    
    private val SERVICE_UUID = UUID.fromString("0000180F-0000-1000-8000-00805f9b34fb")
    private val CHARACTERISTIC_UUID = UUID.fromString("00002A19-0000-1000-8000-00805f9b34fb")
    
    companion object {
        private const val TAG = "BLEAdvertiser"
    }
    
    override fun definition() = ModuleDefinition {
        Name("BLEAdvertiser")
        
        OnCreate {
            val bluetoothManager = appContext.reactContext?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            bluetoothAdapter = bluetoothManager?.adapter
            advertiser = bluetoothAdapter?.bluetoothLeAdvertiser
            Log.d(TAG, "Expo module initialized")
        }
        
        AsyncFunction("isAdvertisingSupported") {
            val supported = advertiser != null && 
                           bluetoothAdapter?.isEnabled == true &&
                           bluetoothAdapter?.isMultipleAdvertisementSupported == true
            return@AsyncFunction supported
        }
        
        AsyncFunction("startAdvertising") { deviceId: String ->
            if (advertiser == null) {
                throw Exception("BLE advertising not supported")
            }
            
            advertiser?.stopAdvertising(advertiseCallback)
            setupGattServer()
            
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true)
                .setTimeout(0)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .build()
            
            val data = AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(true)
                .addServiceUuid(ParcelUuid(SERVICE_UUID))
                .build()
            
            advertiseCallback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                    Log.d(TAG, "✅ Advertising started")
                }
                
                override fun onStartFailure(errorCode: Int) {
                    Log.e(TAG, "❌ Advertising failed: $errorCode")
                }
            }
            
            advertiser?.startAdvertising(settings, data, null, advertiseCallback)
            return@AsyncFunction mapOf(
                "status" to "success",
                "serviceUUID" to SERVICE_UUID.toString()
            )
        }
        
        AsyncFunction("stopAdvertising") {
            advertiser?.stopAdvertising(advertiseCallback)
            gattServer?.close()
            advertiseCallback = null
            gattServer = null
        }
        
        Events("onCentralConnected", "onCentralDisconnected", "onDataReceived")
    }
    
    private fun setupGattServer() {
        val bluetoothManager = appContext.reactContext?.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        gattServer?.close()
        gattServer = bluetoothManager.openGattServer(appContext.reactContext, gattCallback)
        
        val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val characteristic = BluetoothGattCharacteristic(
            CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_READ or
            BluetoothGattCharacteristic.PROPERTY_WRITE or
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ or
            BluetoothGattCharacteristic.PERMISSION_WRITE
        )
        
        val descriptor = BluetoothGattDescriptor(
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"),
            BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
        )
        characteristic.addDescriptor(descriptor)
        service.addCharacteristic(characteristic)
        gattServer?.addService(service)
    }
    
    private val gattCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    Log.d(TAG, "📱 Central connected: ${device?.address}")
                    sendEvent("onCentralConnected", mapOf("deviceId" to device?.address))
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    Log.d(TAG, "📱 Central disconnected: ${device?.address}")
                    sendEvent("onCentralDisconnected", mapOf("deviceId" to device?.address))
                }
            }
        }
        
        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            Log.d(TAG, "✍️ Received ${value?.size ?: 0} bytes")
            characteristic?.value = value
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, value)
            }
            
            value?.let {
                val base64Data = android.util.Base64.encodeToString(it, android.util.Base64.DEFAULT)
                sendEvent("onDataReceived", mapOf(
                    "deviceId" to device?.address,
                    "data" to base64Data
                ))
            }
        }
        
        override fun onCharacteristicReadRequest(
            device: BluetoothDevice?,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic?
        ) {
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, characteristic?.value)
        }
    }
}
