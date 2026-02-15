import {createSessionSecret, packEnvelope, unpackEnvelope} from './crypto';

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
  CLOSED: 'closed'
};

const toConnectionState = (state) => {
  if (state === 'connected') {
    return CONNECTION_STATES.CONNECTED;
  }
  if (state === 'connecting') {
    return CONNECTION_STATES.CONNECTING;
  }
  if (state === 'failed') {
    return CONNECTION_STATES.FAILED;
  }
  if (state === 'closed') {
    return CONNECTION_STATES.CLOSED;
  }
  return CONNECTION_STATES.DISCONNECTED;
};

export default class WebRtcManager {
  constructor() {
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.peerSessions = new Map();
    this.callbacks = {};
    this.iceConfig = {
      iceServers: [
        {urls: 'stun:stun.l.google.com:19302'},
        {urls: 'stun:stun1.l.google.com:19302'}
      ]
    };
  }

  setCallbacks(callbacks) {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks
    };
  }

  async createOffer({peerId, localPeerId, localIdentity, restartIce = false}) {
    const pc = this.ensurePeerConnection(peerId, {initiator: true});
    const session = this.peerSessions.get(peerId) || {
      secret: createSessionSecret(),
      remoteIdentity: null
    };
    this.peerSessions.set(peerId, session);

    const offer = await pc.createOffer({iceRestart: restartIce});
    await pc.setLocalDescription(offer);
    const localDescription = await this.waitForIceGatheringComplete(pc);

    return {
      protocolVersion: 1,
      type: 'offer',
      peerId: localPeerId,
      targetPeerId: peerId,
      identity: localIdentity,
      sessionSecret: session.secret,
      sdp: localDescription.sdp,
      sentAt: Date.now(),
      restartIce
    };
  }

  async createAnswer({offerSignal, localPeerId, localIdentity}) {
    const peerId = offerSignal.peerId;
    const pc = this.ensurePeerConnection(peerId, {initiator: false, forceNew: true});

    this.peerSessions.set(peerId, {
      secret: offerSignal.sessionSecret,
      remoteIdentity: offerSignal.identity || null
    });

    await pc.setRemoteDescription({type: 'offer', sdp: offerSignal.sdp});
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    const localDescription = await this.waitForIceGatheringComplete(pc);

    return {
      protocolVersion: 1,
      type: 'answer',
      peerId: localPeerId,
      targetPeerId: peerId,
      identity: localIdentity,
      sessionSecret: offerSignal.sessionSecret,
      sdp: localDescription.sdp,
      sentAt: Date.now()
    };
  }

  async acceptAnswer({peerId, answerSignal}) {
    const pc = this.ensurePeerConnection(peerId, {initiator: true});

    const existingSession = this.peerSessions.get(peerId) || {};
    this.peerSessions.set(peerId, {
      secret: existingSession.secret || answerSignal.sessionSecret,
      remoteIdentity: answerSignal.identity || existingSession.remoteIdentity
    });

    await pc.setRemoteDescription({type: 'answer', sdp: answerSignal.sdp});
  }

  async sendSecureMessage(peerId, payload, senderId) {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error('DataChannel is not open');
    }
    const session = this.peerSessions.get(peerId);
    if (!session || !session.secret) {
      throw new Error('No session secret available');
    }

    const envelope = packEnvelope(payload, session.secret, senderId);
    channel.send(JSON.stringify({type: 'secure', envelope}));
  }

  closeAll() {
    for (const peerId of this.peerConnections.keys()) {
      this.closePeer(peerId);
    }
    this.peerSessions.clear();
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
      this.callbacks.onConnectionState?.(peerId, state);
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
      this.callbacks.onConnectionState?.(peerId, CONNECTION_STATES.CONNECTED);
    };

    channel.onclose = () => {
      this.callbacks.onConnectionState?.(peerId, CONNECTION_STATES.DISCONNECTED);
    };

    channel.onerror = (error) => {
      this.callbacks.onError?.(error);
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.handleIncomingPayload(peerId, parsed);
      } catch (error) {
        this.callbacks.onError?.(error);
      }
    };
  }

  handleIncomingPayload(peerId, message) {
    if (message.type !== 'secure' || !message.envelope) {
      this.callbacks.onRawMessage?.(peerId, message);
      return;
    }

    const session = this.peerSessions.get(peerId);
    if (!session || !session.secret) {
      this.callbacks.onError?.(new Error(`Missing session secret for ${peerId}`));
      return;
    }

    try {
      const decrypted = unpackEnvelope(message.envelope, session.secret);
      this.callbacks.onSecureMessage?.(peerId, decrypted);
    } catch (error) {
      this.callbacks.onError?.(error);
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

export {CONNECTION_STATES};
