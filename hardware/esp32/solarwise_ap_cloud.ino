/*
 * SolarWise — ESP32 AP dashboard + cloud telemetry + remote relay
 * ================================================================
 * Runs BOTH at the same time (WIFI_AP_STA):
 *   1) Local AP  "SolarWise_System"  -> http://192.168.4.1  (your existing dashboard)
 *   2) Home WiFi -> POST /api/telemetry on shamsi-smart.vercel.app
 *                -> GET  /api/device/commands  (relay control from the site)
 *
 * LIBRARIES (Arduino IDE > Manage Libraries):
 *   Adafruit INA219 · BH1750 · DHT sensor library · ArduinoJson
 *
 * WIRING (matches your build):
 *   I2C SDA=21 SCL=22 · solar=0x41 · battery=0x40 · load=0x44 · BH1750=0x23
 *   DHT11=GPIO15 · Relay=GPIO19 (your module is ACTIVE-HIGH: HIGH = ON)
 *
 * ⚠️ INA219 must sit IN SERIES on the positive lead (VIN+ / VIN-), max 26V/3.2A.
 *    Never put it on 220V AC.
 */

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include <BH1750.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>

// ------------------------------ Config -------------------------------------
const char* WIFI_SSID     = "stc_wifi0750";
const char* WIFI_PASSWORD = "3h39adwxamd";
const char* API_BASE      = "https://shamsi-smart.vercel.app";
const char* DEVICE_TOKEN  = "";                        // same value as Vercel DEVICE_TOKEN
const char* DEVICE_ID     = "solarwise-esp32-01";

const char* ap_ssid     = "SolarWise_System";
const char* ap_password = "12345678Password";

const unsigned long TELEMETRY_MS = 5000;   // push to the cloud
const unsigned long COMMAND_MS   = 3000;   // poll for relay commands

// ------------------------------ Pins ---------------------------------------
#define DHT_PIN     15
#define DHT_TYPE    DHT11
#define RELAY_PIN   19
const int RELAY_ON = HIGH;   // your module: HIGH = ON

WebServer server(80);
DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightSensor;

Adafruit_INA219 loadINA(0x44);
Adafruit_INA219 solarINA(0x41);
Adafruit_INA219 batteryINA(0x40);

bool loadINAReady = false, solarINAReady = false, batteryINAReady = false;
bool lightSensorReady = false;
bool relayState = false;

float temp = 0, hum = 0, lux = 0;
float loadV = 0, loadI = 0, loadP = 0;        // V, mA, mW
float solarV = 0, solarI = 0, solarP = 0;     // V, mA, mW
float batteryV = 0, batteryI = 0, batteryP = 0;

unsigned long seq = 0, lastTelemetry = 0, lastCommandPoll = 0;

// ------------------------------ Local dashboard ----------------------------
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>SolarWise Dashboard</title><style>";
  html += "body{font-family:Arial,sans-serif;text-align:center;background:#f0f2f5;margin:0;padding:20px}";
  html += "h1{color:#1a73e8}.grid{display:flex;flex-wrap:wrap;justify-content:center;gap:15px;margin-top:20px}";
  html += ".card{background:#fff;padding:20px;border-radius:12px;width:250px;box-shadow:0 4px 8px rgba(0,0,0,.1)}";
  html += ".card h3{color:#333;border-bottom:2px solid #1a73e8;padding-bottom:8px}";
  html += ".val{font-size:1.1em;color:#555;font-weight:bold}";
  html += ".btn{display:inline-block;padding:12px 24px;font-size:1em;color:#fff;border:none;border-radius:8px;text-decoration:none;margin-top:10px}";
  html += ".btn-on{background:#34a853}.btn-off{background:#ea4335}";
  html += "</style><meta http-equiv='refresh' content='3'></head><body>";
  html += "<h1>منظومة SolarWise الذكية</h1><p>لوحة تحكم القراءات والتحكم بالحمل عبر ESP32</p><div class='grid'>";

  html += "<div class='card'><h3>البيئة (DHT11)</h3>";
  html += "<p class='val'>الحرارة: " + String(temp, 1) + " °C</p>";
  html += "<p class='val'>الرطوبة: " + String(hum, 1) + " %</p></div>";

  html += "<div class='card'><h3>شدة الضوء (BH1750)</h3>";
  html += "<p class='val'>الإضاءة: " + String(lux, 1) + " lux</p></div>";

  html += "<div class='card'><h3>استهلاك الليد (Load)</h3>";
  html += "<p class='val'>الجهد: " + String(loadV, 2) + " V</p>";
  html += "<p class='val'>التيار: " + String(loadI, 1) + " mA</p>";
  html += "<p class='val'>القدرة: " + String(loadP, 1) + " mW</p></div>";

  html += "<div class='card'><h3>إنتاج اللوح الشمسي</h3>";
  html += "<p class='val'>الجهد: " + String(solarV, 2) + " V</p>";
  html += "<p class='val'>التيار: " + String(solarI, 1) + " mA</p>";
  html += "<p class='val'>القدرة: " + String(solarP, 1) + " mW</p></div>";

  html += "<div class='card'><h3>البطارية (Battery)</h3>";
  html += "<p class='val'>الجهد: " + String(batteryV, 2) + " V</p>";
  html += "<p class='val'>التيار: " + String(batteryI, 1) + " mA</p>";
  html += "<p class='val'>القدرة: " + String(batteryP, 1) + " mW</p></div>";

  html += "<div class='card'><h3>التحكم بالحمل (Relay)</h3>";
  if (relayState) {
    html += "<p class='val' style='color:green'>الحالة: يعمل (ON)</p>";
    html += "<a href='/relay/off' class='btn btn-off'>إيقاف التشغيل</a>";
  } else {
    html += "<p class='val' style='color:red'>الحالة: متوقف (OFF)</p>";
    html += "<a href='/relay/on' class='btn btn-on'>تشغيل</a>";
  }
  html += "</div>";

  html += "<div class='card'><h3>حالة السحابة</h3>";
  html += "<p class='val'>" + String(WiFi.status() == WL_CONNECTED ? "متصل ✅ يرسل للموقع" : "غير متصل ❌ محلي فقط") + "</p>";
  html += "<p class='val' style='font-size:.9em;color:#777'>" + String(API_BASE) + "</p></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

void setRelay(bool on) {
  relayState = on;
  digitalWrite(RELAY_PIN, on ? RELAY_ON : !RELAY_ON);
}

void handleRelayOn()  { setRelay(true);  server.sendHeader("Location", "/"); server.send(303); }
void handleRelayOff() { setRelay(false); server.sendHeader("Location", "/"); server.send(303); }

// ------------------------------ Helpers ------------------------------------
String isoNow() {
  struct tm t;
  if (!getLocalTime(&t, 300)) return "not-set-on-device";
  char b[32];
  strftime(b, sizeof(b), "%Y-%m-%dT%H:%M:%S+03:00", &t);
  return String(b);
}

String num(float v, int d) { return isfinite(v) ? String(v, d) : String("0"); }

// ------------------------------ Cloud telemetry ----------------------------
void sendTelemetry() {
  // The API expects WATTS. INA219 gives mW here (V * mA), so divide by 1000.
  const float solarW = solarP / 1000.0f;
  const float loadW  = loadP / 1000.0f;
  seq++;

  String j = "{";
  j += "\"schemaVersion\":1,";
  j += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  j += "\"sequence\":" + String(seq) + ",";
  j += "\"measuredAt\":\"" + isoNow() + "\",";
  j += "\"source\":\"hardware\",";
  j += "\"measurements\":{";
  j += "\"solarProductionW\":" + num(solarW, 2) + ",";
  j += "\"consumptionW\":" + num(loadW, 2) + ",";
  // Battery % needs a BMS or a calibrated voltage curve -> send null (honest).
  j += "\"batteryLevelPercent\":null";
  j += "}}";

  Serial.println(j);   // also visible over USB / Web Serial
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // prototype only: skips TLS cert validation
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/api/telemetry");
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_TOKEN) > 0) http.addHeader("x-device-token", DEVICE_TOKEN);
  const int code = http.POST(j);
  http.end();
  Serial.printf("[log] telemetry http=%d solar=%.2fW load=%.2fW\n", code, solarW, loadW);
}

// ------------------------------ Cloud commands -----------------------------
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, String(API_BASE) + "/api/device/commands?deviceId=" + String(DEVICE_ID));
  if (strlen(DEVICE_TOKEN) > 0) http.addHeader("x-device-token", DEVICE_TOKEN);
  const int code = http.GET();
  if (code != 200) { http.end(); return; }

  StaticJsonDocument<768> doc;
  if (!deserializeJson(doc, http.getString())) {
    for (JsonObject c : doc["commands"].as<JsonArray>()) {
      // Single-relay build: only "loads" is wired.
      if (strcmp(c["relay"] | "", "loads") != 0) continue;
      const bool on = strcmp(c["state"] | "", "on") == 0;
      setRelay(on);
      Serial.printf("[relay] loads = %s\n", on ? "ON" : "OFF");
    }
  }
  http.end();
}

// ------------------------------ Sensors ------------------------------------
void readSensors() {
  const float t = dht.readTemperature();
  const float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) { temp = t; hum = h; }

  if (lightSensorReady) {
    const float l = lightSensor.readLightLevel();
    if (l >= 0) lux = l;
  }
  if (loadINAReady) {
    loadV = loadINA.getBusVoltage_V();
    loadI = abs(loadINA.getCurrent_mA());
    loadP = loadV * loadI;                 // mW
  }
  if (solarINAReady) {
    solarV = solarINA.getBusVoltage_V();
    solarI = abs(solarINA.getCurrent_mA());
    solarP = solarV * solarI;              // mW
  }
  if (batteryINAReady) {
    batteryV = batteryINA.getBusVoltage_V();
    batteryI = abs(batteryINA.getCurrent_mA());
    batteryP = batteryV * batteryI;        // mW
  }
}

// ------------------------------ Setup --------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);

  Wire.begin(21, 22);
  dht.begin();

  // AP + STA together: local dashboard keeps working even if home WiFi is down.
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(ap_ssid, ap_password);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("AP IP: "); Serial.println(WiFi.softAPIP());

  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) { delay(300); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " wifi_connected" : " wifi_unavailable (local only)");
  configTime(3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  server.on("/", handleRoot);
  server.on("/relay/on", handleRelayOn);
  server.on("/relay/off", handleRelayOff);
  server.begin();

  lightSensorReady = lightSensor.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  loadINAReady     = loadINA.begin();
  solarINAReady    = solarINA.begin();
  batteryINAReady  = batteryINA.begin();

  Serial.printf("sensors: light=%d solar=%d battery=%d load=%d\n",
                lightSensorReady, solarINAReady, batteryINAReady, loadINAReady);
  Serial.println("solarwise_ready");
}

// ------------------------------ Loop ---------------------------------------
void loop() {
  server.handleClient();
  readSensors();

  if (millis() - lastTelemetry >= TELEMETRY_MS) {
    lastTelemetry = millis();
    sendTelemetry();
  }
  if (millis() - lastCommandPoll >= COMMAND_MS) {
    lastCommandPoll = millis();
    pollCommands();
  }
  delay(100);
}
