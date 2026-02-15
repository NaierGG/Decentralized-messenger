import CryptoJS from 'crypto-js';
import {v4 as uuidv4} from 'uuid';

export const generateId = () => uuidv4();

export const createFingerprint = (value, length = 12) =>
  CryptoJS.SHA256(value).toString().slice(0, length).toUpperCase();

export const toShortPeerLabel = (peerId) =>
  peerId.length <= 10 ? peerId : `${peerId.slice(0, 6)}...${peerId.slice(-4)}`;

export const now = () => Date.now();
