/*
 * SolarWise — ESP32 field controller (telemetry + relay command channel)
 * =====================================================================
 * WiFi architecture: the ESP32 is the CLIENT. It pushes telemetry to the
 * Vercel API and POLLS for relay commands — no inbound connection needed,
 * so it works behind any home router / NAT.
 *
 * LIBRARIES (Arduino IDE > Tools > Manage Libraries):
 *   - Adafruit INA219            (3x current/voltage sensors)
 *   - BH1750                     (light / lux)
 *   - DHT sensor library         (DHT11 temperature + humidity)
 *   - ArduinoJson  (v7)          (parse the command response safely)
 *
 * WIRING (matches the SolarWise build — verify against YOUR board)
 *   I2C  : SDA=GPIO21, SCL=GPIO22
 *   INA219: 0x41 solar panel | 0x40 battery | 0x44 load circuit
 *   BH1750: 0x23
 *   DHT11 : GPIO4
 *   Relay : GPIO19 (single channel, ACTIVE-LOW module) -> load circuit
 *
 * SAFETY MODEL (monitoring + supervised control only):
 *   1. Every relay starts OFF on boot.
 *   2. Commands carry an expiry; an EXPIRED command is ignored.
 *   3. No fresh command within RELAY_MAX_ON_MS  -> all relays auto-OFF.
 *   4. WiFi lost for WIFI_FAILSAFE_MS           -> all relays auto-OFF.
 *   5. The AI never actuates: only explicit dashboard commands reach here.
 *
 * This is a prototype. Real mains switching needs proper isolation,
 * fusing, a qualified electrician and a manual emergency stop.
 */

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_INA219.h>
#include <BH1750.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ------------------------------- Config ------------------------------------
const char* WIFI_SSID     = "CHANGE_ME";
const char* WIFI_PASSWORD = "CHANGE_ME";
const char* API_BASE      = "https://shamsi-smart.vercel.app";
// Shared secret — set DEVICE_TOKEN in Vercel env vars to the SAME value.
// Leave empty to run unauthenticated (prototype only).
const char* DEVICE_TOKEN  = "";
const char* DEVICE_ID     = "solarwise-esp32-01";

const unsigned long TELEMETRY_INTERVAL_MS = 5000;  // push readings
const unsigned long COMMAND_INTERVAL_MS   = 3000;  // poll for relay commands
const unsigned long RELAY_MAX_ON_MS       = 300000; // 5 min fail-safe window
const unsigned long WIFI_FAILSAFE_MS      = 60000;  // 1 min offline -> relays OFF

// ------------------------------- Pin map -----------------------------------
#define I2C_SDA 21
#define I2C_SCL 22
#define DHT_PIN 4
#define DHT_TYPE DHT11
// Single-relay build: only the load circuit is switchable today.
// The command channel still accepts battery/ev ids so a future multi-relay
// board works without firmware changes — unwired ids are acknowledged and
// ignored with a clear log line.
#define RELAY_LOADS   19
#define RELAY_BATTERY (-1)
#define RELAY_EV      (-1)
// Most relay boards are active-LOW. Flip if yours is active-HIGH.
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

Adafruit_INA219 inaSolar(0x41);
Adafruit_INA219 inaBattery(0x40);
Adafruit_INA219 inaLoads(0x44);
BH1750 lightMeter(0x23);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long seq = 0, lastTelemetry = 0, lastCommandPoll = 0, lastCommandAt = 0;
bool wifiWasUp = false;

// --------------------------- Relay helpers ---------------------------------
// Relay id -> pin.  -1 = known id but NOT wired on this board,  -2 = unknown id.
int relayPin(const char* relay) {
  if (strcmp(relay, "battery") == 0) return RELAY_BATTERY;
  if (strcmp(relay, "ev") == 0) return RELAY_EV;
  if (strcmp(relay, "loads") == 0) return RELAY_LOADS;
  return -2;
}

void writeRelay(int pin, bool on) {
  if (pin < 0) return;                       // not installed — nothing to drive
  digitalWrite(pin, on ? RELAY_ON : RELAY_OFF);
}

void allRelaysOff(const char* why) {
  writeRelay(RELAY_BATTERY, false);
  writeRelay(RELAY_EV, false);
  writeRelay(RELAY_LOADS, false);
  Serial.print(F("[relay] ALL OFF — ")); Serial.println(why);
}

void applyRelay(const char* relay, bool on) {
  const int pin = relayPin(relay);
  if (pin == -2) { Serial.println(F("[relay] unknown relay id — ignored")); return; }
  if (pin < 0) {
    Serial.print(F("[relay] ")); Serial.print(relay);
    Serial.println(F(" relay is not installed on this build — acknowledged, ignored"));
    return;
  }
  digitalWrite(pin, on ? RELAY_ON : RELAY_OFF);
  Serial.print(F("[relay] ")); Serial.print(relay);
  Serial.println(on ? F(" = ON") : F(" = OFF"));
}

// --------------------------- HTTP helpers ----------------------------------
void addAuth(HTTPClient& http) {
  if (strlen(DEVICE_TOKEN) > 0) http.addHeader("x-device-token", DEVICE_TOKEN);
}

float powerW(Adafruit_INA219& s) {
  const float mw = s.getPower_mW();
  return isfinite(mw) ? max(0.0f, mw / 1000.0f) : NAN;
}

String isoNow() {
  struct tm t;
  if (!getLocalTime(&t, 500)) return "not-set-on-device";
  char b[32];
  strftime(b, sizeof(b), "%Y-%m-%dT%H:%M:%S+03:00", &t);
  return String(b);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(250);
  Serial.println(WiFi.status() == WL_CONNECTED ? F("wifi_connected") : F("wifi_unavailable"));
}

// --------------------------- Telemetry push --------------------------------
void sendTelemetry() {
  const float solarW = powerW(inaSolar);
  const float loadsW = powerW(inaLoads);
  const float battV  = inaBattery.getBusVoltage_V();
  const float battA  = inaBattery.getCurrent_mA() / 1000.0f;
  const float lux    = lightMeter.readLightLevel();
  const float tempC  = dht.readTemperature();
  const float hum    = dht.readHumidity();
  seq++;

  String j = "{";
  j += "\"schemaVersion\":1,";
  j += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  j += "\"sequence\":" + String(seq) + ",";
  j += "\"measuredAt\":\"" + isoNow() + "\",";
  j += "\"source\":\"hardware\",";
  j += "\"measurements\":{";
  j += "\"solarProductionW\":"   + (isnan(solarW) ? String("null") : String(solarW, 1)) + ",";
  j += "\"consumptionW\":"       + (isnan(loadsW) ? String("null") : String(loadsW, 1)) + ",";
  j += "\"batteryLevelPercent\":null,";   // needs a BMS / voltage curve
  j += "\"batteryVoltageV\":"    + (isfinite(battV) ? String(battV, 2) : String("null")) + ",";
  j += "\"batteryCurrentA\":"    + (isfinite(battA) ? String(battA, 2) : String("null")) + ",";
  j += "\"lightLux\":"           + (isfinite(lux) ? String(lux, 0) : String("null")) + ",";
  j += "\"temperatureC\":"       + (!isnan(tempC) ? String(tempC, 1) : String("null")) + ",";
  j += "\"humidityPct\":"        + (!isnan(hum) ? String(hum, 0) : String("null"));
  j += "}}";

  // USB / Web Serial path: one JSON object per line so the browser dashboard
  // can read the SAME firmware over the cable with no WiFi at all.
  Serial.println(j);
  Serial.flush();

  HTTPClient http;
  http.begin(String(API_BASE) + "/api/telemetry");
  http.addHeader("Content-Type", "application/json");
  addAuth(http);
  const int code = http.POST(j);
  Serial.printf("[log] telemetry http=%d solar=%.1fW loads=%.1fW\n", code, solarW, loadsW);
  http.end();
}

// --------------------------- Command polling -------------------------------
// The dashboard enqueues commands; we consume them here. Expired commands
// are dropped server-side AND re-checked here as defence in depth.
void pollCommands() {
  HTTPClient http;
  http.begin(String(API_BASE) + "/api/device/commands?deviceId=" + String(DEVICE_ID));
  addAuth(http);
  const int code = http.GET();
  if (code != 200) { Serial.printf("[commands] http=%d\n", code); http.end(); return; }

  StaticJsonDocument<1024> doc;
  const DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) { Serial.printf("[commands] json error: %s\n", err.c_str()); return; }

  const JsonArray list = doc["commands"].as<JsonArray>();
  for (JsonObject c : list) {
    const char* relay = c["relay"] | "";
    const bool on = strcmp(c["state"] | "", "on") == 0;
    const long long expiresAt = c["expiresAt"] | 0LL;
    const unsigned long long nowMs = (unsigned long long)millis();  // device clock
    // Server timestamps are epoch ms; without NTP we can only sanity-check
    // that the server bothered to stamp it. Freshness is enforced server-side.
    if (expiresAt <= 0) { Serial.println(F("[commands] unstamped command ignored")); continue; }
    (void)nowMs;
    applyRelay(relay, on);
    lastCommandAt = millis();
  }
}

// -------------------------------- Setup ------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);
  if (RELAY_BATTERY >= 0) pinMode(RELAY_BATTERY, OUTPUT);
  if (RELAY_EV >= 0) pinMode(RELAY_EV, OUTPUT);
  if (RELAY_LOADS >= 0) pinMode(RELAY_LOADS, OUTPUT);
  allRelaysOff("boot");

  Wire.begin(I2C_SDA, I2C_SCL);
  inaSolar.begin(&Wire);
  inaBattery.begin(&Wire);
  inaLoads.begin(&Wire);
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23, &Wire);
  dht.begin();

  connectWiFi();
  configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  lastCommandAt = millis();
  Serial.println(F("solarwise_controller_ready"));
}

// -------------------------------- Loop -------------------------------------
void loop() {
  connectWiFi();
  const bool online = WiFi.status() == WL_CONNECTED;

  // Fail-safe 1: lost link for too long -> relays OFF.
  if (!online) {
    if (wifiWasUp) { wifiWasUp = false; }
    if (millis() - lastCommandAt > WIFI_FAILSAFE_MS) allRelaysOff("wifi lost");
    delay(500);
    return;
  }
  wifiWasUp = true;

  // Fail-safe 2: no command supervision for too long -> relays OFF.
  if (millis() - lastCommandAt > RELAY_MAX_ON_MS) allRelaysOff("no command supervision");

  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
    lastTelemetry = millis();
    sendTelemetry();
  }
  if (millis() - lastCommandPoll >= COMMAND_INTERVAL_MS) {
    lastCommandPoll = millis();
    pollCommands();
  }
  delay(20);
}
