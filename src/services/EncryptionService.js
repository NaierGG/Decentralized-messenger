import QuickCrypto from 'react-native-quick-crypto';
import {Buffer} from 'buffer';
import {createFingerprint} from '../utils/crypto';

const {
  createECDH,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes
} = QuickCrypto;

const CURVE = 'prime256v1';
const SIGNAL_CURVE = 'P-256';
const PROTOCOL_INFO_PREFIX = 'p2pmsg-v2';
const AUTH_TAG_BYTES = 16;
const AES_KEY_BYTES = 32;

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }
  throw new Error('Invalid binary value');
};

const toB64 = (value) => Buffer.from(value).toString('base64');
const fromB64 = (value) => Buffer.from(value || '', 'base64');

const encodeUtf8 = (value) => Buffer.from(String(value), 'utf8');

const hkdfSha256 = ({ikm, salt, info, length}) => {
  const prk = createHmac('sha256', salt).update(ikm).digest();
  let block = Buffer.alloc(0);
  let output = Buffer.alloc(0);
  let counter = 1;

  while (output.length < length) {
    block = createHmac('sha256', prk)
      .update(Buffer.concat([block, info, Buffer.from([counter])]))
      .digest();
    output = Buffer.concat([output, block]);
    counter += 1;
  }

  return output.subarray(0, length);
};

const buildInfo = ({
  initiatorPeerId,
  responderPeerId,
  initiatorIdentity,
  responderIdentity
}) =>
  encodeUtf8(
    `${PROTOCOL_INFO_PREFIX}|${initiatorPeerId || ''}|${responderPeerId || ''}|${
      initiatorIdentity || ''
    }|${responderIdentity || ''}`
  );

class EncryptionService {
  constructor() {
    this.pendingInitiatorSessions = new Map();
  }

  createIdentity() {
    const privateSeed = toB64(randomBytes(32));
    const publicFingerprint = createFingerprint(privateSeed, 16);
    return {privateSeed, publicFingerprint};
  }

  createSessionSecret() {
    return toB64(randomBytes(32));
  }

  normalizeSessionKey(sessionKey) {
    const key = toBuffer(sessionKey);
    if (key.length === AES_KEY_BYTES) {
      return key;
    }
    return createHash('sha256').update(key).digest().subarray(0, AES_KEY_BYTES);
  }

  deriveLegacySessionKey(secret) {
    return createHash('sha256')
      .update(Buffer.from(String(secret || ''), 'utf8'))
      .digest()
      .subarray(0, AES_KEY_BYTES);
  }

  deriveSessionKey({
    sharedSecret,
    offerNonce,
    answerNonce,
    initiatorPeerId,
    responderPeerId,
    initiatorIdentity,
    responderIdentity
  }) {
    return hkdfSha256({
      ikm: sharedSecret,
      salt: Buffer.concat([offerNonce, answerNonce]),
      info: buildInfo({
        initiatorPeerId,
        responderPeerId,
        initiatorIdentity,
        responderIdentity
      }),
      length: AES_KEY_BYTES
    });
  }

  initSessionAsInitiator(peerId, localMeta = {}) {
    const ecdh = createECDH(CURVE);
    ecdh.generateKeys();
    const offerNonce = randomBytes(16);

    this.pendingInitiatorSessions.set(peerId, {
      ecdh,
      offerNonce,
      localMeta
    });

    return {
      keyAgreement: {
        curve: SIGNAL_CURVE,
        publicKeyB64: toB64(ecdh.getPublicKey(null, 'uncompressed'))
      },
      nonceB64: toB64(offerNonce)
    };
  }

  initSessionAsResponder(peerId, offerSignal, localMeta = {}) {
    const offerKeyB64 = offerSignal?.keyAgreement?.publicKeyB64;
    if (!offerKeyB64 || !offerSignal?.nonceB64) {
      throw new Error('Invalid offer key agreement payload');
    }

    const remotePublicKey = fromB64(offerKeyB64);
    const offerNonce = fromB64(offerSignal.nonceB64);
    const answerNonce = randomBytes(16);
    const ecdh = createECDH(CURVE);
    ecdh.generateKeys();
    const sharedSecret = ecdh.computeSecret(remotePublicKey);

    const sessionKey = this.deriveSessionKey({
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
          publicKeyB64: toB64(ecdh.getPublicKey(null, 'uncompressed'))
        },
        offerNonceB64: offerSignal.nonceB64,
        nonceB64: toB64(answerNonce)
      }
    };
  }

  finalizeSessionAsInitiator(peerId, answerSignal, offerSignalMeta = {}) {
    const pending = this.pendingInitiatorSessions.get(peerId);
    if (!pending) {
      throw new Error('Missing pending initiator session');
    }

    const answerPublicKeyB64 = answerSignal?.keyAgreement?.publicKeyB64;
    if (!answerPublicKeyB64 || !answerSignal?.nonceB64) {
      throw new Error('Invalid answer key agreement payload');
    }

    const expectedOfferNonceB64 = toB64(pending.offerNonce);
    if (answerSignal.offerNonceB64 !== expectedOfferNonceB64) {
      throw new Error('Offer nonce mismatch');
    }

    const sessionKey = this.deriveSessionKey({
      sharedSecret: pending.ecdh.computeSecret(fromB64(answerPublicKeyB64)),
      offerNonce: pending.offerNonce,
      answerNonce: fromB64(answerSignal.nonceB64),
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

    this.pendingInitiatorSessions.delete(peerId);
    return sessionKey;
  }

  packSecureEnvelope(payload, sessionKey, senderId, seq) {
    const sentAt = Date.now();
    const iv = randomBytes(12);
    const key = this.normalizeSessionKey(sessionKey);
    const aad = encodeUtf8(`${senderId}|${sentAt}|${seq}`);
    const serialized = JSON.stringify(payload);

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    const cipherText = Buffer.concat([
      cipher.update(serialized, 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return {
      v: 2,
      senderId,
      sentAt,
      seq,
      ivB64: toB64(iv),
      cipherTextB64: toB64(cipherText),
      tagB64: toB64(tag)
    };
  }

  unpackSecureEnvelope(envelope, sessionKey) {
    if (!envelope || envelope.v !== 2) {
      throw new Error('Unsupported secure envelope version');
    }

    const key = this.normalizeSessionKey(sessionKey);
    const senderId = String(envelope.senderId || '');
    const sentAt = Number(envelope.sentAt);
    const seq = Number(envelope.seq);

    if (!senderId || !Number.isFinite(sentAt) || !Number.isFinite(seq)) {
      throw new Error('Invalid secure envelope metadata');
    }

    const iv = fromB64(envelope.ivB64);
    let cipherText = fromB64(envelope.cipherTextB64);
    let tag = envelope.tagB64 ? fromB64(envelope.tagB64) : null;

    if (!tag) {
      if (cipherText.length <= AUTH_TAG_BYTES) {
        throw new Error('Invalid secure envelope ciphertext');
      }
      tag = cipherText.subarray(cipherText.length - AUTH_TAG_BYTES);
      cipherText = cipherText.subarray(0, cipherText.length - AUTH_TAG_BYTES);
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(encodeUtf8(`${senderId}|${sentAt}|${seq}`));
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return {
      payload: JSON.parse(plaintext.toString('utf8')),
      seq,
      senderId,
      sentAt
    };
  }

  signLegacyEnvelope(envelope, secret) {
    const signedPart = [
      envelope.senderId,
      envelope.sentAt,
      envelope.ivB64,
      envelope.tagB64,
      envelope.cipherText
    ].join(':');
    return createHmac('sha256', Buffer.from(String(secret || ''), 'utf8'))
      .update(signedPart)
      .digest('hex');
  }

  packLegacyEnvelope(payload, secret, senderId) {
    const sentAt = Date.now();
    const iv = randomBytes(12);
    const key = this.deriveLegacySessionKey(secret);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const cipherText = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final()
    ]);
    const envelope = {
      senderId,
      sentAt,
      ivB64: toB64(iv),
      tagB64: toB64(cipher.getAuthTag()),
      cipherText: toB64(cipherText)
    };

    return {
      ...envelope,
      signature: this.signLegacyEnvelope(envelope, secret)
    };
  }

  unpackLegacyEnvelope(envelope, secret) {
    if (!envelope?.cipherText || !envelope?.ivB64 || !envelope?.tagB64) {
      throw new Error('Invalid legacy secure envelope');
    }

    const expectedSignature = this.signLegacyEnvelope(envelope, secret);
    if (expectedSignature !== envelope.signature) {
      throw new Error('Legacy signature verification failed');
    }

    const key = this.deriveLegacySessionKey(secret);
    const decipher = createDecipheriv('aes-256-gcm', key, fromB64(envelope.ivB64));
    decipher.setAuthTag(fromB64(envelope.tagB64));

    const plaintext = Buffer.concat([
      decipher.update(fromB64(envelope.cipherText)),
      decipher.final()
    ]);
    return {
      payload: JSON.parse(plaintext.toString('utf8')),
      seq: null,
      senderId: envelope.senderId,
      sentAt: Number(envelope.sentAt) || Date.now()
    };
  }
}

export default new EncryptionService();
