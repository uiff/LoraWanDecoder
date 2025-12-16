// ChirpStack v4 JavaScript codec for Dragino LWL02 (Door & Water Leak)

function decodeUplink(input) {
  var result = decodeLWL02(input.fPort, input.bytes, input.variables);

  return {
    data: result.data,
    warnings: result.warnings,
    errors: result.errors
  };
}

function decodeLWL02(fPort, bytes, variables) {
  var data = {
    node_type: "LWL02",
    Node_type: "LWL02"
  };

  var warnings = [];
  var errors = [];

  if (!bytes || bytes.length === 0) {
    errors.push("Empty payload");
    return { data: data, warnings: warnings, errors: errors };
  }

  // ------------------------------------------------------------------
  // Basis-Felder (immer dekodieren, sofern mind. 3 Bytes da sind)
  // ------------------------------------------------------------------
  if (bytes.length < 3) {
    errors.push("Payload too short: " + bytes.length + " bytes");
    return { data: data, warnings: warnings, errors: errors };
  }

  // Battery (erste 14 Bit)
  var raw_value = ((bytes[0] << 8) | bytes[1]) & 0x3FFF;
  var bat_mV = raw_value;          // laut Dragino: direkt in mV
  var batV   = bat_mV / 1000.0;    // in Volt

  data.BAT_V      = batV;          // Originalname aus Dragino-Beispiel
  data.battery_mv = bat_mV;        // einheitlicher Feldname
  data.battery_v  = batV;

  // einfache Batterie-Kennlinie 2.8–3.6 V (wie LHT52-Beispiel)
  var minV = 2.8;
  var maxV = 3.6;
  var pct  = (batV - minV) / (maxV - minV) * 100;
  pct = Math.max(0, Math.min(100, pct));
  data.battery_pct = Math.round(pct);

  // Status-Bits
  var door_open_status   = (bytes[0] & 0x80) ? 1 : 0; // 1: open, 0: close
  var water_leak_status  = (bytes[0] & 0x40) ? 1 : 0;

  data.DOOR_OPEN_STATUS  = door_open_status;
  data.WATER_LEAK_STATUS = water_leak_status;

  // Mode
  var mod = bytes[2];
  data.MOD = mod;

  // Alarm-Bit (letztes Byte, Bit0), nur wenn vorhanden
  var alarm = null;
  if (bytes.length >= 10) {
    alarm = bytes[9] & 0x01;
    data.ALARM = alarm;
  }

  // ------------------------------------------------------------------
  // Detail-Dekodierung je nach MOD
  // payload format laut Dragino: 10 Byte
  // [0..1]=Bat+Status, [2]=MOD, [3..5]=count, [6..8]=duration, [9]=alarm/reserved
  // ------------------------------------------------------------------
  if (bytes.length !== 10) {
    warnings.push(
      "Unexpected payload length " + bytes.length + " (expected 10 bytes for full decode)"
    );
    // Wir liefern trotzdem die Basiswerte zurück
    return { data: data, warnings: warnings, errors: errors };
  }

  // nur wenn Byte0 im gültigen Bereich ist (Dragino Beispiel: 0x07 < b0 < 0x0F)
  var header_ok = (bytes[0] > 0x07 && bytes[0] < 0x0F);
  if (!header_ok) {
    warnings.push("Header byte out of expected range: 0x" + bytes[0].toString(16));
  }

  // gemeinsame Zähl- und Dauerfelder
  var count    = (bytes[3] << 16) | (bytes[4] << 8) | bytes[5];
  var duration = (bytes[6] << 16) | (bytes[7] << 8) | bytes[8]; // Minuten

  if (mod === 1) {
    // Tür-Modus
    data.DOOR_OPEN_TIMES          = count;
    data.LAST_DOOR_OPEN_DURATION  = duration;   // Minuten
    // ALARM ist oben bereits gesetzt (falls vorhanden)
  } else if (mod === 2) {
    // Leckage-Modus
    data.WATER_LEAK_TIMES         = count;
    data.LAST_WATER_LEAK_DURATION = duration;   // Minuten
    // Alarm-Feld wird hier optional genutzt, falls vorhanden
  } else if (mod === 3) {
    // Kombinations-Modus (Türe + Leck)
    // Dragino-Referenz-Dekoder liefert hier nur Status + Alarm,
    // Zählfelder könnten je nach Firmware anders belegt sein.
    // Wir belassen count/duration unbenutzt und geben nur Status/Alarm zurück.
    // Falls gewünscht, könntest du hier zusätzliche Felder ergänzen.
  } else {
    warnings.push("Unknown MOD value: " + mod);
  }

  return {
    data: data,
    warnings: warnings,
    errors: errors
  };
}
