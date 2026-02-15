import {describe, expect, it} from 'vitest';
import {
  finalizeSessionAsInitiator,
  initSessionAsInitiator,
  initSessionAsResponder,
  packLegacyEnvelope,
  packSecureEnvelope,
  unpackLegacyEnvelope,
  unpackSecureEnvelope
} from './crypto';

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));

describe('crypto v2', () => {
  it('derives identical session keys for initiator and responder', async () => {
    const offerExtras = await initSessionAsInitiator('peer-b', {
      peerId: 'peer-a',
      identity: 'ID-A'
    });

    const offerSignal = {
      type: 'offer',
      protocolVersion: 2,
      peerId: 'peer-a',
      targetPeerId: 'peer-b',
      identity: 'ID-A',
      ...offerExtras
    };

    const responderResult = await initSessionAsResponder('peer-a', offerSignal, {
      peerId: 'peer-b',
      identity: 'ID-B'
    });

    const answerSignal = {
      type: 'answer',
      protocolVersion: 2,
      peerId: 'peer-b',
      targetPeerId: 'peer-a',
      identity: 'ID-B',
      ...responderResult.answerExtraFields
    };

    const initiatorKey = await finalizeSessionAsInitiator('peer-b', answerSignal, {
      initiatorPeerId: 'peer-a',
      responderPeerId: 'peer-b',
      initiatorIdentity: 'ID-A',
      responderIdentity: 'ID-B'
    });

    expect(toB64(initiatorKey)).toBe(toB64(responderResult.sessionKey));
  });

  it('encrypts and decrypts envelope with AAD binding', async () => {
    const offerExtras = await initSessionAsInitiator('peer-b', {
      peerId: 'peer-a',
      identity: 'ID-A'
    });
    const offerSignal = {
      protocolVersion: 2,
      peerId: 'peer-a',
      targetPeerId: 'peer-b',
      identity: 'ID-A',
      ...offerExtras
    };
    const responderResult = await initSessionAsResponder('peer-a', offerSignal, {
      peerId: 'peer-b',
      identity: 'ID-B'
    });
    const answerSignal = {
      protocolVersion: 2,
      peerId: 'peer-b',
      targetPeerId: 'peer-a',
      identity: 'ID-B',
      ...responderResult.answerExtraFields
    };
    const sessionKey = await finalizeSessionAsInitiator('peer-b', answerSignal, {
      initiatorPeerId: 'peer-a',
      responderPeerId: 'peer-b',
      initiatorIdentity: 'ID-A',
      responderIdentity: 'ID-B'
    });

    const envelope = await packSecureEnvelope(
      {kind: 'chat', text: 'hello'},
      sessionKey,
      'peer-a',
      1
    );
    const unpacked = await unpackSecureEnvelope(envelope, sessionKey);
    expect(unpacked.payload).toEqual({kind: 'chat', text: 'hello'});
    expect(unpacked.seq).toBe(1);

    await expect(
      unpackSecureEnvelope({...envelope, seq: 2}, sessionKey)
    ).rejects.toThrow();
  });

  it('keeps legacy envelope compatibility path', async () => {
    const envelope = await packLegacyEnvelope(
      {kind: 'chat', text: 'legacy'},
      'legacy-secret',
      'peer-a'
    );
    const unpacked = await unpackLegacyEnvelope(envelope, 'legacy-secret');
    expect(unpacked.payload).toEqual({kind: 'chat', text: 'legacy'});
  });
});
