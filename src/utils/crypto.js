import QuickCrypto from 'react-native-quick-crypto';
import {v4 as uuidv4} from 'uuid';

const {createHash} = QuickCrypto;

export const generateId = () => uuidv4();

export const createFingerprint = (value, length = 12) =>
  createHash('sha256')
    .update(String(value))
    .digest('hex')
    .slice(0, length)
    .toUpperCase();

export const toShortPeerLabel = (peerId) =>
  peerId.length <= 10 ? peerId : `${peerId.slice(0, 6)}...${peerId.slice(-4)}`;

export const now = () => Date.now();
