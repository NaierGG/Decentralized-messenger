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
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

const HeaderSection = ({profileId, onCopyId, copied}) => (
  <header className="app-header card">
    <div className="header-main">
      <div className="header-left">
        <div className="app-icon" aria-hidden="true">
          P2P
        </div>
        <div className="header-text">
          <h1 className="app-title">P2P Messenger</h1>
          <div className="status-line">
            <span className="status-dot" aria-hidden="true" />
            <span className="status-text">Online</span>
            <span className="separator" aria-hidden="true">
              |
            </span>
            <span className="user-id">ID: {shortId(profileId)}</span>
            <button
              type="button"
              className={`copy-id-btn ${copied ? 'success-animation' : ''}`}
              onClick={onCopyId}
              aria-label="Copy ID">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 8h10v12H8zM6 4h10v2H8v10H6z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <button className="notification-btn" type="button" aria-label="Notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.4L4.4 15a1 1 0 0 0 .8 1.6h13.6a1 1 0 0 0 .8-1.6L18 12.4V9a6 6 0 0 0-6-6Zm0 18a2.7 2.7 0 0 0 2.5-1.8h-5A2.7 2.7 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        <span className="notification-badge">3</span>
      </button>
    </div>
  </header>
);

const SearchBar = ({value, onChange}) => (
  <div className="search-container">
    <label className="search-wrapper card" aria-label="Search conversations">
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M10.5 4a6.5 6.5 0 1 0 4.05 11.58l3.43 3.44a1 1 0 0 0 1.42-1.42l-3.44-3.43A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
          fill="currentColor"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search conversations..."
        className="search-input"
      />
      <kbd className="search-shortcut">K</kbd>
    </label>
  </div>
);

const EmptyState = ({onScanQr, onShareCode}) => (
  <div className="empty-state">
    <div className="empty-illustration" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="devices-illustration">
        <rect x="30" y="50" width="60" height="100" rx="8" fill="#E0EAFF" />
        <rect
          x="35"
          y="55"
          width="50"
          height="80"
          rx="4"
          fill="#4F7CFF"
          opacity="0.2"
        />
        <rect x="110" y="50" width="60" height="100" rx="8" fill="#E0EAFF" />
        <rect
          x="115"
          y="55"
          width="50"
          height="80"
          rx="4"
          fill="#8B5CF6"
          opacity="0.2"
        />
        <line
          x1="90"
          y1="100"
          x2="110"
          y2="100"
          stroke="#4F7CFF"
          strokeWidth="3"
          strokeDasharray="5,5"
          className="connection-line"
        />
      </svg>
    </div>

    <h2 className="empty-title">Start a Conversation</h2>
    <p className="empty-description">
      Connect with friends securely by scanning their QR code
      <br />
      or sharing yours.
    </p>

    <div className="empty-actions">
      <button className="primary-action" type="button" onClick={onScanQr}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4zM8 8h8v8H8z"
            fill="currentColor"
          />
        </svg>
        Scan QR Code
      </button>

      <div className="divider">
        <span>or</span>
      </div>

      <button className="secondary-action" type="button" onClick={onShareCode}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M18 16a3 3 0 0 0-2.24 1.02l-6.2-3.2a3.15 3.15 0 0 0 0-3.64l6.2-3.2A3 3 0 1 0 15 5a2.9 2.9 0 0 0 .06.6l-6.24 3.21a3 3 0 1 0 0 6.38l6.24 3.21A2.9 2.9 0 0 0 15 19a3 3 0 1 0 3-3Z"
            fill="currentColor"
          />
        </svg>
        Share My Code
      </button>
    </div>

    <p className="empty-hint">Both devices must be online to connect</p>
  </div>
);

const BottomNavigation = ({activeTab, onChats, onSettings}) => (
  <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
    <button
      type="button"
      className={`nav-item ${activeTab === 'chats' ? 'active' : ''}`}
      aria-current={activeTab === 'chats' ? 'page' : undefined}
      onClick={onChats}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5h16v11H7l-3 3V5Zm2 2v7.17L6.17 14H18V7H6Z"
          fill="currentColor"
        />
      </svg>
      <span>Chats</span>
    </button>

    <button
      type="button"
      className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
      onClick={onSettings}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M19.14 12.94a7.48 7.48 0 0 0 .05-.94 7.48 7.48 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.65l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.43h-3.84a.5.5 0 0 0-.5.43l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.83a.5.5 0 0 0 .12.65l2.03 1.58a7.48 7.48 0 0 0-.05.94 7.48 7.48 0 0 0 .05.94L2.83 14.52a.5.5 0 0 0-.12.65l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.43h3.84a.5.5 0 0 0 .5-.43l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.65l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
          fill="currentColor"
        />
      </svg>
      <span>Settings</span>
    </button>
  </nav>
);

function App() {
  const persisted = readState();
  const [profile, setProfile] = useState(persisted?.profile || null);
  const [peers, setPeers] = useState(persisted?.peers || []);
  const [messagesByPeer, setMessagesByPeer] = useState(
    persisted?.messagesByPeer || {}
  );
  const [connectionStates, setConnectionStates] = useState({});
  const [screen, setScreen] = useState(persisted?.profile ? 'contacts' : 'onboarding');
  const [activeMainTab, setActiveMainTab] = useState('chats');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const managerRef = useRef(null);
  const activePeerRef = useRef(activePeerId);
  const copiedTimerRef = useRef(null);

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

  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    []
  );

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
  const filteredPeers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return peers;
    }
    return peers.filter(
      (peer) =>
        peer.id.toLowerCase().includes(query) ||
        (peer.identity || '').toLowerCase().includes(query) ||
        (peer.name || '').toLowerCase().includes(query)
    );
  }, [peers, searchQuery]);

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
      setActiveMainTab('chats');
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
    setActiveMainTab('chats');
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

  const copyProfileId = async () => {
    if (!profile?.id) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => {
        setCopiedId(false);
      }, 900);
    } catch (error) {
      setErrorText('Failed to copy ID');
    }
  };

  const handleOpenScan = () => {
    setAddPeerTab('scan');
    setShowAddPeer(true);
  };

  const handleOpenShare = () => {
    setAddPeerTab('myid');
    setShowAddPeer(true);
  };

  return (
    <div className="app-shell">
      {screen === 'onboarding' && (
        <section className="onboarding" data-testid="onboarding-screen">
          <div className="app-container">
            <div className="onboarding-card card">
              <div className="onboarding-badge">Secure P2P Messaging</div>
              <h1>
                Secure <span>P2P</span> Chat
              </h1>
              <p>
                Private conversations without central message servers.
                <br />
                Your keys stay on your device.
              </p>

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
            </div>
          </div>
        </section>
      )}

      {profile && screen === 'contacts' && (
        <section className="app-container contacts-screen" data-testid="contacts-screen">
          <HeaderSection profileId={profile.id} onCopyId={copyProfileId} copied={copiedId} />

          {activeMainTab === 'chats' ? (
            <>
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <main className="main-content">
                {filteredPeers.length === 0 ? (
                  <EmptyState onScanQr={handleOpenScan} onShareCode={handleOpenShare} />
                ) : (
                  <div className="chat-list card-list">
                    {filteredPeers.map((peer) => {
                      const state =
                        connectionStates[peer.id] || CONNECTION_STATES.DISCONNECTED;
                      const unread = (messagesByPeer[peer.id] || []).filter(
                        (message) =>
                          message.direction === 'incoming' &&
                          message.status !== MESSAGE_STATUS.READ
                      ).length;
                      return (
                        <button
                          key={peer.id}
                          className="peer-row card"
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
                )}
              </main>
            </>
          ) : (
            <main className="main-content">
              <section className="settings-panel card">
                <h2>Settings</h2>
                <p>Profile and preferences UI will be expanded here.</p>
                <div className="settings-row">
                  <span>Display name</span>
                  <strong>{profile.name}</strong>
                </div>
                <div className="settings-row">
                  <span>Fingerprint</span>
                  <strong>{profile.identityFingerprint}</strong>
                </div>
              </section>
            </main>
          )}
        </section>
      )}

      {screen === 'chat' && activePeer && (
        <section className="app-container chat" data-testid="chat-screen">
          <header className="chat-header card">
            <button className="ghost-btn" onClick={() => setScreen('contacts')}>
              Back
            </button>
            <div>
              <h3>{activePeer.name}</h3>
              <p
                className={stateClass(
                  connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED
                )}>
                {stateLabel(
                  connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED
                )}
              </p>
            </div>
            <button className="ghost-btn" onClick={handleOpenScan}>
              Connect
            </button>
          </header>

          <div className="secure-chip card">Messages secured by end-to-end encryption</div>

          <div className="message-list card">
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`bubble-row ${
                  message.direction === 'outgoing'
                    ? 'bubble-row-outgoing'
                    : 'bubble-row-incoming'
                }`}>
                <div
                  className={`bubble ${
                    message.direction === 'outgoing'
                      ? 'bubble-outgoing'
                      : 'bubble-incoming'
                  }`}>
                  {message.text}
                </div>
                <div className="bubble-meta">
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  {message.direction === 'outgoing' && (
                    <span>{statusText(message.status)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED) !==
            CONNECTION_STATES.CONNECTED && (
            <div className="reconnect-card card">
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
          <section className="modal card">
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
                Add by Code
              </button>
              <button
                className={addPeerTab === 'myid' ? 'tab active-tab' : 'tab'}
                onClick={() => setAddPeerTab('myid')}>
                My QR
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
                  Create Connection Code
                </button>

                <label>Paste Offer/Answer Signal</label>
                <textarea
                  value={manualSignal}
                  onChange={(event) => setManualSignal(event.target.value)}
                  placeholder="p2pmsg://..."
                />
                <button className="outline-btn" onClick={handleProcessSignal}>
                  Complete Connection
                </button>
              </div>
            )}

            {addPeerTab === 'myid' && (
              <div className="tab-panel">
                <label>My Peer ID</label>
                <div className="id-pill card">{profile?.id || 'Profile required'}</div>
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

      {profile && (
        <>
          <BottomNavigation
            activeTab={activeMainTab}
            onChats={() => {
              setActiveMainTab('chats');
              setScreen('contacts');
            }}
            onSettings={() => {
              setActiveMainTab('settings');
              setScreen('contacts');
            }}
          />
          <button className="qr-fab" type="button" aria-label="Scan QR code" onClick={handleOpenScan}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4zM8 8h8v8H8z"
                fill="currentColor"
              />
            </svg>
          </button>
        </>
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
