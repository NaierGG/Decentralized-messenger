const SIGNAL_PREFIX = 'p2pmsg://';
const VEIL_SIGNAL_PREFIX = 'VEIL1:';

const encodeBase64Utf8 = (text) => {
  if (typeof btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(text, 'utf-8').toString('base64');
  }

  throw new Error('Base64 encoding is not supported');
};

const decodeBase64Utf8 = (text) => {
  const normalized = String(text)
    .trim()
    .replace(/^data:.*;base64,/, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padding)}`;

  if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf-8');
  }

  throw new Error('Base64 decoding is not supported');
};

const safeDecodeUri = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const looksLikeJson = (value) =>
  String(value).trim().startsWith('{') && String(value).trim().endsWith('}');

const looksLikeBase64 = (value) => /^[A-Za-z0-9+/=_-]+$/.test(value) && value.length >= 24;

const decodeRawSignalString = (rawSignal) => {
  const trimmed = String(rawSignal).trim();

  if (trimmed.startsWith(VEIL_SIGNAL_PREFIX)) {
    return decodeBase64Utf8(trimmed.slice(VEIL_SIGNAL_PREFIX.length));
  }

  if (looksLikeJson(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith(SIGNAL_PREFIX)) {
    const withoutPrefix = trimmed.slice(SIGNAL_PREFIX.length);
    const decodedUri = safeDecodeUri(withoutPrefix);
    if (looksLikeJson(decodedUri)) {
      return decodedUri;
    }
    return decodeBase64Utf8(decodedUri);
  }

  const decodedUri = safeDecodeUri(trimmed);
  if (looksLikeJson(decodedUri)) {
    return decodedUri;
  }

  if (looksLikeBase64(decodedUri)) {
    return decodeBase64Utf8(decodedUri);
  }

  throw new Error('Unknown signal format');
};

export const validateSignalPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Signal payload must be an object');
  }

  if (!['offer', 'answer'].includes(payload.type)) {
    throw new Error('Signal type must be offer or answer');
  }

  if (typeof payload.sdp !== 'string' || !payload.sdp.trim()) {
    throw new Error('Signal payload is missing SDP');
  }

  if (typeof payload.peerId !== 'string' || !payload.peerId.trim()) {
    throw new Error('Signal payload is missing peerId');
  }

  if (
    payload.targetPeerId !== undefined &&
    (typeof payload.targetPeerId !== 'string' || !payload.targetPeerId.trim())
  ) {
    throw new Error('Signal payload has invalid targetPeerId');
  }

  return payload;
};

export const toSignalString = (payload) => {
  const serialized = JSON.stringify(payload);
  return `${VEIL_SIGNAL_PREFIX}${encodeBase64Utf8(serialized)}`;
};

export const fromSignalString = (rawSignal) => {
  if (!rawSignal || typeof rawSignal !== 'string') {
    throw new Error('Invalid signal payload');
  }

  try {
    const decoded = decodeRawSignalString(rawSignal);
    const parsed = JSON.parse(decoded);
    return validateSignalPayload(parsed);
  } catch (error) {
    throw new Error(error?.message || 'Failed to decode signal payload');
  }
};
