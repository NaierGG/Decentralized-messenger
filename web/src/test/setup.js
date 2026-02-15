import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {webcrypto} from 'node:crypto';
import {afterEach} from 'vitest';

if (!globalThis.crypto?.subtle) {
  globalThis.crypto = webcrypto;
}

afterEach(() => {
  cleanup();
});
