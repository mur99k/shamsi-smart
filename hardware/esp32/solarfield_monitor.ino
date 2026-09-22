/*
  SolarWise field monitor (ESP32 + 3x INA219 + BH1750)
  ----------------------------------------------------
  Reads panel / battery / load power over I2C and POSTs the
  measurement envelope to the SolarWise telemetry API every 5 s.
  Also prints one JSON line per sample over USB Serial (115200)
  for the site's Web Serial mode.

  Libraries (Arduino IDE Library Manager):
    - Adafruit INA219 by Adafruit
    - BH1750 by Christopher Laws
    (Wire, WiFi and HTTPClient are built into the ESP32 core.)

  Wiring:
    I2C bus: SDA -> GPIO21, SCL -> GPIO22
    INA219 #1 (solar panel)  address 0x40 (default, no bridges)
    INA219 #2 (battery)      address 0x41 (solder bridge A0)
    INA219 #3 (home loads)   address 0x44 (solder bridges A0 + A1)
    BH1750 (light)           address 0x23
    Relays (outputs, default OFF): battery -> P16, EV -> P17, loads -> P5

  SAFETY (monitoring only):
  - This sketch never switches relays by itself. Relay pins stay OFF.
  - INA219 modules must be wired for high-side sensing within their
    rated voltage/current. Mains work requires isolation hardware
    and a qualified electrical review. Calibrate against a trusted
    meter before treating readings as meaningful.
*/

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_INA219.h>
#include <BH1750.h>

// ---------- Wi-Fi / server (FILL THESE BEFORE UPLOAD) ----------
const char* WIFI_SSID = "CHANGE_ME";
const char* WIFI_PASSWORD = "CHANGE_ME";
const char* TELEMETRY_URL = "https://shamsi-smart-gsstncuie-muradkhodari-5397s-projects.vercel.app/api/telemetry";
const char* DEVICE_ID = "solarfield-01";

// ---------- I2C ----------
#define I2C_SDA 21
#define I2C_SCL 22

// ---------- Relays (outputs, stay OFF in monitor mode) ----------
const int RELAY_BATTERY_PIN = 16;
const int RELAY_EV_PIN = 17;
const int RELAY_LOADS_PIN = 5;

Adafruit_INA219 inaSolar(0x40);
Adafruit_INA219 inaBattery(0x41);
Adafruit_INA219 inaLoads(0x44);
BH1750 lightMeter(0x23);

unsigned long sequenceNumber = 0;
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 5000;

float readPowerW(Adafruit_INA219& sensor) {
  float mw = sensor.getPower_mW();
  if (isnan(mw)) return NAN;
  return max(0.0f, mw / 1000.0f);
}

String numberOrNull(float value, int decimals = 2) {
  if (!isfinite(value)) return "null";
  return String(value, decimals);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_BATTERY_PIN, OUTPUT);
  pinMode(RELAY_EV_PIN, OUTPUT);
  pinMode(RELAY_LOADS_PIN, OUTPUT);
  digitalWrite(RELAY_BATTERY_PIN, LOW);
  digitalWrite(RELAY_EV_PIN, LOW);
  digitalWrite(RELAY_LOADS_PIN, LOW);

  Wire.begin(I2C_SDA, I2C_SCL);
  inaSolar.begin(&Wire);
  inaBattery.begin(&Wire);
  inaLoads.begin(&Wire);
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "wifi_connected" : "wifi_unavailable");
  configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  delay(500);
  Serial.println("solarwise_field_ready");
}

String isoTime() {
  struct tm t;
  if (!getLocalTime(&t, 1000)) return "not-set-on-device";
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+03:00", &t);
  return String(buf);
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();
  sequenceNumber++;

  const float solarW = readPowerW(inaSolar);
  const float loadsW = readPowerW(inaLoads);
  const float battV = inaBattery.getBusVoltage_V();
  const float battA = inaBattery.getCurrent_mA() / 1000.0f;
  const float lux = lightMeter.readLightLevel();

  // Battery charge % needs a BMS or calibrated voltage curve: report null.
  String json = "{";
  json += "\"schemaVersion\":1,";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"sequence\":" + String(sequenceNumber) + ",";
  json += "\"measuredAt\":\"" + isoTime() + "\",";
  json += "\"source\":\"hardware\",";
  json += "\"measurements\":{";
  json += "\"solarProductionW\":" + numberOrNull(solarW) + ",";
  json += "\"consumptionW\":" + numberOrNull(loadsW) + ",";
  json += "\"batteryLevelPercent\":null";
  json += "}}";

  Serial.println(json); // USB / Web Serial mode
  Serial.print("diag battV=");
  Serial.print(isfinite(battV) ? battV : NAN);
  Serial.print(" battA=");
  Serial.print(isfinite(battA) ? battA : NAN);
  Serial.print(" lux=");
  Serial.println(isfinite(lux) ? lux : NAN);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(TELEMETRY_URL);
    http.addHeader("Content-Type", "application/json");
    int status = http.POST(json);
    Serial.print("telemetry_http_status=");
    Serial.println(status);
    http.end();
  } else {
    Serial.println("wifi_unavailable");
  }
}
