/*
  Smart Solar ESP32 telemetry starter
  -----------------------------------
  Sends one JSON line over USB Serial and, when Wi-Fi is configured,
  the same measurement envelope to POST /api/telemetry.

  IMPORTANT SAFETY:
  - This sketch is a monitoring prototype. It does not control loads.
  - Never connect an ESP32 ADC pin directly to a solar panel, battery,
    mains circuit, or an unknown voltage. Use an isolated, rated sensor
    interface and a qualified electrical review.
  - Voltage/current constants below are placeholders. Calibrate against
    a trusted meter before treating readings as meaningful.
  - ACS712 is for isolated low-voltage/current experiments only. SCT-013
    requires the correct burden/resistor interface and isolation design.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ---------- Device identity ----------
const char* DEVICE_ID = "solar-prototype-01";
const int SCHEMA_VERSION = 1;
unsigned long sequenceNumber = 0;

// ---------- Wi-Fi / telemetry ----------
const char* WIFI_SSID = "CHANGE_ME";
const char* WIFI_PASSWORD = "CHANGE_ME";
const char* TELEMETRY_URL = "https://YOUR_DOMAIN.example/api/telemetry";
const bool ENABLE_WIFI_TELEMETRY = false;
const unsigned long SEND_INTERVAL_MS = 5000;

// ---------- Sensor pins ----------
// ESP32 ADC pins are input-only and must stay within the board's ADC range.
const int SOLAR_VOLTAGE_PIN = 34; // voltage divider / isolated voltage sensor
const int SOLAR_CURRENT_PIN = 35; // ACS712 or conditioned SCT-013 interface
const int CONSUMPTION_CURRENT_PIN = 33; // second isolated/conditioned current interface
const int LDR_PIN = 32;           // optional light intensity signal
const int DHT_PIN = 4;            // optional DHT11 data pin
const int DHT_TYPE = DHT11;

// ---------- Calibration placeholders ----------
// Replace these with values measured for the exact sensor and circuit.
const float ADC_REFERENCE_V = 3.3f;
const float ADC_COUNTS = 4095.0f;
const float VOLTAGE_DIVIDER_RATIO = 11.0f;
const float CURRENT_ZERO_V = 2.50f;       // ACS712 output at zero current
const float ACS712_MV_PER_AMP = 185.0f;   // 5A module; verify your module
const float CONSUMPTION_CURRENT_ZERO_V = 2.50f;
const float CONSUMPTION_ACS712_MV_PER_AMP = 185.0f;
const float CONSUMPTION_SYSTEM_VOLTAGE = 230.0f; // configure for the tested isolated circuit
const bool ENABLE_CONSUMPTION_SENSOR = false; // enable only after calibration and safety review
const float BATTERY_LEVEL_PERCENT = -1.0f; // -1 means unavailable

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSend = 0;

float readAdcVoltage(int pin) {
  return (analogRead(pin) / ADC_COUNTS) * ADC_REFERENCE_V;
}

float readSolarVoltageV() {
  return max(0.0f, readAdcVoltage(SOLAR_VOLTAGE_PIN) * VOLTAGE_DIVIDER_RATIO);
}

float readSolarCurrentA() {
  const float sensorVoltage = readAdcVoltage(SOLAR_CURRENT_PIN);
  const float current = ((sensorVoltage - CURRENT_ZERO_V) * 1000.0f) / ACS712_MV_PER_AMP;
  return max(0.0f, current);
}

float readSolarProductionW() {
  return readSolarVoltageV() * readSolarCurrentA();
}

float readConsumptionW() {
  // This estimates apparent power from a second current interface and a
  // configured nominal voltage. It is NOT a mains measurement by itself.
  // Keep disabled until the isolated sensor and calibration are reviewed.
  if (!ENABLE_CONSUMPTION_SENSOR) return NAN;
  const float sensorVoltage = readAdcVoltage(CONSUMPTION_CURRENT_PIN);
  const float current = max(0.0f, ((sensorVoltage - CONSUMPTION_CURRENT_ZERO_V) * 1000.0f) / CONSUMPTION_ACS712_MV_PER_AMP);
  return current * CONSUMPTION_SYSTEM_VOLTAGE;
}

String numberOrNull(float value, int decimals = 2) {
  if (!isfinite(value)) return "null";
  return String(value, decimals);
}

String buildTelemetryJson(float solarW, float consumptionW, float batteryPct, float temperatureC, float lightRaw) {
  String json = "{";
  json += "\"schemaVersion\":1,";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"sequence\":" + String(sequenceNumber) + ",";
  json += "\"measuredAt\":\"not-set-on-device\",";
  json += "\"source\":\"hardware\",";
  json += "\"measurements\":{";
  json += "\"solarProductionW\":" + numberOrNull(solarW) + ",";
  json += "\"consumptionW\":" + numberOrNull(consumptionW) + ",";
  json += "\"batteryLevelPercent\":" + numberOrNull(batteryPct, 1) + ",";
  json += "\"temperatureC\":" + numberOrNull(temperatureC, 1) + ",";
  json += "\"lightRaw\":" + numberOrNull(lightRaw, 0);
  json += "},\"quality\":{";
  json += "\"solar\":\"" + (isfinite(solarW) ? "calibration_required" : "not_available") + "\",";
  json += "\"consumption\":\"" + (isfinite(consumptionW) ? "calibration_required" : "not_available") + "\",";
  json += "\"batteryLevel\":\"" + (isfinite(batteryPct) ? "calibration_required" : "not_available") + "\"";
  json += "}}";
  return json;
}

void sendTelemetry(const String& json) {
  Serial.println(json); // Web Serial / USB mode: one JSON object per line

  if (!ENABLE_WIFI_TELEMETRY || WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(TELEMETRY_URL);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(json);
  Serial.print("telemetry_http_status=");
  Serial.println(status);
  http.end();
}

void connectWiFi() {
  if (!ENABLE_WIFI_TELEMETRY || String(WIFI_SSID) == "CHANGE_ME") return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "wifi_connected" : "wifi_unavailable");
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  dht.begin();
  delay(500);
  Serial.println("smart_solar_esp32_ready");
  connectWiFi();
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();
  sequenceNumber++;

  const float solarW = readSolarProductionW();
  const float consumptionW = readConsumptionW();
  const float batteryPct = BATTERY_LEVEL_PERCENT;
  const float temperatureC = dht.readTemperature();
  const float lightRaw = analogRead(LDR_PIN);

  // Until a consumption sensor is calibrated, this sample is intentionally
  // rejected by the server instead of silently pretending load is zero.
  sendTelemetry(buildTelemetryJson(solarW, consumptionW, batteryPct, temperatureC, lightRaw));
}
