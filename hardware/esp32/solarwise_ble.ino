/*
 * SolarWise — ESP32 BLE telemetry (Web Bluetooth ready)
 * =====================================================
 * Exposes a BLE UART (Nordic UART Service) so a browser can read the
 * sensors directly over Bluetooth — no WiFi, no router, no cable.
 *
 * HOW IT WORKS
 *   ESP32 (BLE peripheral) --notify--> Browser (Web Bluetooth) --> Dashboard
 *   Every 2 s the ESP32 notifies ONE JSON line (newline-terminated) with the
 *   same fields the web app already understands:
 *     {"solarProductionW":1.5,"consumptionW":0.3,"batteryLevelPercent":null}
 *
 *   The browser can also WRITE to the RX characteristic to switch the relay:
 *     {"relay":"loads","state":"on"}  /  {"relay":"loads","state":"off"}
 *
 * LIBRARIES (Arduino IDE > Manage Libraries)
 *   - Adafruit INA219
 *   - BH1750
 *   - DHT sensor library
 *   - ArduinoJson
 *   (BLE libraries ship with the ESP32 core — nothing to install.)
 *
 * WIRING (your build)
 *   I2C SDA=21 SCL=22 · solar=0x41 · battery=0x40 · load=0x44 · BH1750=0x23
 *   DHT11=GPIO15 · Relay=GPIO19 (ACTIVE-HIGH: HIGH = ON)
 *   ⚠️ INA219 sits IN SERIES on the positive lead (VIN+/VIN-), max 26V/3.2A.
 *
 * BROWSER SUPPORT
 *   Android Chrome ✅ · Desktop Chrome / Edge ✅ · iPhone Safari ❌ (no Web Bluetooth)
 */

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ------------------------------ Config -------------------------------------
#define DEVICE_NAME "SolarWise-ESP32"

// Nordic UART Service (the de-facto standard for BLE serial)
#define SERVICE_UUID "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define TX_UUID      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"  // ESP32 -> browser (notify)
#define RX_UUID      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"  // browser -> ESP32 (write)

const unsigned long SEND_INTERVAL_MS = 2000;

// ------------------------------ Pins ---------------------------------------
#define DHT_PIN   15
#define DHT_TYPE  DHT11
#define RELAY_PIN 19
const int RELAY_ON = HIGH;

DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightSensor;
Adafruit_INA219 solarINA(0x41);
Adafruit_INA219 batteryINA(0x40);
Adafruit_INA219 loadINA(0x44);

bool solarReady = false, batteryReady = false, loadReady = false, lightReady = false;

BLEServer* bleServer = nullptr;
BLECharacteristic* txChar = nullptr;
bool clientConnected = false;
bool relayState = false;
unsigned long lastSend = 0;

// ------------------------------ BLE callbacks ------------------------------
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    clientConnected = true;
    Serial.println("[ble] client connected");
  }
  void onDisconnect(BLEServer* srv) override {
    clientConnected = false;
    Serial.println("[ble] client disconnected — advertising again");
    srv->startAdvertising(); // stay discoverable for the next connection
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch) override {
    const String payload = ch->getValue().c_str();
    if (!payload.length()) return;

    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload)) { Serial.println("[ble] bad command json"); return; }

    const char* relay = doc["relay"] | "";
    const char* state = doc["state"] | "";
    if (strcmp(relay, "loads") != 0) {
      Serial.printf("[ble] relay '%s' not installed — ignored\n", relay);
      return;
    }
    if (strcmp(state, "on") == 0)       setRelay(true);
    else if (strcmp(state, "off") == 0) setRelay(false);
    else Serial.println("[ble] state must be on/off");
  }
};

// ------------------------------ Helpers ------------------------------------
void setRelay(bool on) {
  relayState = on;
  digitalWrite(RELAY_PIN, on ? RELAY_ON : !RELAY_ON);
  Serial.printf("[relay] %s\n", on ? "ON" : "OFF");
}

float readPower_mW(Adafruit_INA219& s, bool ready) {
  if (!ready) return 0;
  return s.getBusVoltage_V() * abs(s.getCurrent_mA());   // V * mA = mW
}

void sendReading() {
  const float solar_mW = readPower_mW(solarINA, solarReady);
  const float load_mW  = readPower_mW(loadINA, loadReady);

  StaticJsonDocument<256> doc;
  doc["solarProductionW"] = serialized(String(solar_mW / 1000.0f, 2));
  doc["consumptionW"]     = serialized(String(load_mW / 1000.0f, 2));
  doc["batteryLevelPercent"] = nullptr;   // no BMS -> honest null
  doc["lightLux"]    = roundf(lightSensor.readLightLevel());
  doc["temperatureC"] = serialized(String(dht.readTemperature(), 1));
  doc["relay"] = relayState ? "on" : "off";

  String line;
  serializeJson(doc, line);
  line += "\n";   // the browser splits on newlines

  if (txChar && clientConnected) {
    txChar->setValue(line.c_str());
    txChar->notify();
  }
  Serial.print(line);   // also visible on USB for debugging
}

// ------------------------------ Setup --------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);

  Wire.begin(21, 22);
  dht.begin();
  lightReady   = lightSensor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  solarReady   = solarINA.begin();
  batteryReady = batteryINA.begin();
  loadReady    = loadINA.begin();
  Serial.printf("sensors: light=%d solar=%d battery=%d load=%d\n",
                lightReady, solarReady, batteryReady, loadReady);

  BLEDevice::init(DEVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  BLEService* service = bleServer->createService(SERVICE_UUID);

  txChar = service->createCharacteristic(
    TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  txChar->addDescriptor(new BLE2902());   // enables notifications on the client

  BLECharacteristic* rxChar = service->createCharacteristic(
    RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rxChar->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  Serial.println("solarwise_ble_ready — pair from the website");
}

// ------------------------------ Loop ---------------------------------------
void loop() {
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendReading();
  }
  delay(20);
}
