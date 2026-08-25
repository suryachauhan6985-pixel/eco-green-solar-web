// api/utils/validators.js
// -----------------------------------------------------------------------------
// Pure offline validation utilities for GSTIN and Indian Mobile Numbers.
// Zero external API calls, zero latency, 100% free and robust.
// -----------------------------------------------------------------------------

const GST_STATES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
};

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Normalizes a GSTIN string: removes non-alphanumerics, trims, converts to uppercase.
 */
function normalizeGstin(input) {
  if (!input) return '';
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Calculates the official 15th Checksum character for the first 14 characters of a GSTIN using Mod-36 algorithm.
 */
function calculateGstinChecksum(first14) {
  if (!first14 || first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = first14[i];
    const val = GST_CHARS.indexOf(char);
    if (val === -1) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = val * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkCode = (36 - (sum % 36)) % 36;
  return GST_CHARS[checkCode];
}

/**
 * Retrieves the full State Name from a GSTIN or 2-digit state code.
 */
function getGstinStateName(codeOrGstin) {
  if (!codeOrGstin) return '';
  const clean = normalizeGstin(codeOrGstin);
  const code = clean.length >= 2 ? clean.substring(0, 2) : clean;
  return GST_STATES[code] || '';
}

/**
 * Comprehensive GSTIN Validator:
 * - Length check (15 chars)
 * - State Code check (01-38, 97, 99)
 * - PAN format check (5 letters + 4 digits + 1 letter)
 * - 13th Entity char check (1-9 or A-Z)
 * - 14th Default char check ('Z')
 * - 15th Mod-36 Checksum verification
 * 
 * Returns: { isValid, isEmpty, gstin, stateCode, stateName, pan, expectedChecksum, actualChecksum, error }
 */
function validateGstin(input) {
  if (input === null || input === undefined || String(input).trim() === '' || String(input).trim() === '-') {
    return { isValid: true, isEmpty: true, gstin: '', stateName: '', stateCode: '', error: null };
  }

  const raw = String(input).trim();
  const normalized = normalizeGstin(raw);

  if (normalized.length !== 15) {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      error: 'Invalid GSTIN'
    };
  }

  // 1. Validate State Code (first 2 digits: 01-38, 97, 99)
  const stateCode = normalized.substring(0, 2);
  const stateName = GST_STATES[stateCode];
  if (!stateName) {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      stateCode: '',
      stateName: '',
      error: 'Invalid GSTIN'
    };
  }

  // 2. Validate PAN (next 10 chars: 3 letters + 4th Entity Type [C,P,H,F,A,T,B,L,J,G] + 1 letter + 4 digits + 1 letter)
  const pan = normalized.substring(2, 12);
  const panRegex = /^[A-Z]{3}[CPHFATBLJG][A-Z][0-9]{4}[A-Z]$/;
  if (!panRegex.test(pan)) {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      stateCode,
      stateName,
      error: 'Invalid GSTIN'
    };
  }

  // 3. Validate Entity code (13th char: 1-9 or A-Z)
  const entityChar = normalized[12];
  if (!/^[1-9A-Z]$/.test(entityChar)) {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      stateCode,
      stateName,
      error: 'Invalid GSTIN'
    };
  }

  // 4. Validate 14th char (Always 'Z')
  const defaultChar = normalized[13];
  if (defaultChar !== 'Z') {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      stateCode,
      stateName,
      error: 'Invalid GSTIN'
    };
  }

  // 5. Validate Mod-36 Checksum (15th char)
  const expectedChecksum = calculateGstinChecksum(normalized.substring(0, 14));
  const actualChecksum = normalized[14];

  if (actualChecksum !== expectedChecksum) {
    return {
      isValid: false,
      isEmpty: false,
      gstin: normalized,
      stateCode,
      stateName,
      error: 'Invalid GSTIN'
    };
  }

  return {
    isValid: true,
    isEmpty: false,
    gstin: normalized,
    stateCode,
    stateName,
    pan,
    error: null
  };
}

/**
 * Normalizes an Indian mobile number by stripping spaces, dashes, dots, and +91/91/0 prefixes.
 */
function normalizeMobile(input) {
  if (!input) return '';
  let cleaned = String(input).trim().replace(/[\s\-\(\)\.\+]/g, '');
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Comprehensive Indian Mobile Number Validator:
 * - Digits-only check
 * - Exactly 10 digits
 * - Starts with 6, 7, 8, or 9
 * 
 * Returns: { isValid, isEmpty, mobile, formatted, error }
 */
function validateMobile(input) {
  if (input === null || input === undefined || String(input).trim() === '' || String(input).trim() === '-') {
    return { isValid: true, isEmpty: true, mobile: '', formatted: '', error: null };
  }

  const raw = String(input).trim();
  const normalized = normalizeMobile(raw);

  if (!/^\d+$/.test(normalized)) {
    return {
      isValid: false,
      isEmpty: false,
      mobile: normalized,
      error: 'Mobile number must contain only numeric digits.'
    };
  }

  if (normalized.length !== 10) {
    return {
      isValid: false,
      isEmpty: false,
      mobile: normalized,
      error: `Mobile number must be exactly 10 digits (currently ${normalized.length} digits).`
    };
  }

  const firstDigit = normalized[0];
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return {
      isValid: false,
      isEmpty: false,
      mobile: normalized,
      error: `Invalid Indian mobile prefix '${firstDigit}'. Must start with 6, 7, 8, or 9.`
    };
  }

  return {
    isValid: true,
    isEmpty: false,
    mobile: normalized,
    formatted: `${normalized.substring(0, 5)} ${normalized.substring(5)}`,
    error: null
  };
}

module.exports = {
  GST_STATES,
  normalizeGstin,
  calculateGstinChecksum,
  getGstinStateName,
  validateGstin,
  normalizeMobile,
  validateMobile
};
