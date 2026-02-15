import {
  RTCPeerConnection,
  RTCSessionDescription
} from 'react-native-webrtc';
import EncryptionService from './EncryptionService';
import {
  CONNECTION_STATES,
  ICE_SERVERS,
  SIGNAL_TYPES
} from '../utils/constants';

const toConnectionState = (state) => {
  switch (state) {
    case CONNECTION_STATES.CONNECTED:
      return CONNECTION_STATES.CONNECTED;
    case CONNECTION_STATES.CONNECTING:
      return CONNECTION_STATES.CONNECTING;
    case CONNECTION_STATES.FAILED:
      return CONNECTION_STATES.FAILED;
    case CONNECTION_STATES.CLOSED:
      return CONNECTION_STATES.CLOSED;
    default:
      return CONNECTION_STATES.DISCONNECTED;
  }
};

class WebRTCService {
  constructor() {
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.peerSessions = new Map();
    this.callbacks = {};
    this.iceConfig = {iceServers: ICE_SERVERS};
  }

  setCallbacks(callbacks) {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks
    };
  }

  async createOffer({peerId, localPeerId, localIdentity, restartIce = false}) {
    const pc = this.ensurePeerConnection(peerId, {initiator: true});
    const offerExtras = EncryptionService.initSessionAsInitiator(peerId, {
      peerId: localPeerId,
      identity: localIdentity
    });

    const offer = await pc.createOffer({iceRestart: restartIce});
    await pc.setLocalDescription(offer);
    const localDescription = await this.waitForIceGatheringComplete(pc);

    return {
      protocolVersion: 2,
      type: SIGNAL_TYPES.OFFER,
      peerId: localPeerId,
      targetPeerId: peerId,
      identity: localIdentity,
      sdp: localDescription.sdp,
      sentAt: Date.now(),
      restartIce,
      ...offerExtras
    };
  }

  async createAnswer({offerSignal, localPeerId, localIdentity}) {
    const peerId = offerSignal.peerId;
    const pc = this.ensurePeerConnection(peerId, {
      initiator: false,
      forceNew: true
    });

    const protocolVersion = Number(offerSignal.protocolVersion || 1);
    let sessionPatch = {
      protocolVersion,
      remoteIdentity: offerSignal.identity || null,
      sendSeq: 0,
      lastReceivedSeq: 0
    };

    let answerExtras = {};
    if (protocolVersion >= 2) {
      if (!offerSignal.keyAgreement?.publicKeyB64 || !offerSignal.nonceB64) {
        throw new Error('Invalid protocol v2 offer payload');
      }
      const result = EncryptionService.initSessionAsResponder(peerId, offerSignal, {
        peerId: localPeerId,
        identity: localIdentity
      });
      sessionPatch = {
        ...sessionPatch,
        protocolVersion: 2,
        sessionKey: result.sessionKey,
        legacySecret: null
      };
      answerExtras = result.answerExtraFields;
    } else {
      // TODO: Remove v1 compatibility path once all clients migrate to protocol v2.
      console.warn(
        '[security] Accepting legacy protocol v1 offer. sessionSecret-based mode is deprecated.'
      );
      const legacySecret =
        offerSignal.sessionSecret || EncryptionService.createSessionSecret();
      sessionPatch = {
        ...sessionPatch,
        protocolVersion: 1,
        sessionKey: EncryptionService.deriveLegacySessionKey(legacySecret),
        legacySecret
      };
      answerExtras = {sessionSecret: legacySecret};
    }

    this.peerSessions.set(peerId, sessionPatch);

    await pc.setRemoteDescription(
      new RTCSessionDescription({type: 'offer', sdp: offerSignal.sdp})
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const localDescription = await this.waitForIceGatheringComplete(pc);

    return {
      protocolVersion: sessionPatch.protocolVersion,
      type: SIGNAL_TYPES.ANSWER,
      peerId: localPeerId,
      targetPeerId: peerId,
      identity: localIdentity,
      sdp: localDescription.sdp,
      sentAt: Date.now(),
      ...answerExtras
    };
  }

  async acceptAnswer({peerId, answerSignal, localPeerId, localIdentity}) {
    const pc = this.ensurePeerConnection(peerId, {initiator: true});
    const existingSession = this.peerSessions.get(peerId) || {
      sendSeq: 0,
      lastReceivedSeq: 0
    };
    const protocolVersion = Number(answerSignal.protocolVersion || 1);

    if (protocolVersion >= 2) {
      if (!answerSignal.keyAgreement?.publicKeyB64 || !answerSignal.nonceB64) {
        throw new Error('Invalid protocol v2 answer payload');
      }
      const sessionKey = EncryptionService.finalizeSessionAsInitiator(
        peerId,
        answerSignal,
        {
          initiatorPeerId: localPeerId || answerSignal.targetPeerId || '',
          responderPeerId: answerSignal.peerId || peerId,
          initiatorIdentity: localIdentity || '',
          responderIdentity:
            answerSignal.identity || existingSession.remoteIdentity || ''
        }
      );
      this.peerSessions.set(peerId, {
        protocolVersion: 2,
        sessionKey,
        legacySecret: null,
        remoteIdentity:
          answerSignal.identity || existingSession.remoteIdentity || null,
        sendSeq: 0,
        lastReceivedSeq: 0
      });
    } else {
      // TODO: Remove v1 compatibility path once all clients migrate to protocol v2.
      console.warn(
        '[security] Accepting legacy protocol v1 answer. sessionSecret-based mode is deprecated.'
      );
      const legacySecret =
        existingSession.legacySecret || answerSignal.sessionSecret;
      if (!legacySecret) {
        throw new Error('Missing legacy sessionSecret for protocol v1');
      }
      this.peerSessions.set(peerId, {
        protocolVersion: 1,
        sessionKey: EncryptionService.deriveLegacySessionKey(legacySecret),
        legacySecret,
        remoteIdentity:
          answerSignal.identity || existingSession.remoteIdentity || null,
        sendSeq: existingSession.sendSeq || 0,
        lastReceivedSeq: existingSession.lastReceivedSeq || 0
      });
    }

    await pc.setRemoteDescription(
      new RTCSessionDescription({type: 'answer', sdp: answerSignal.sdp})
    );
  }

  async sendSecureMessage(peerId, payload, senderId) {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }

    const session = this.peerSessions.get(peerId);
    if (!session || !session.sessionKey) {
      throw new Error('No peer session key available');
    }

    let envelope;
    if (session.protocolVersion === 1 && session.legacySecret) {
      envelope = EncryptionService.packLegacyEnvelope(
        payload,
        session.legacySecret,
        senderId
      );
    } else {
      const seq = (session.sendSeq || 0) + 1;
      envelope = EncryptionService.packSecureEnvelope(
        payload,
        session.sessionKey,
        senderId,
        seq
      );
      this.peerSessions.set(peerId, {
        ...session,
        sendSeq: seq
      });
    }

    channel.send(JSON.stringify({type: 'secure', envelope}));
  }

  getConnectionState(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !pc.connectionState) {
      return CONNECTION_STATES.DISCONNECTED;
    }
    return toConnectionState(pc.connectionState);
  }

  closePeer(peerId) {
    const channel = this.dataChannels.get(peerId);
    if (channel) {
      channel.close();
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
    }

    this.dataChannels.delete(peerId);
    this.peerConnections.delete(peerId);
  }

  closeAll() {
    Array.from(this.peerConnections.keys()).forEach((peerId) => {
      this.closePeer(peerId);
    });
    this.peerSessions.clear();
  }

  ensurePeerConnection(peerId, options = {}) {
    const {initiator = false, forceNew = false} = options;
    const existing = this.peerConnections.get(peerId);

    if (existing && !forceNew) {
      return existing;
    }

    if (existing && forceNew) {
      this.closePeer(peerId);
    }

    const pc = new RTCPeerConnection(this.iceConfig);

    pc.onconnectionstatechange = () => {
      const state = toConnectionState(pc.connectionState);
      if (this.callbacks.onConnectionState) {
        this.callbacks.onConnectionState(peerId, state);
      }
    };

    pc.ondatachannel = (event) => {
      this.attachDataChannel(peerId, event.channel);
    };

    if (initiator) {
      const channel = pc.createDataChannel('chat', {ordered: true});
      this.attachDataChannel(peerId, channel);
    }

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  attachDataChannel(peerId, channel) {
    this.dataChannels.set(peerId, channel);

    channel.onopen = () => {
      if (this.callbacks.onConnectionState) {
        this.callbacks.onConnectionState(peerId, CONNECTION_STATES.CONNECTED);
      }
    };

    channel.onclose = () => {
      if (this.callbacks.onConnectionState) {
        this.callbacks.onConnectionState(
          peerId,
          CONNECTION_STATES.DISCONNECTED
        );
      }
    };

    channel.onerror = (error) => {
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.handleIncomingPayload(peerId, parsed);
      } catch (error) {
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      }
    };
  }

  handleIncomingPayload(peerId, message) {
    if (message.type !== 'secure' || !message.envelope) {
      if (this.callbacks.onRawMessage) {
        this.callbacks.onRawMessage(peerId, message);
      }
      return;
    }

    const session = this.peerSessions.get(peerId);
    if (!session || !session.sessionKey) {
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error(`Missing session key for ${peerId}`));
      }
      return;
    }

    try {
      let unpacked;
      if (message.envelope?.v === 2) {
        unpacked = EncryptionService.unpackSecureEnvelope(
          message.envelope,
          session.sessionKey
        );
        if (unpacked.seq <= (session.lastReceivedSeq || 0)) {
          return;
        }
        this.peerSessions.set(peerId, {
          ...session,
          lastReceivedSeq: unpacked.seq
        });
      } else {
        const legacySecret = session.legacySecret;
        if (!legacySecret) {
          throw new Error('Missing legacy sessionSecret for protocol v1 envelope');
        }
        unpacked = EncryptionService.unpackLegacyEnvelope(
          message.envelope,
          legacySecret
        );
      }

      if (this.callbacks.onSecureMessage) {
        this.callbacks.onSecureMessage(peerId, unpacked.payload);
      }
    } catch (error) {
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }

  waitForIceGatheringComplete(pc, timeoutMs = 12000) {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve(pc.localDescription);
    }

    return new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(pc.localDescription);
      }, timeoutMs);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete' && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(pc.localDescription);
        }
      };
    });
  }
}

export default WebRTCService;
