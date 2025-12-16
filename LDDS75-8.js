// ChirpStack v4 JavaScript codec for Dragino LDDS75

function decodeUplink(input) {
  var fPort = input.fPort;
  var bytes = input.bytes;

  var data = decodeLDDS75(fPort, bytes);

  return {
    data: data,
    warnings: [],
    errors: []
  };
}

function decodeLDDS75(fPort, bytes) {
  var len = bytes.length;

  // LDDS75 sendet Nutzdaten auf fPort 2
  if (fPort !== 2 || len < 4) {
    return {
      node_type: "LDDS75"
    };
  }

  // Batterie: erste 2 Bytes, 14-bit, mV -> V
  var rawBat    = ((bytes[0] << 8) | bytes[1]) & 0x3FFF;
  var battery_v = rawBat / 1000.0; // Volt

  // Batterie in Prozent (2.8–3.6 V)
  var minV = 2.8;
  var maxV = 3.6;
  var pct  = (battery_v - minV) / (maxV - minV) * 100;
  pct = Math.max(0, Math.min(100, pct));
  var battery_pct = Math.round(pct); // 0–100 %

  // Distanz (mm) – Bytes 2+3
  var distance_mm = (bytes[2] << 8) | bytes[3];

  // Interrupt / Status (letztes Byte, falls vorhanden)
  var interrupt_status = (len > 4) ? bytes[len - 1] : null;

  return {
    node_type: "LDDS75",
    battery_v: battery_v,
    battery_pct: battery_pct,
    distance_mm: distance_mm,
    interrupt_status: interrupt_status,
    fPort: fPort
  };
}
