import React, {useEffect, useMemo, useRef, useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {
  Bell,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Shield,
  UserPlus
} from 'lucide-react';
import {
  CONNECTION_STATES,
  default as WebRtcManager
} from './lib/WebRtcManager';
import {createIdentity, generateId, now} from './lib/crypto';
import {fromSignalString, toSignalString} from './lib/signal';
import {cn} from './lib/utils';
import {Avatar, AvatarFallback} from './components/ui/avatar';
import {Badge} from './components/ui/badge';
import {Button} from './components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from './components/ui/dialog';
import {Input} from './components/ui/input';
import {ScrollArea} from './components/ui/scroll-area';
import {Separator} from './components/ui/separator';
import {Tabs, TabsContent, TabsList, TabsTrigger} from './components/ui/tabs';

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
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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

const toStatusVariant = (state) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return 'success';
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return 'warning';
  }
  if (state === CONNECTION_STATES.FAILED) {
    return 'destructive';
  }
  return 'secondary';
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
      setScreen('contacts');
      setActiveMainTab('chats');
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
    setActiveMainTab('chats');
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

  const openAddByCode = () => {
    setAddPeerTab('scan');
    setShowAddPeer(true);
  };

  const openMyQr = () => {
    setAddPeerTab('myid');
    setShowAddPeer(true);
  };

  return (
    <div className="app-root" data-screen={screen} data-tab={activeMainTab}>
      {!profile && (
        <section className="onboarding-screen" data-testid="onboarding-screen">
          <Card className="onboarding-card">
            <CardHeader>
              <Badge variant="secondary" className="onboarding-badge">
                End-to-end encrypted P2P
              </Badge>
              <CardTitle className="onboarding-title">Secure P2P Chat</CardTitle>
              <CardDescription>
                Create your local identity and start decentralized messaging.
              </CardDescription>
            </CardHeader>
            <CardContent className="onboarding-content">
              <label className="field-label" htmlFor="display-name">
                Who are you?
              </label>
              <Input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Choose a display name"
              />
              <Button className="onboarding-submit" onClick={createProfile}>
                Create Profile & Start
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {profile && (
        <div className="app-shell" data-testid="contacts-screen">
          <div className="app-shell-container">
            <aside className="sidebar-panel">
              <Card className="sidebar-header">
                <div className="sidebar-profile-row">
                  <Avatar>
                    <AvatarFallback>{profile.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="sidebar-profile-meta">
                    <h2>P2P Messenger</h2>
                    <p>{shortId(profile.id)}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell size={18} />
                  </Button>
                </div>
                <div className="sidebar-actions">
                  <Button size="sm" onClick={openAddByCode}>
                    <UserPlus size={16} />
                    Add Peer
                  </Button>
                </div>
              </Card>

              <Card className="sidebar-search-card">
                <div className="search-input-wrap">
                  <Search size={16} />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search peers..."
                  />
                </div>
              </Card>

              <Separator />

              <ScrollArea className="sidebar-scroll">
                <div className="peer-list">
                  {filteredPeers.length === 0 ? (
                    <Card className="peer-empty-card">
                      <CardContent>
                        <p>No peers yet</p>
                        <Button size="sm" variant="secondary" onClick={openAddByCode}>
                          Create Connection
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    filteredPeers.map((peer) => {
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
                          className={cn(
                            'peer-list-item',
                            activePeerId === peer.id && 'peer-list-item-active'
                          )}
                          onClick={() => openChat(peer.id)}>
                          <Avatar>
                            <AvatarFallback>
                              {(peer.name || 'P')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="peer-item-content">
                            <div className="peer-item-head">
                              <strong>{peer.name}</strong>
                              <Badge variant={toStatusVariant(state)}>
                                {stateLabel(state)}
                              </Badge>
                            </div>
                            <div className="peer-item-sub">
                              <span>{peer.lastMessagePreview || 'No messages yet'}</span>
                              {unread > 0 && <Badge>{unread}</Badge>}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </aside>

            <main className="main-panel">
              {activeMainTab === 'settings' ? (
                <Card className="settings-card">
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                    <CardDescription>
                      Profile and app preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="settings-content">
                    <div className="setting-row">
                      <span>Display name</span>
                      <strong>{profile.name}</strong>
                    </div>
                    <div className="setting-row">
                      <span>Fingerprint</span>
                      <strong>{profile.identityFingerprint}</strong>
                    </div>
                  </CardContent>
                </Card>
              ) : activePeer ? (
                <Card className="chat-panel">
                  <div className="chat-panel-header">
                    <div className="chat-panel-title-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mobile-only"
                        onClick={() => setScreen('contacts')}>
                        Back
                      </Button>
                      <div>
                        <h3>{activePeer.name}</h3>
                        <Badge
                          variant={toStatusVariant(
                            connectionStates[activePeer.id] ||
                              CONNECTION_STATES.DISCONNECTED
                          )}>
                          {stateLabel(
                            connectionStates[activePeer.id] ||
                              CONNECTION_STATES.DISCONNECTED
                          )}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={openAddByCode}>
                      Connect
                    </Button>
                  </div>

                  <Separator />

                  <ScrollArea className="messages-scroll">
                    <div className="messages-list">
                      {activeMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'bubble-row',
                            message.direction === 'outgoing'
                              ? 'bubble-row-outgoing'
                              : 'bubble-row-incoming'
                          )}>
                          <div
                            className={cn(
                              'bubble',
                              message.direction === 'outgoing'
                                ? 'bubble-outgoing'
                                : 'bubble-incoming'
                            )}>
                            {message.text}
                          </div>
                          <div className="bubble-meta">
                            <span>
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                            {message.direction === 'outgoing' && (
                              <span>{statusText(message.status)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {(connectionStates[activePeer.id] || CONNECTION_STATES.DISCONNECTED) !==
                    CONNECTION_STATES.CONNECTED && (
                    <div className="reconnect-wrap">
                      <Badge variant="warning">Connection interrupted</Badge>
                      <Button size="sm" variant="secondary" onClick={handleGenerateReconnect}>
                        Generate Reconnect Code
                      </Button>
                    </div>
                  )}

                  <div className="compose-row">
                    <Input
                      value={compose}
                      onChange={(event) => setCompose(event.target.value)}
                      placeholder="Type a message..."
                    />
                    <Button onClick={sendMessage}>Send</Button>
                  </div>
                </Card>
              ) : (
                <Card className="empty-panel">
                  <CardHeader>
                    <div className="empty-icon-wrap">
                      <Shield size={28} />
                    </div>
                    <CardTitle>Select a chat</CardTitle>
                    <CardDescription>
                      Start a secure conversation by adding a peer.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="empty-actions">
                    <Button onClick={openAddByCode}>
                      <Plus size={16} />
                      Add by Code
                    </Button>
                    <Button variant="outline" onClick={openMyQr}>
                      Show My QR
                    </Button>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>

          <div className="mobile-bottom-nav">
            <Tabs
              value={activeMainTab}
              onValueChange={(value) => {
                setActiveMainTab(value);
                setScreen('contacts');
              }}>
              <TabsList className="mobile-tabs-list">
                <TabsTrigger value="chats" className="mobile-tab-trigger">
                  <MessageCircle size={16} />
                  Chats
                </TabsTrigger>
                <TabsTrigger value="settings" className="mobile-tab-trigger">
                  <Settings size={16} />
                  Settings
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}

      <Dialog open={showAddPeer} onOpenChange={setShowAddPeer}>
        <DialogContent className="add-peer-dialog">
          <DialogHeader>
            <DialogTitle>Add Peer</DialogTitle>
            <DialogDescription>
              Exchange one-time connection codes to establish secure P2P sessions.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addPeerTab} onValueChange={setAddPeerTab}>
            <TabsList className="dialog-tabs-list">
              <TabsTrigger value="scan">Add by Code</TabsTrigger>
              <TabsTrigger value="myid">My QR</TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="dialog-tab-content">
              <label className="field-label">Target Peer ID</label>
              <Input
                value={peerIdInput}
                onChange={(event) => setPeerIdInput(event.target.value)}
                placeholder="Peer ID"
              />

              <label className="field-label">Peer Name</label>
              <Input
                value={peerNameInput}
                onChange={(event) => setPeerNameInput(event.target.value)}
                placeholder="Optional"
              />

              <Button onClick={handleGenerateOffer}>Create Connection Code</Button>

              <label className="field-label">Paste Offer/Answer Signal</label>
              <textarea
                className="dialog-textarea"
                value={manualSignal}
                onChange={(event) => setManualSignal(event.target.value)}
                placeholder="p2pmsg://..."
              />

              <Button variant="outline" onClick={handleProcessSignal}>
                Complete Connection
              </Button>
            </TabsContent>

            <TabsContent value="myid" className="dialog-tab-content">
              <label className="field-label">My Peer ID</label>
              <Card className="my-id-card">
                <CardContent>{profile?.id || 'Profile required'}</CardContent>
              </Card>
              <div className="qr-box">
                <QRCodeSVG value={generatedSignal || profile?.id || 'missing'} size={210} />
              </div>
              {generatedSignal && (
                <>
                  <label className="field-label">Generated Signal</label>
                  <textarea className="dialog-textarea" readOnly value={generatedSignal} />
                  <Button variant="outline" onClick={copyGeneratedSignal}>
                    Copy Signal
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {errorText && (
        <div className="error-toast" role="alert">
          {errorText}
        </div>
      )}
    </div>
  );
}

export default App;
