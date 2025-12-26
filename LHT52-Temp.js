// ChirpStack v4 JS codec — Dragino LHT52
// Output field names are aligned to your Node-RED function:
// fPort=2: TempC_SHT, Hum_SHT, TempC_DS
// fPort=5: battery_v / battery_mv / Bat_mV (+ battery_pct)

function decodeUplink(input) {
  const bytes = input.bytes || [];
  const fPort = input.fPort;

  const data = {
    node_type: "LHT52",
    Node_type: "LHT52"
  };
  const warnings = [];
  const errors = [];

  if (!bytes.length) {
    errors.push("Empty payload");
    return { data, warnings, errors };
  }

  function u16be(i) {
    return ((bytes[i] << 8) | bytes[i + 1]) >>> 0;
  }
  function i16be(i) {
    let v = u16be(i);
    if (v & 0x8000) v -= 0x10000;
    return v;
  }
  function u32be(i) {
    return (
      ((bytes[i] << 24) >>> 0) |
      (bytes[i + 1] << 16) |
      (bytes[i + 2] << 8) |
      (bytes[i + 3])
    ) >>> 0;
  }
  function round(n, d) {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
  }
  function hex2(b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }
  function hex4(v) {
    return ("000" + (v & 0xffff).toString(16)).slice(-4);
  }

  // ---------------- fPort 2: Live sensor values (11 bytes) ----------------
  if (fPort === 2) {
    if (bytes.length === 11) {
      // According to Dragino format: Temp (int16, /100), Hum (uint16, /10), ExtTemp DS (int16, /100),
      // Ext flag, Unix timestamp (uint32). :contentReference[oaicite:1]{index=1}
      data.TempC_SHT = round(i16be(0) / 100.0, 2);
      data.Hum_SHT   = round(u16be(2) / 10.0, 1);

      const rawDSu16 = u16be(4);
      if (rawDSu16 === 0x7FFF) {
        // Common "not available" marker
        warnings.push("TempC_DS not available (0x7FFF)");
      } else {
        data.TempC_DS = round(i16be(4) / 100.0, 2);
      }

      data.Ext = bytes[6];                 // 0/1 (external probe connected)
      data.Systimestamp = u32be(7);        // unix timestamp
      return { data, warnings, errors };
    } else {
      data.Status = "RPL data or sensor reset";
      warnings.push(`Unexpected payload length ${bytes.length} on fPort 2 (expected 11)`);
      return { data, warnings, errors };
    }
  }

  // ---------------- fPort 3: Datalog (variable length) ----------------
  if (fPort === 3) {
    data.Status = "Datalog payload (fPort=3) - parse entries in application if needed";
    return { data, warnings, errors };
  }

  // ---------------- fPort 4: DS18B20 ID (8 bytes) ----------------
  if (fPort === 4) {
    if (bytes.length < 8) {
      warnings.push(`Unexpected payload length ${bytes.length} on fPort 4 (expected 8)`);
    }
    data.DS18B20_ID = bytes.map(hex2).join("");
    return { data, warnings, errors };
  }

  // ---------------- fPort 5: Device / battery info ----------------
  if (fPort === 5) {
    if (bytes.length < 7) {
      warnings.push(`Unexpected payload length ${bytes.length} on fPort 5 (expected >= 7)`);
      return { data, warnings, errors };
    }

    data.Sensor_Model = bytes[0];
    const fw = ((bytes[1] << 8) | bytes[2]) & 0xffff;
    data.Firmware_Version = "0x" + hex4(fw);
    data.Freq_Band = bytes[3];
    data.Sub_Band  = bytes[4];

    const bat_mV = ((bytes[5] << 8) | bytes[6]) >>> 0;
    data.Bat_mV = bat_mV;           // matches your Node-RED fallback
    data.battery_mv = bat_mV;
    data.battery_v  = round(bat_mV / 1000.0, 3);

    // battery_pct as in your Node-RED logic (2.8–3.6V)
    const minV = 2.8;
    const maxV = 3.6;
    let pct = (data.battery_v - minV) / (maxV - minV) * 100;
    pct = Math.max(0, Math.min(100, pct));
    data.battery_pct = Math.round(pct);

    return { data, warnings, errors };
  }

  warnings.push(`Unhandled fPort ${fPort}`);
  return { data, warnings, errors };
}

// Optional (keep simple)
function encodeDownlink(input) {
  return { bytes: [], fPort: 1 };
}
