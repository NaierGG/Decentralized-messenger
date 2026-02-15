import {Buffer} from 'buffer';

const PREFIX = 'VEIL1:';

const isObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toBase64Url = (value) =>
  Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return Buffer.from(padded, 'base64').toString('utf8');
};

const validateInvite = (payload) => {
  if (!isObject(payload)) {
    return false;
  }
  if (payload.v !== 1 || payload.type !== 'invite') {
    return false;
  }
  if (!String(payload.from || '').trim()) {
    return false;
  }
  if (!String(payload.name || '').trim()) {
    return false;
  }
  if (!String(payload.nonce || '').trim()) {
    return false;
  }
  const ts = Number(payload.timestamp);
  if (!Number.isFinite(ts) || ts <= 0) {
    return false;
  }
  return true;
};

const validateAccept = (payload) => {
  if (!isObject(payload)) {
    return false;
  }
  if (payload.v !== 1 || payload.type !== 'accept') {
    return false;
  }
  if (!String(payload.from || '').trim()) {
    return false;
  }
  if (!String(payload.to || '').trim()) {
    return false;
  }
  if (!String(payload.nonce || '').trim()) {
    return false;
  }
  return true;
};

class InvitationService {
  encodePayload(payload) {
    return `${PREFIX}${toBase64Url(JSON.stringify(payload))}`;
  }

  decodePayload(rawCode) {
    const trimmed = String(rawCode || '').trim();
    if (!trimmed.startsWith(PREFIX)) {
      return {ok: false, error: 'invalid_prefix'};
    }

    const encoded = trimmed.slice(PREFIX.length);
    if (!encoded) {
      return {ok: false, error: 'invalid_format'};
    }

    let decoded = '';
    try {
      decoded = fromBase64Url(encoded);
    } catch (error) {
      return {ok: false, error: 'invalid_base64'};
    }

    let payload;
    try {
      payload = JSON.parse(decoded);
    } catch (error) {
      return {ok: false, error: 'invalid_json'};
    }

    if (validateInvite(payload) || validateAccept(payload)) {
      return {ok: true, payload};
    }

    return {ok: false, error: 'invalid_schema'};
  }

  isInvitePayload(payload) {
    return validateInvite(payload);
  }

  isAcceptPayload(payload) {
    return validateAccept(payload);
  }
}

export default new InvitationService();

