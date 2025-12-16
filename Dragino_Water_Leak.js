// ChirpStack v4 JavaScript codec for Dragino LWL02 (Water Leak)

function decodeUplink(input) {
  return {
    data: decodeLWL02(input.fPort, input.bytes, input.variables),
    warnings: [],
    errors: []
  };
}

function decodeLWL02(fPort, bytes, variables) {
  var data = {};

  // Basis-Check
  if (!bytes || bytes.length < 3) {
    data.error = "Payload too short: " + (bytes ? bytes.length : 0) + " bytes";
    data.node_type = "LWL02";
    data.Node_type = "LWL02";
    return data;
  }

  // ----------------------------------------------------
  // Batterie (erste 14 Bits = mV)
  // ----------------------------------------------------
  var raw = ((bytes[0] << 8) | bytes[1]) & 0x3FFF;
  var batV = raw / 1000.0;

  data.BAT_V      = parseFloat(batV.toFixed(3)); // Dragino-Feld
  data.battery_v  = data.BAT_V;                  // einheitlicher Name
  data.battery_mv = raw;

  // Batterie in Prozent (2.8–3.6 V wie bei deinen anderen Sensoren)
  var minV = 2.8;
  var maxV = 3.6;
  var pct  = (batV - minV) / (maxV - minV) * 100;
  pct = Math.max(0, Math.min(100, pct));
  data.battery_pct = Math.round(pct);

  // ----------------------------------------------------
  // Status-Bits aus Byte 0
  // Bit7 = Door Open (für LDS02)
  // Bit6 = Water Leak (für LWL02)
  // ----------------------------------------------------
  var door_open_status  = (bytes[0] & 0x80) ? 1 : 0;
  var water_leak_status = (bytes[0] & 0x40) ? 1 : 0;

  // Wichtig: IMMER ins Objekt schreiben, damit du jede Änderung siehst
  data.DOOR_OPEN_STATUS  = door_open_status;
  data.WATER_LEAK_STATUS = water_leak_status;

  // ----------------------------------------------------
  // MOD + Zähler / Dauer
  // ----------------------------------------------------
  var mod = bytes[2];
  data.MOD = mod;

  if (bytes.length >= 10) {
    var count    = (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
    var duration = (bytes[6] << 16) | (bytes[7] << 8) | bytes[8]; // Minuten
    var alarm    = bytes[9] & 0x01; // bei LWL02 meist 0, bei LDS02 relevant

    if (mod === 1) {
      // Door-Modus (für LDS02, falls Firmware kombiniert ist)
      data.DOOR_OPEN_TIMES         = count;
      data.LAST_DOOR_OPEN_DURATION = duration;
    } else if (mod === 2) {
      // Water-Leak-Modus (LWL02)
      data.WATER_LEAK_TIMES         = count;
      data.LAST_WATER_LEAK_DURATION = duration;
    } else if (mod === 3) {
      // Kombi-Modus – je nach Firmware, hier lassen wir count/duration generisch
      data.COUNTER   = count;
      data.DURATION  = duration;
    }

    data.ALARM = alarm;
  }

  data.node_type = "LWL02";
  data.Node_type = "LWL02";

  return data;
}
