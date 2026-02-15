import CryptoJS from 'crypto-js';
import {v4 as uuidv4} from 'uuid';

export const generateId = () => uuidv4();

export const createFingerprint = (value, length = 16) =>
  CryptoJS.SHA256(value).toString().slice(0, length).toUpperCase();

export const now = () => Date.now();

export const createIdentity = () => {
  const privateSeed = generateId().replace(/-/g, '');
  return {
    privateSeed,
    publicFingerprint: createFingerprint(privateSeed, 16)
  };
};

export const createSessionSecret = () => generateId().replace(/-/g, '');

export const encryptObject = (payload, secret) => {
  const serialized = JSON.stringify(payload);
  return CryptoJS.AES.encrypt(serialized, secret).toString();
};

export const decryptObject = (cipherText, secret) => {
  const bytes = CryptoJS.AES.decrypt(cipherText, secret);
  const decoded = bytes.toString(CryptoJS.enc.Utf8);
  if (!decoded) {
    throw new Error('Decryption failed');
  }
  return JSON.parse(decoded);
};

export const sign = (cipherText, secret, senderId) =>
  CryptoJS.HmacSHA256(`${senderId}:${cipherText}`, secret).toString();

export const verify = (signature, cipherText, secret, senderId) =>
  sign(cipherText, secret, senderId) === signature;

export const packEnvelope = (payload, secret, senderId) => {
  const cipherText = encryptObject(payload, secret);
  return {
    senderId,
    cipherText,
    signature: sign(cipherText, secret, senderId),
    sentAt: now()
  };
};

export const unpackEnvelope = (envelope, secret) => {
  const {senderId, cipherText, signature} = envelope;
  if (!verify(signature, cipherText, secret, senderId)) {
    throw new Error('Signature verification failed');
  }
  return decryptObject(cipherText, secret);
};
