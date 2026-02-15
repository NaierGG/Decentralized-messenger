import CryptoJS from 'crypto-js';
import {generateId, createFingerprint} from '../utils/crypto';

class EncryptionService {
  createIdentity() {
    const privateSeed = generateId().replace(/-/g, '');
    const publicFingerprint = createFingerprint(privateSeed, 16);
    return {privateSeed, publicFingerprint};
  }

  createSessionSecret() {
    return generateId().replace(/-/g, '');
  }

  encryptObject(payload, secret) {
    const serialized = JSON.stringify(payload);
    return CryptoJS.AES.encrypt(serialized, secret).toString();
  }

  decryptObject(cipherText, secret) {
    const bytes = CryptoJS.AES.decrypt(cipherText, secret);
    const decoded = bytes.toString(CryptoJS.enc.Utf8);
    if (!decoded) {
      throw new Error('Decryption failed');
    }
    return JSON.parse(decoded);
  }

  sign(cipherText, secret, senderId) {
    return CryptoJS.HmacSHA256(`${senderId}:${cipherText}`, secret).toString();
  }

  verify(signature, cipherText, secret, senderId) {
    const expected = this.sign(cipherText, secret, senderId);
    return expected === signature;
  }

  packSecureEnvelope(payload, secret, senderId) {
    const cipherText = this.encryptObject(payload, secret);
    const signature = this.sign(cipherText, secret, senderId);
    return {
      senderId,
      cipherText,
      signature,
      sentAt: Date.now()
    };
  }

  unpackSecureEnvelope(envelope, secret) {
    const {senderId, cipherText, signature} = envelope;
    if (!this.verify(signature, cipherText, secret, senderId)) {
      throw new Error('Signature verification failed');
    }
    return this.decryptObject(cipherText, secret);
  }
}

export default new EncryptionService();
