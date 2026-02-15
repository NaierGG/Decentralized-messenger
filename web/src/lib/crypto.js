import {v4 as uuidv4} from 'uuid';

const SIGNAL_CURVE = 'P-256';
const PROTOCOL_INFO_PREFIX = 'p2pmsg-v2';
const AUTH_TAG_BYTES = 16;
const AES_KEY_BYTES = 32;
const pendingInitiatorSessions = new Map();
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const getCrypto = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }
  return globalThis.crypto;
};

const toUint8Array = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof value === 'string') {
    return base64ToBytes(value);
  }
  throw new Error('Invalid binary payload');
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (value) => {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

const concatBytes = (...parts) => {
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalSize);
  let offset = 0;
  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });
  return merged;
};

const randomBytes = (size) => {
  const buffer = new Uint8Array(size);
  getCrypto().getRandomValues(buffer);
  return buffer;
};

const sha256 = async (inputBytes) => {
  const digest = await getCrypto().subtle.digest('SHA-256', inputBytes);
  return new Uint8Array(digest);
};

const importAesKey = (sessionKey, usage) =>
  getCrypto().subtle.importKey(
    'raw',
    normalizeSessionKey(sessionKey),
    {name: 'AES-GCM'},
    false,
    [usage]
  );

const importHmacKey = (secret, usage) =>
  getCrypto().subtle.importKey(
    'raw',
    textEncoder.encode(String(secret || '')),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    [usage]
  );

const normalizeSessionKey = (sessionKey) => {
  const bytes = toUint8Array(sessionKey);
  if (bytes.length === AES_KEY_BYTES) {
    return bytes;
  }
  throw new Error('Invalid session key length');
};

const buildInfo = ({
  initiatorPeerId,
  responderPeerId,
  initiatorIdentity,
  responderIdentity
}) =>
  textEncoder.encode(
    `${PROTOCOL_INFO_PREFIX}|${initiatorPeerId || ''}|${responderPeerId || ''}|${
      initiatorIdentity || ''
    }|${responderIdentity || ''}`
  );

export const generateId = () => uuidv4();
export const now = () => Date.now();

export const createFingerprint = async (value, length = 16) => {
  const digest = await sha256(textEncoder.encode(String(value || '')));
  return bytesToHex(digest).slice(0, length).toUpperCase();
};

export const createIdentity = async () => {
  const privateSeed = bytesToBase64(randomBytes(32));
  return {
    privateSeed,
    publicFingerprint: await createFingerprint(privateSeed, 16)
  };
};

export const createSessionSecret = () => bytesToBase64(randomBytes(32));

export const deriveLegacySessionKey = async (secret) => {
  const digest = await sha256(textEncoder.encode(String(secret || '')));
  return digest.slice(0, AES_KEY_BYTES);
};

const exportPublicKey = async (publicKey) => {
  const rawKey = await getCrypto().subtle.exportKey('raw', publicKey);
  return bytesToBase64(new Uint8Array(rawKey));
};

const importRemotePublicKey = async (publicKeyB64) =>
  getCrypto().subtle.importKey(
    'raw',
    base64ToBytes(publicKeyB64),
    {name: 'ECDH', namedCurve: SIGNAL_CURVE},
    true,
    []
  );

const deriveSharedSecret = async (privateKey, remotePublicKeyB64) => {
  const remotePublicKey = await importRemotePublicKey(remotePublicKeyB64);
  const bits = await getCrypto().subtle.deriveBits(
    {
      name: 'ECDH',
      public: remotePublicKey
    },
    privateKey,
    256
  );
  return new Uint8Array(bits);
};

const deriveSessionKey = async ({
  sharedSecret,
  offerNonce,
  answerNonce,
  initiatorPeerId,
  responderPeerId,
  initiatorIdentity,
  responderIdentity
}) => {
  const hkdfBaseKey = await getCrypto().subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await getCrypto().subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: concatBytes(offerNonce, answerNonce),
      info: buildInfo({
        initiatorPeerId,
        responderPeerId,
        initiatorIdentity,
        responderIdentity
      })
    },
    hkdfBaseKey,
    AES_KEY_BYTES * 8
  );
  return new Uint8Array(bits);
};

export const initSessionAsInitiator = async (peerId, localMeta = {}) => {
  const keyPair = await getCrypto().subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: SIGNAL_CURVE
    },
    true,
    ['deriveBits']
  );
  const offerNonce = randomBytes(16);

  pendingInitiatorSessions.set(peerId, {
    privateKey: keyPair.privateKey,
    offerNonce,
    localMeta
  });

  return {
    keyAgreement: {
      curve: SIGNAL_CURVE,
      publicKeyB64: await exportPublicKey(keyPair.publicKey)
    },
    nonceB64: bytesToBase64(offerNonce)
  };
};

export const initSessionAsResponder = async (peerId, offerSignal, localMeta = {}) => {
  const remotePublicKeyB64 = offerSignal?.keyAgreement?.publicKeyB64;
  if (!remotePublicKeyB64 || !offerSignal?.nonceB64) {
    throw new Error('Invalid offer key agreement payload');
  }

  const keyPair = await getCrypto().subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: SIGNAL_CURVE
    },
    true,
    ['deriveBits']
  );
  const offerNonce = base64ToBytes(offerSignal.nonceB64);
  const answerNonce = randomBytes(16);
  const sharedSecret = await deriveSharedSecret(
    keyPair.privateKey,
    remotePublicKeyB64
  );
  const sessionKey = await deriveSessionKey({
    sharedSecret,
    offerNonce,
    answerNonce,
    initiatorPeerId: offerSignal.peerId || '',
    responderPeerId: localMeta.peerId || offerSignal.targetPeerId || peerId,
    initiatorIdentity: offerSignal.identity || '',
    responderIdentity: localMeta.identity || ''
  });

  return {
    sessionKey,
    answerExtraFields: {
      keyAgreement: {
        curve: SIGNAL_CURVE,
        publicKeyB64: await exportPublicKey(keyPair.publicKey)
      },
      offerNonceB64: offerSignal.nonceB64,
      nonceB64: bytesToBase64(answerNonce)
    }
  };
};

export const finalizeSessionAsInitiator = async (
  peerId,
  answerSignal,
  offerSignalMeta = {}
) => {
  const pending = pendingInitiatorSessions.get(peerId);
  if (!pending) {
    throw new Error('Missing pending initiator session');
  }

  const answerPublicKeyB64 = answerSignal?.keyAgreement?.publicKeyB64;
  if (!answerPublicKeyB64 || !answerSignal?.nonceB64) {
    throw new Error('Invalid answer key agreement payload');
  }

  const expectedOfferNonce = bytesToBase64(pending.offerNonce);
  if (answerSignal.offerNonceB64 !== expectedOfferNonce) {
    throw new Error('Offer nonce mismatch');
  }

  const sharedSecret = await deriveSharedSecret(
    pending.privateKey,
    answerPublicKeyB64
  );
  const sessionKey = await deriveSessionKey({
    sharedSecret,
    offerNonce: pending.offerNonce,
    answerNonce: base64ToBytes(answerSignal.nonceB64),
    initiatorPeerId:
      pending.localMeta.peerId ||
      offerSignalMeta.initiatorPeerId ||
      answerSignal.targetPeerId ||
      '',
    responderPeerId: answerSignal.peerId || offerSignalMeta.responderPeerId || peerId,
    initiatorIdentity:
      pending.localMeta.identity || offerSignalMeta.initiatorIdentity || '',
    responderIdentity:
      answerSignal.identity || offerSignalMeta.responderIdentity || ''
  });

  pendingInitiatorSessions.delete(peerId);
  return sessionKey;
};

export const packSecureEnvelope = async (payload, sessionKey, senderId, seq) => {
  const sentAt = Date.now();
  const iv = randomBytes(12);
  const aad = textEncoder.encode(`${senderId}|${sentAt}|${seq}`);
  const key = await importAesKey(sessionKey, 'encrypt');
  const encrypted = await getCrypto().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
      tagLength: 128
    },
    key,
    textEncoder.encode(JSON.stringify(payload))
  );

  return {
    v: 2,
    senderId,
    sentAt,
    seq,
    ivB64: bytesToBase64(iv),
    cipherTextB64: bytesToBase64(new Uint8Array(encrypted))
  };
};

export const unpackSecureEnvelope = async (envelope, sessionKey) => {
  if (!envelope || envelope.v !== 2) {
    throw new Error('Unsupported secure envelope version');
  }

  const senderId = String(envelope.senderId || '');
  const sentAt = Number(envelope.sentAt);
  const seq = Number(envelope.seq);

  if (!senderId || !Number.isFinite(sentAt) || !Number.isFinite(seq)) {
    throw new Error('Invalid secure envelope metadata');
  }

  const iv = base64ToBytes(envelope.ivB64);
  const cipherText = base64ToBytes(envelope.cipherTextB64);
  const combinedCipherText = envelope.tagB64
    ? concatBytes(cipherText, base64ToBytes(envelope.tagB64))
    : cipherText;
  const aad = textEncoder.encode(`${senderId}|${sentAt}|${seq}`);
  const key = await importAesKey(sessionKey, 'decrypt');
  const decrypted = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad,
      tagLength: 128
    },
    key,
    combinedCipherText
  );

  return {
    payload: JSON.parse(textDecoder.decode(new Uint8Array(decrypted))),
    seq,
    senderId,
    sentAt
  };
};

const signLegacyEnvelope = async (envelope, secret) => {
  const signedPart = [
    envelope.senderId,
    envelope.sentAt,
    envelope.ivB64,
    envelope.tagB64,
    envelope.cipherText
  ].join(':');
  const key = await importHmacKey(secret, 'sign');
  const signature = await getCrypto().subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(signedPart)
  );
  return bytesToHex(new Uint8Array(signature));
};

export const packLegacyEnvelope = async (payload, secret, senderId) => {
  const sentAt = Date.now();
  const iv = randomBytes(12);
  const key = await importAesKey(await deriveLegacySessionKey(secret), 'encrypt');
  const encrypted = new Uint8Array(
    await getCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128
      },
      key,
      textEncoder.encode(JSON.stringify(payload))
    )
  );
  const cipherText = encrypted.slice(0, encrypted.length - AUTH_TAG_BYTES);
  const tag = encrypted.slice(encrypted.length - AUTH_TAG_BYTES);
  const envelope = {
    senderId,
    sentAt,
    ivB64: bytesToBase64(iv),
    tagB64: bytesToBase64(tag),
    cipherText: bytesToBase64(cipherText)
  };

  return {
    ...envelope,
    signature: await signLegacyEnvelope(envelope, secret)
  };
};

export const unpackLegacyEnvelope = async (envelope, secret) => {
  if (!envelope?.cipherText || !envelope?.ivB64 || !envelope?.tagB64) {
    throw new Error('Invalid legacy secure envelope');
  }

  const expectedSignature = await signLegacyEnvelope(envelope, secret);
  if (expectedSignature !== envelope.signature) {
    throw new Error('Legacy signature verification failed');
  }

  const cipherText = base64ToBytes(envelope.cipherText);
  const tag = base64ToBytes(envelope.tagB64);
  const key = await importAesKey(await deriveLegacySessionKey(secret), 'decrypt');
  const decrypted = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.ivB64),
      tagLength: 128
    },
    key,
    concatBytes(cipherText, tag)
  );

  return {
    payload: JSON.parse(textDecoder.decode(new Uint8Array(decrypted))),
    seq: null,
    senderId: envelope.senderId,
    sentAt: Number(envelope.sentAt) || Date.now()
  };
};
