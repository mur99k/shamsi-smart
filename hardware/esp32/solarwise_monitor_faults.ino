/*
 * SolarWise — ESP32 + INA219 Solar Monitor with Fault Detection
 * ============================================================
 * Board: ESP32 DevKit (any variant with GPIO 21/22 free)
 * Sensor: INA219 high-side current/voltage/power (default I2C 0x40)
 *
 * REQUIRED ARDUINO IDE LIBRARIES (Sketch > Include Library > Manage Libraries):
 *   1. "Adafruit INA219" by Adafruit  (pulls Adafruit BusIO automatically)
 *
 * WIRING (high-side sensing on the solar panel positive lead):
 *   ESP32 3V3  -> INA219 VCC        ESP32 GND -> INA219 GND
 *   ESP32 GPIO21 (SDA) -> INA219 SDA
 *   ESP32 GPIO22 (SCL) -> INA219 SCL
 *   Panel (+) -> INA219 VIN+  ->  Load/Battery (+) -> INA219 VIN-
 *   Panel (-) -> common GND (shared with ESP32 GND)
 * SAFETY: stay within the INA219 ratings (26 V / 3.2 A max on stock
 * shunt). Mains work needs isolation hardware + qualified review.
 *
 * SERIAL: 115200 baud. One human-readable block + one JSON line per sample.
 */

#include <Wire.h>
#include <Adafruit_INA219.h>

// ----------------------------- Config -------------------------------------
#define I2C_SDA 21
#define I2C_SCL 22
#define INA219_ADDR 0x40          // default; A0/A1 solder bridges select 0x41/0x44/0x45
#define SAMPLE_INTERVAL_MS 2000UL // telemetry cadence

// Fault thresholds — calibrate these against a trusted meter on YOUR rig.
#define DUST_WINDOW 30            // samples for the soiling moving average
#define DUST_DROP_PCT 15.0f       // % power drop vs baseline => soiling suspected
#define SHADING_DROP_PCT 40.0f    // % sudden drop between samples => shading/hotspot
#define VOLTAGE_LOSS_V 0.5f       // bus below this => wiring/disconnection suspected
#define BATT_LOW_V 11.0f          // 12 V lead-acid example floor (tune to chemistry)
#define BATT_HIGH_DISCHARGE_A 2.0f // sustained discharge above this => abnormal

Adafruit_INA219 ina219(INA219_ADDR);

// Rolling baseline for gradual-change detection (simple moving average).
float powerHistory[DUST_WINDOW];
uint8_t histIdx = 0;
bool histFull = false;
float prevPower_mW = NAN;

// ------------------------- Fault detectors --------------------------------
// Each returns true when ITS fault signature is present. They only READ the
// latest sample — no actuation, monitoring only.

bool detectWiringFault(float busV, bool sensorOk) {
  // Disconnection / broken lead: sensor unreachable or bus collapsed to ~0.
  return !sensorOk || busV < VOLTAGE_LOSS_V;
}

bool detectShadingHotspot(float power_mW) {
  // Sudden cliff vs the previous sample (cloud edge is slower; a hard step
  // smells like new shade or a hotspotting cell string).
  if (!isfinite(prevPower_mW) || prevPower_mW < 1.0f) return false;
  return ((prevPower_mW - power_mW) / prevPower_mW * 100.0f) >= SHADING_DROP_PCT;
}

bool detectDustSoiling(float power_mW) {
  // Slow sag vs the long-run baseline while instantaneous steps stay small.
  if (!histFull) return false;
  float sum = 0;
  for (uint8_t i = 0; i < DUST_WINDOW; i++) sum += powerHistory[i];
  const float baseline = sum / DUST_WINDOW;
  if (baseline < 1.0f) return false;
  return ((baseline - power_mW) / baseline * 100.0f) >= DUST_DROP_PCT;
}

bool detectBatteryAbuse(float busV, float current_mA) {
  // Placeholder policy: undervoltage floor + sustained heavy discharge.
  // Replace with your BMS curve / coulomb counting for production.
  const float amps = current_mA / 1000.0f;
  return (busV < BATT_LOW_V) || (amps > BATT_HIGH_DISCHARGE_A);
}

// -------------------------------- Setup -----------------------------------
void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(10); } // wait for USB serial on native-USB boards
  Wire.begin(I2C_SDA, I2C_SCL);

  if (!ina219.begin(&Wire)) {
    Serial.println(F("FAULT: INA219 not found — check wiring/address, halting."));
    while (true) { delay(1000); }
  }
  // 32 V / 2 A gain = best resolution for a 12 V solar rig. Use
  // setCalibration_16V_400mA() instead for 5 V / low-current benches.
  ina219.setCalibration_32V_2A();

  for (uint8_t i = 0; i < DUST_WINDOW; i++) powerHistory[i] = NAN;
  Serial.println(F("SolarWise monitor ready @115200 baud"));
}

// -------------------------------- Loop ------------------------------------
void loop() {
  static unsigned long lastSample = 0;
  const unsigned long now = millis();
  if (now - lastSample < SAMPLE_INTERVAL_MS) return;
  lastSample = now;

  // --- 1. Raw readings ------------------------------------------------------
  const float shunt_mV = ina219.getShuntVoltage_mV();
  const float busV = ina219.getBusVoltage_V();
  const float current_mA = ina219.getCurrent_mA();
  const float power_mW = ina219.getPower_mW();
  const float loadV = busV + (shunt_mV / 1000.0f);
  const bool sensorOk = isfinite(shunt_mV) && isfinite(busV)
                     && isfinite(current_mA) && isfinite(power_mW);

  // --- 2. Fault evaluation (order matters: wiring first, it masks all) -----
  const bool wiring = detectWiringFault(busV, sensorOk);
  const bool shading = !wiring && detectShadingHotspot(power_mW);
  const bool dust = !wiring && !shading && detectDustSoiling(power_mW);
  // NOTE: point the battery detector at a BATTERY-side INA219 (0x41) in a
  // multi-sensor build; here it evaluates this channel's numbers as example.
  const bool battAbuse = !wiring && detectBatteryAbuse(busV, current_mA);

  // --- 3. Human-readable block ----------------------------------------------
  Serial.println(F("----- SolarWise sample -----"));
  Serial.print(F("Bus Voltage (V):      ")); Serial.println(busV, 3);
  Serial.print(F("Shunt Voltage (mV):   ")); Serial.println(shunt_mV, 2);
  Serial.print(F("Load Voltage (V):     ")); Serial.println(loadV, 3);
  Serial.print(F("Current (mA):         ")); Serial.println(current_mA, 1);
  Serial.print(F("Power (mW):           ")); Serial.println(power_mW, 0);
  Serial.print(F("Faults [wiring,shading,dust,battery]: "));
  Serial.print(wiring); Serial.print(",");
  Serial.print(shading); Serial.print(",");
  Serial.print(dust); Serial.print(",");
  Serial.println(battAbuse);

  // --- 4. Machine-readable JSON (matches POST /api/telemetry envelope) ------
  Serial.print(F("{\"deviceId\":\"solarwise-esp32-01\",\"busV\":"));
  Serial.print(busV, 3);
  Serial.print(F(",\"shuntmV\":"));
  Serial.print(shunt_mV, 2);
  Serial.print(F(",\"loadV\":"));
  Serial.print(loadV, 3);
  Serial.print(F(",\"mA\":"));
  Serial.print(current_mA, 1);
  Serial.print(F(",\"mW\":"));
  Serial.print(power_mW, 0);
  Serial.print(F(",\"faults\":{\"wiring\":"));
  Serial.print(wiring ? "true" : "false");
  Serial.print(F(",\"shading\":"));
  Serial.print(shading ? "true" : "false");
  Serial.print(F(",\"dust\":"));
  Serial.print(dust ? "true" : "false");
  Serial.print(F(",\"battery\":")); 
  Serial.print(battAbuse ? "true" : "false");
  Serial.println(F("}}"));

  // --- 5. Advance detectors --------------------------------------------------
  if (sensorOk && isfinite(power_mW)) {
    powerHistory[histIdx] = power_mW;
    histIdx = (histIdx + 1) % DUST_WINDOW;
    if (histIdx == 0) histFull = true;
    prevPower_mW = power_mW;
  }
}
