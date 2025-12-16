// ChirpStack v4 JavaScript codec for Dragino RS485-LN (EM122)

function decodeUplink(input) {
  return {
    data: decodeRS485LN(input.fPort, input.bytes, input.variables),
    warnings: [],
    errors: []
  };
}

// Hilfsfunktion: auf zwei Nachkommastellen runden
function round2(x) {
  if (typeof x !== "number" || !isFinite(x)) return x;
  return Math.round(x * 100) / 100;
}

// EM122-spezifischer Float-Decoder
// Rohbytes: [b0, b1, b2, b3] -> [b0, b3, b2, b1] als Little-Endian-Float
function em122Float(b0, b1, b2, b3) {
  var buf = new ArrayBuffer(4);
  var view = new DataView(buf);

  view.setUint8(0, b0);
  view.setUint8(1, b3);
  view.setUint8(2, b2);
  view.setUint8(3, b1);

  return view.getFloat32(0, true); // little-endian
}

function decodeRS485LN(fPort, bytes, variables) {

  // --------------------------------------------------------------
  // fPort 2: EM122 Messwerte
  // --------------------------------------------------------------
  if (fPort === 2) {
    var payver = bytes[0] & 0x7F;

    // Erwartet Payver = 2 und mindestens 17 Bytes
    if (payver !== 2 || bytes.length < 17) {
      return { node_type: "RS485-LN" };
    }

    var o = 1; // Start nach Payver

    var uL1N_raw = em122Float(bytes[o], bytes[o+1], bytes[o+2], bytes[o+3]); o += 4;
    var iL1_raw  = em122Float(bytes[o], bytes[o+1], bytes[o+2], bytes[o+3]); o += 4;
    var pL1_raw  = em122Float(bytes[o], bytes[o+1], bytes[o+2], bytes[o+3]); o += 4;
    var kWh_raw  = em122Float(bytes[o], bytes[o+1], bytes[o+2], bytes[o+3]);

    return {
      node_type:   "RS485-LN",
      L1_Current:  round2(iL1_raw),
      L1_Voltage:  round2(uL1N_raw),
      L1_Power:    round2(Math.abs(pL1_raw)), // immer positiv
      Total_Power: round2(kWh_raw)            // kWh
    };
  }

  // --------------------------------------------------------------
  // fPort 5: Systeminfo (optional)
  // --------------------------------------------------------------
  if (fPort === 5) {
    var freq_band;
    var sub_band;

    if (bytes[0] === 0x01)      freq_band = "EU868";
    else if (bytes[0] === 0x02) freq_band = "US915";
    else if (bytes[0] === 0x03) freq_band = "IN865";
    else if (bytes[0] === 0x04) freq_band = "AU915";
    else if (bytes[0] === 0x05) freq_band = "KZ865";
    else if (bytes[0] === 0x06) freq_band = "RU864";
    else if (bytes[0] === 0x07) freq_band = "AS923";
    else if (bytes[0] === 0x08) freq_band = "AS923_1";
    else if (bytes[0] === 0x09) freq_band = "AS923_2";
    else if (bytes[0] === 0x0A) freq_band = "AS923_3";
    else if (bytes[0] === 0x0F) freq_band = "AS923_4";
    else if (bytes[0] === 0x0B) freq_band = "CN470";
    else if (bytes[0] === 0x0C) freq_band = "EU433";
    else if (bytes[0] === 0x0D) freq_band = "KR920";
    else if (bytes[0] === 0x0E) freq_band = "MA869";

    if (bytes[1] === 0xff) sub_band = "NULL";
    else                   sub_band = bytes[1];

    var firm_ver = (bytes[2] & 0x0f) + "." + ((bytes[3] >> 4) & 0x0f) + "." + (bytes[3] & 0x0f);
    var tdc_time = (bytes[4] << 16) | (bytes[5] << 8) | bytes[6];

    return {
      node_type:        "RS485-LN",
      FIRMWARE_VERSION: firm_ver,
      FREQUENCY_BAND:   freq_band,
      SUB_BAND:         sub_band,
      TDC_sec:          tdc_time
    };
  }

  // Default
  return {
    node_type: "RS485-LN"
  };
}
