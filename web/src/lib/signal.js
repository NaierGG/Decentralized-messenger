import {decodePayload, encodePayload} from './payload';

// Legacy aliases kept for compatibility with older imports.
export const toSignalString = (payload) => encodePayload(payload);
export const fromSignalString = (rawSignal) => decodePayload(rawSignal);
