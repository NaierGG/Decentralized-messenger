import React, {useEffect, useMemo, useRef, useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {
  CONNECTION_STATES,
  default as WebRtcManager
} from './lib/WebRtcManager';
import {
  createIdentity,
  generateId,
  now
} from './lib/crypto';
import {fromSignalString, toSignalString} from './lib/signal';

const STORAGE_KEY = 'p2p_messenger_web_state_v1';

const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

const orderMessages = (messages) =>
  [...messages].sort((a, b) => a.createdAt - b.createdAt);

const shortId = (value) => {
  if (!value) {
    return '';
  }
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const stateLabel = (state) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return 'Connected';
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return 'Connecting';
  }
  if (state === CONNECTION_STATES.FAILED) {
    return 'Failed';
  }
  return 'Disconnected';
};

const stateClass = (state) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return 'state-connected';
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return 'state-connecting';
  }
  if (state === CONNECTION_STATES.FAILED) {
    return 'state-failed';
  }
  return 'state-disconnected';
};

const statusText = (status) => {
  if (status === MESSAGE_STATUS.SENDING) {
    return '...';
  }
  if (status === MESSAGE_STATUS.SENT) {
    return 'v';
  }
  if (status === MESSAGE_STATUS.READ) {
    return 'vv';
  }
  if (status === MESSAGE_STATUS.FAILED) {
    return '!';
  }
  return '';
};

const readState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

function App() {
  const persisted = readState();
  const [profile, setProfile] = useState(persisted?.profile || null);
  const [peers, setPeers] = useState(persisted?.peers || []);
  const [messagesByPeer, setMessagesByPeer] = useState(persisted?.messagesByPeer || {});
  const [connectionStates, setConnectionStates] = useState({});
  const [screen, setScreen] = useState(persisted?.profile ? 'contacts' : 'onboarding');
  const [activePeerId, setActivePeerId] = useState(null);
  const [name, setName] = useState('');
  const [compose, setCompose] = useState('');
  const [showAddPeer, setShowAddPeer] = useState(false);
  const [addPeerTab, setAddPeerTab] = useState('scan');
  const [peerIdInput, setPeerIdInput] = useState('');
  const [peerNameInput, setPeerNameInput] = useState('');
  const [manualSignal, setManualSignal] = useState('');
  const [generatedSignal, setGeneratedSignal] = useState('');
  const [errorText, setErrorText] = useState('');
  const managerRef = useRef(null);
  const activePeerRef = useRef(activePeerId);

  useEffect(() => {
    activePeerRef.current = activePeerId;
  }, [activePeerId]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profile,
        peers,
        messagesByPeer
      })
    );
  }, [profile, peers, messagesByPeer]);

  const ensureManager = () => {
    if (managerRef.current) {
      return managerRef.current;
    }
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('This browser does not support WebRTC RTCPeerConnection.');
    }
    managerRef.current = new WebRtcManager();
    return managerRef.current;
  };

  useEffect(() => {
    if (!profile) {
      return;
    }
    let manager;
    try {
      manager = ensureManager();
    } catch (error) {
      setErrorText(error.message);
      return;
    }

    manager.setCallbacks({
      onConnectionState: (peerId, state) => {
        setConnectionStates((previous) => ({...previous, [peerId]: state}));
      },
      onSecureMessage: (peerId, payload) => {
        if (payload.kind === 'chat') {
          const incomingMessage = {
            id: payload.messageId || generateId(),
            peerId,
            direction: 'incoming',
            text: payload.text,
            status:
              activePeerRef.current === peerId
                ? MESSAGE_STATUS.READ
                : MESSAGE_STATUS.DELIVERED,
            createdAt: payload.createdAt || now()
          };

          setMessagesByPeer((previous) => {
            const list = previous[peerId] || [];
            return {
              ...previous,
              [peerId]: orderMessages([...list, incomingMessage])
            };
          });

          setPeers((previous) =>
            previous.map((peer) =>
              peer.id === peerId
                ? {
                    ...peer,
                    lastMessagePreview: payload.text,
                    lastMessageAt: incomingMessage.createdAt
                  }
                : peer
            )
          );
        }

        if (payload.kind === 'read') {
          const readIds = payload.messageIds || [];
          setMessagesByPeer((previous) => {
            const list = previous[peerId] || [];
            return {
              ...previous,
              [peerId]: list.map((message) =>
                readIds.includes(message.id) && message.direction === 'outgoing'
                  ? {...message, status: MESSAGE_STATUS.READ}
                  : message
              )
            };
          });
        }
      },
      onError: (error) => {
        setErrorText(error.message || 'WebRTC error');
      }
    });

    return () => {
      manager.closeAll();
    };
  }, [profile]);

  const activePeer = useMemo(
    () => peers.find((peer) => peer.id === activePeerId) || null,
    [activePeerId, peers]
  );
  const activeMessages = useMemo(
    () => (activePeerId ? messagesByPeer[activePeerId] || [] : []),
    [activePeerId, messagesByPeer]
  );

  const upsertPeer = (patch) => {
    setPeers((previous) => {
      const index = previous.findIndex((peer) => peer.id === patch.id);
      if (index === -1) {
        return [
          ...previous,
          {
            id: patch.id,
            name: patch.name || `Peer ${patch.id.slice(0, 6)}`,
            lastMessagePreview: '',
            lastMessageAt: 0
          }
        ];
      }
      const copy = [...previous];
      copy[index] = {...copy[index], ...patch};
      return copy;
    });
  };

  const createProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorText('Display name is required.');
      return;
    }
    try {
      const identity = await createIdentity();
      const created = {
        id: generateId(),
        name: trimmed,
        identityFingerprint: identity.publicFingerprint,
        createdAt: now()
      };
      setProfile(created);
      setScreen('contacts');
      setErrorText('');
    } catch (error) {
      setErrorText(error.message || 'Failed to create profile');
    }
  };

  const sendMessage = async () => {
    if (!profile || !activePeerId || !compose.trim()) {
      return;
    }
    const text = compose.trim();
    setCompose('');
    const messageId = generateId();

    const localMessage = {
      id: messageId,
      peerId: activePeerId,
      direction: 'outgoing',
      text,
      status: MESSAGE_STATUS.SENDING,
      createdAt: now()
    };

    setMessagesByPeer((previous) => {
      const list = previous[activePeerId] || [];
      return {
        ...previous,
        [activePeerId]: orderMessages([...list, localMessage])
      };
    });

    setPeers((previous) =>
      previous.map((peer) =>
        peer.id === activePeerId
          ? {...peer, lastMessagePreview: text, lastMessageAt: localMessage.createdAt}
          : peer
      )
    );

    try {
      const manager = ensureManager();
      await manager.sendSecureMessage(
        activePeerId,
        {
          kind: 'chat',
          messageId,
          text,
          createdAt: localMessage.createdAt
        },
        profile.id
      );
      setMessagesByPeer((previous) => {
        const list = previous[activePeerId] || [];
        return {
          ...previous,
          [activePeerId]: list.map((message) =>
            message.id === messageId ? {...message, status: MESSAGE_STATUS.SENT} : message
          )
        };
      });
    } catch (error) {
      setMessagesByPeer((previous) => {
        const list = previous[activePeerId] || [];
        return {
          ...previous,
          [activePeerId]: list.map((message) =>
            message.id === messageId ? {...message, status: MESSAGE_STATUS.FAILED} : message
          )
        };
      });
      setErrorText(error.message);
    }
  };

  const openChat = (peerId) => {
    setActivePeerId(peerId);
    setScreen('chat');
  };

  const handleGenerateOffer = async () => {
    if (!profile) {
      return;
    }
    const normalizedPeerId = peerIdInput.trim();
    if (!normalizedPeerId) {
      setErrorText('Target peer ID is required.');
      return;
    }

    try {
      const manager = ensureManager();
      upsertPeer({
        id: normalizedPeerId,
        name: peerNameInput.trim() || `Peer ${normalizedPeerId.slice(0, 6)}`
      });
      const offer = await manager.createOffer({
        peerId: normalizedPeerId,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint
      });
      setGeneratedSignal(toSignalString(offer));
      setErrorText('');
      setAddPeerTab('myid');
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const handleProcessSignal = async () => {
    if (!profile) {
      return;
    }
    if (!manualSignal.trim()) {
      setErrorText('Paste signal text first.');
      return;
    }

    try {
      const manager = ensureManager();
      const signal = fromSignalString(manualSignal);

      if (signal.targetPeerId && signal.targetPeerId !== profile.id) {
        throw new Error('Signal target does not match this profile.');
      }

      if (signal.type === 'offer') {
        const remotePeerId = signal.peerId;
        upsertPeer({
          id: remotePeerId,
          name: peerNameInput.trim() || `Peer ${remotePeerId.slice(0, 6)}`
        });
        const answer = await manager.createAnswer({
          offerSignal: signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint
        });
        setGeneratedSignal(toSignalString(answer));
        setPeerIdInput(remotePeerId);
        setAddPeerTab('myid');
      } else if (signal.type === 'answer') {
        const remotePeerId = signal.peerId;
        upsertPeer({
          id: remotePeerId,
          name: peerNameInput.trim() || `Peer ${remotePeerId.slice(0, 6)}`
        });
        await manager.acceptAnswer({
          peerId: remotePeerId,
          answerSignal: signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint
        });
        setPeerIdInput(remotePeerId);
      } else {
        throw new Error('Unsupported signal type');
      }
      setErrorText('');
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const handleGenerateReconnect = async () => {
    if (!profile || !activePeerId) {
      return;
    }
    try {
      const manager = ensureManager();
      const offer = await manager.createOffer({
        peerId: activePeerId,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint,
        restartIce: true
      });
      setGeneratedSignal(toSignalString(offer));
      setShowAddPeer(true);
      setAddPeerTab('myid');
    } catch (error) {
      setErrorText(error.message);
    }
  };

  const copyGeneratedSignal = async () => {
    if (!generatedSignal) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedSignal);
    } catch (error) {
      setErrorText('Clipboard write failed.');
    }
  };

  return (
    <div className="app-shell">
      {screen === 'onboarding' && (
        <section className="onboarding" data-testid="onboarding-screen">
          <div className="orb orb-top" />
          <div className="orb orb-left" />
          <div className="onboarding-inner">
            <div className="hero-wrap">
              <div className="hero-image-wrap">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCixoI0R-UBwVip6lkjlxzTDG7vVcb3snxaLvJ4zB3ii1AnzgDXrCzfxkEginiX1kwCAP3Ci9NMbGEj292yptV665yT44nYJMhlrnj47nBBj627RWCHfxOCPLTL-ji8Slni4bROeTmU8dfUQSUsmaGPcsSyvaco43RYEKwMlnsXSiHC4hF4gnLE9mvDME2xGfRgKTzDJDmnfft68koIyEjP_Hb0M3r57hE2Ja0Ijrvf40TrnMovniAyCWPcQqX39qkGxG61LFKLPoM"
                  alt="Network nodes"
                />
                <div className="badge">E2E Encrypted</div>
              </div>
              <h1>
                Secure <span>P2P</span> Chat
              </h1>
              <p>
                True private messaging in your browser. No central message server.
              </p>
            </div>

            <div className="onboarding-card">
              <label htmlFor="display-name">Who are you?</label>
              <input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Choose a display name"
              />
              <button className="primary-btn" onClick={createProfile}>
                Create Profile & Start
              </button>
              <p className="hint">
                Profile is stored in your browser local storage only.
              </p>
            </div>
          </div>
        </section>
      )}

      {screen === 'contacts' && (
        <section className="contacts" data-testid="contacts-screen">
          <header className="contacts-header">
            <div>
              <h2>P2P Messenger</h2>
              <p>
                Node Online - ID {shortId(profile?.id)} - Fingerprint {profile?.identityFingerprint}
              </p>
            </div>
            <button className="ghost-btn" onClick={() => setShowAddPeer(true)}>
              Add Peer
            </button>
          </header>

          <div className="contacts-list">
            {peers.length === 0 && (
              <div className="empty-block">
                <p>No peers yet</p>
              </div>
            )}
            {peers.map((peer) => {
              const state = connectionStates[peer.id] || CONNECTION_STATES.DISCONNECTED;
              const unread = (messagesByPeer[peer.id] || []).filter(
                (message) =>
                  message.direction === 'incoming' &&
                  message.status !== MESSAGE_STATUS.READ
              ).length;
              return (
                <button
                  key={peer.id}
                  className="peer-row"
                  onClick={() => openChat(peer.id)}>
                  <div className="avatar">{(peer.name || 'P')[0].toUpperCase()}</div>
                  <div className="peer-main">
                    <div className="peer-top">
                      <strong>{peer.name}</strong>
                      <span className={stateClass(state)}>{stateLabel(state)}</span>
                    </div>
                    <div className="peer-bottom">
                      <span>{peer.lastMessagePreview || 'No messages yet'}</span>
                      {unread > 0 && <span className="unread-badge">{unread}</span>}
                    </div>
                    <small>{shortId(peer.id)}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {screen === 'chat' && activePeer && (
        <section className="chat" data-testid="chat-screen">
          <header className="chat-header">
            <button className="ghost-btn" onClick={() => setScreen('contacts')}>
              Back
            </button>
            <div>
              <h3>{activePeer.name}</h3>
              <p className={stateClass(connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED)}>
                {stateLabel(connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED)}
              </p>
            </div>
            <button className="ghost-btn" onClick={() => setShowAddPeer(true)}>
              Signal
            </button>
          </header>

          <div className="secure-chip">Messages secured by end-to-end encryption</div>

          <div className="message-list">
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`bubble-row ${
                  message.direction === 'outgoing' ? 'bubble-row-outgoing' : 'bubble-row-incoming'
                }`}>
                <div
                  className={`bubble ${
                    message.direction === 'outgoing' ? 'bubble-outgoing' : 'bubble-incoming'
                  }`}>
                  {message.text}
                </div>
                <div className="bubble-meta">
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  {message.direction === 'outgoing' && <span>{statusText(message.status)}</span>}
                </div>
              </div>
            ))}
          </div>

          {(connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED) !==
            CONNECTION_STATES.CONNECTED && (
            <div className="reconnect-card">
              <p>Connection dropped. Generate reconnect signal for ICE restart.</p>
              <button className="primary-btn" onClick={handleGenerateReconnect}>
                Generate Reconnect QR
              </button>
            </div>
          )}

          <div className="compose-row">
            <input
              value={compose}
              onChange={(event) => setCompose(event.target.value)}
              placeholder="Message..."
            />
            <button className="primary-btn" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>
      )}

      {showAddPeer && (
        <div className="modal-backdrop">
          <section className="modal">
            <header className="modal-header">
              <h3>Add Peer</h3>
              <button className="ghost-btn" onClick={() => setShowAddPeer(false)}>
                Close
              </button>
            </header>

            <div className="tab-row">
              <button
                className={addPeerTab === 'scan' ? 'tab active-tab' : 'tab'}
                onClick={() => setAddPeerTab('scan')}>
                Scan/Paste
              </button>
              <button
                className={addPeerTab === 'myid' ? 'tab active-tab' : 'tab'}
                onClick={() => setAddPeerTab('myid')}>
                My ID
              </button>
            </div>

            {addPeerTab === 'scan' && (
              <div className="tab-panel">
                <label>Target Peer ID</label>
                <input
                  value={peerIdInput}
                  onChange={(event) => setPeerIdInput(event.target.value)}
                  placeholder="Peer ID"
                />
                <label>Peer Name</label>
                <input
                  value={peerNameInput}
                  onChange={(event) => setPeerNameInput(event.target.value)}
                  placeholder="Optional"
                />
                <button className="primary-btn" onClick={handleGenerateOffer}>
                  Generate Offer
                </button>

                <label>Paste Offer/Answer Signal</label>
                <textarea
                  value={manualSignal}
                  onChange={(event) => setManualSignal(event.target.value)}
                  placeholder="p2pmsg://..."
                />
                <button className="outline-btn" onClick={handleProcessSignal}>
                  Process Signal
                </button>
              </div>
            )}

            {addPeerTab === 'myid' && (
              <div className="tab-panel">
                <label>My Peer ID</label>
                <div className="id-pill">{profile?.id || 'Profile required'}</div>
                <div className="qr-box">
                  <QRCodeSVG value={generatedSignal || profile?.id || 'missing'} size={210} />
                </div>
                {generatedSignal && (
                  <>
                    <p className="signal-label">Generated Signal</p>
                    <textarea readOnly value={generatedSignal} />
                    <button className="outline-btn" onClick={copyGeneratedSignal}>
                      Copy Signal
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {errorText && (
        <div className="error-toast" role="alert">
          {errorText}
        </div>
      )}
    </div>
  );
}

export default App;
