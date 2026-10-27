// api/utils/vehicleValidator.js
// High-performance vehicle registration number validator (State + RTO Code)
// Preloaded with 1,440+ Indian RTO codes & Bharat Series support

const fs = require('fs');
const path = require('path');

let rtoMap = {};
const knownStates = new Set();
const stateNames = {};

try {
  const jsonPath = path.join(__dirname, '..', 'data', 'rto-data.json');
  if (fs.existsSync(jsonPath)) {
    rtoMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    for (const [code, info] of Object.entries(rtoMap)) {
      const st = code.slice(0, 2);
      knownStates.add(st);
      if (!stateNames[st]) stateNames[st] = info.state;
    }
  }
} catch (e) {
  console.warn('[vehicleValidator] Warning: could not load rto-data.json:', e.message);
}

function normalizeVehicleNumber(input) {
  if (!input || typeof input !== 'string') return '';
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractRtoCode(rawInput, normalized) {
  const trimmed = rawInput.trim().toUpperCase();
  const delimMatch = trimmed.match(/^([A-Z]{2})[\s\-./]+(\d+)/);
  if (delimMatch) {
    return { stateCode: delimMatch[1], rtoNum: delimMatch[2], isExplicitDelim: true };
  }

  const invalidThreeDigitWithLetters = normalized.match(/^([A-Z]{2})(\d{3,})[A-Z]+/);
  if (invalidThreeDigitWithLetters) {
    return { stateCode: invalidThreeDigitWithLetters[1], rtoNum: invalidThreeDigitWithLetters[2], isExplicitDelim: false };
  }

  const invalidThreeDigitOnly = normalized.match(/^([A-Z]{2})(\d{3})$/);
  if (invalidThreeDigitOnly) {
    return { stateCode: invalidThreeDigitOnly[1], rtoNum: invalidThreeDigitOnly[2], isExplicitDelim: false };
  }

  const singleDigitBeforeLetter = normalized.match(/^([A-Z]{2})(\d)[A-Z]/);
  if (singleDigitBeforeLetter) {
    return { stateCode: singleDigitBeforeLetter[1], rtoNum: singleDigitBeforeLetter[2], isExplicitDelim: false };
  }

  const twoDigits = normalized.match(/^([A-Z]{2})(\d{1,2})/);
  if (twoDigits) {
    return { stateCode: twoDigits[1], rtoNum: twoDigits[2], isExplicitDelim: false };
  }

  return null;
}

function validateVehicleNumber(rawInput) {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    return { valid: false, error: 'Vehicle number is required' };
  }

  const normalized = normalizeVehicleNumber(rawInput);

  if (!normalized || normalized.length < 3) {
    return { valid: false, error: 'Vehicle number too short (e.g. GJ-03-AB-1234)' };
  }

  // 1. Bharat Series Check: 21BH1234AA, 22BH..., BH...
  if (/^\d{2}BH/i.test(normalized) || /^BH\d+/i.test(normalized)) {
    return {
      valid: true,
      isBharatSeries: true,
      state: 'Bharat Series (All-India)',
      place: 'MoRTH Central Registry',
      rtoCode: 'BH',
      normalized
    };
  }

  const extracted = extractRtoCode(rawInput, normalized);

  if (!extracted) {
    const lettersOnly = normalized.match(/^([A-Z]{2})/);
    if (lettersOnly && knownStates.has(lettersOnly[1])) {
      return {
        valid: false,
        error: `Incomplete: Please enter RTO digits (e.g. ${lettersOnly[1]}-03)`
      };
    }
    return {
      valid: false,
      error: 'Invalid vehicle format: Must start with State and RTO code (e.g. GJ-03)'
    };
  }

  const { stateCode, rtoNum } = extracted;

  // Reject 3+ digit RTO numbers (e.g. GJ100, GJ-100-AB-1234)
  if (rtoNum.length >= 3) {
    const stateName = stateNames[stateCode] || stateCode;
    return {
      valid: false,
      error: `Invalid RTO Code: ${stateCode}-${rtoNum} does not exist in ${stateName}`
    };
  }

  const codeKey = stateCode + rtoNum;
  const paddedKey = rtoNum.length === 1 ? stateCode + '0' + rtoNum : codeKey;

  const rtoInfo = rtoMap[codeKey] || rtoMap[paddedKey];

  if (!rtoInfo) {
    if (!knownStates.has(stateCode)) {
      return {
        valid: false,
        error: `Invalid State Code: "${stateCode}" is not a recognized Indian State/UT`
      };
    }
    const stateName = stateNames[stateCode] || stateCode;
    return {
      valid: false,
      error: `Invalid RTO Code: ${stateCode}-${rtoNum} does not exist in ${stateName}`
    };
  }

  return {
    valid: true,
    isBharatSeries: false,
    state: rtoInfo.state,
    place: rtoInfo.place,
    rtoCode: paddedKey,
    normalized
  };
}

module.exports = {
  normalizeVehicleNumber,
  validateVehicleNumber
};
