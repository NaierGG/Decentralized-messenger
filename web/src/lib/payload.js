const PRIMARY_PREFIX = 'SESSION1:';
const LEGACY_PREFIX = 'VEIL1:';
const REQUIRED_TYPES = new Set(['invite', 'accept', 'reconnect']);

const USER_MESSAGE = {
  title: 'This QR code is not for Session',
  description:
    'Check that your peer generated this QR code in Session, then scan again.',
  action: 'Scan again',
};

class PayloadError extends Error {
  constructor(code, debug) {
    super(code);
    this.code = code;
    this.debug = debug;
  }
}

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padding)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const validateSchema = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PayloadError('invalid_schema', 'Payload is not an object');
  }

  if (payload.v !== 1) {
    throw new PayloadError('invalid_version', `Unexpected version: ${payload.v}`);
  }

  if (!REQUIRED_TYPES.has(payload.t)) {
    throw new PayloadError('invalid_type', `Unexpected type: ${payload.t}`);
  }

  if (typeof payload.from !== 'string' || !payload.from.trim()) {
    throw new PayloadError('missing_from', 'Missing from field');
  }

  if (typeof payload.ts !== 'number' || !Number.isFinite(payload.ts)) {
    throw new PayloadError('invalid_ts', 'Invalid ts field');
  }

  if (typeof payload.nonce !== 'string' || payload.nonce.length < 10) {
    throw new PayloadError('invalid_nonce', 'Invalid nonce field');
  }

  return payload;
};

export const randomNonce = () => {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const encodePayload = (payload) => {
  const normalized = validateSchema(payload);
  return `${PRIMARY_PREFIX}${toBase64Url(JSON.stringify(normalized))}`;
};

export const decodePayload = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    throw new PayloadError('missing_payload', 'QR text is empty');
  }

  const text = rawText.trim();
  const activePrefix = [PRIMARY_PREFIX, LEGACY_PREFIX].find((prefix) =>
    text.startsWith(prefix)
  );
  if (!activePrefix) {
    throw new PayloadError('bad_prefix', `Invalid prefix: ${text.slice(0, 8)}`);
  }

  const encoded = text.slice(activePrefix.length);

  try {
    const decoded = fromBase64Url(encoded);
    const parsed = JSON.parse(decoded);
    return validateSchema(parsed);
  } catch (error) {
    if (error instanceof PayloadError) {
      throw error;
    }
    throw new PayloadError('decode_failed', error?.message || 'decode failed');
  }
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const toBase32 = (bytes) => {
  let bits = 0;
  let value = 0;
  let output = '';

  bytes.forEach((byte) => {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
};

export const computeSasCode = async (leftId, rightId) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${leftId}:${rightId}`)
  );
  return toBase32(new Uint8Array(digest)).slice(0, 6);
};

export const payloadErrorMessage = () => USER_MESSAGE;

export const logPayloadError = (error, context = '') => {
  console.error(
    '[SESSION_PAYLOAD_ERROR]',
    context,
    error?.code || error?.message,
    error?.debug || error
  );
};
