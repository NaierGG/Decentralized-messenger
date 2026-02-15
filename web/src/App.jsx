import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ChevronLeft,
  Copy,
  FileText,
  Fingerprint,
  HelpCircle,
  Key,
  Lock,
  MessageSquare,
  MoreVertical,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
  UserCircle,
  Users,
  Wifi,
  WifiOff,
  CheckCheck,
  Check,
  X,
} from 'lucide-react';
import {
  CONNECTION_STATES,
  default as WebRtcManager,
} from './lib/WebRtcManager';
import { createIdentity, generateId, now } from './lib/crypto';
import { fromSignalString, toSignalString } from './lib/signal';
import {
  clearLegacyState,
  getPersistedState,
  makeBackupPayload,
  parseBackupPayload,
  readLegacyState,
  setPersistedState,
} from './lib/storage';

const DEBUG_CONNECTIONS_VIEW = import.meta.env.VITE_DEBUG_CONNECTIONS === '1';

/* ������������������������������������������������������������������������������������������������
   Constants
   ������������������������������������������������������������������������������������������������ */
const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

const orderMessages = (msgs) =>
  [...msgs].sort((a, b) => a.createdAt - b.createdAt);

const shortId = (v) => {
  if (!v) return '';
  if (v.length <= 14) return v;
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
};

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diff = Math.floor((today - d) / 86400000);
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const relTime = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return formatTime(ts);
  return formatDate(ts);
};

/* ������������������������������������������������������������������������������������������������
   SVG Icons (inline for mobile feel)
   ������������������������������������������������������������������������������������������������ */
const FingerprintIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
    <path d="M5 19.5C5.5 18 6 15 6 12c0-3.5 2.5-6 6-6 3.5 0 6 2.5 6 6 0 4-1 6-2 8" />
    <path d="M12 12v4" />
    <path d="M12 8c-2 0-3 1.5-3 4 0 3 .5 5 1 7" />
    <path d="M15 16c.5-2 .5-4 0-6" />
    <path d="M2 16c1-2 2-4 2-8" />
  </svg>
);

/* ������������������������������������������������������������������������������������������������
   Main App
   ������������������������������������������������������������������������������������������������ */
function App() {
  const [profile, setProfile] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messagesByPeer, setMessagesByPeer] = useState({});
  const [connectionStates, setConnectionStates] = useState({});

  // Navigation
  const [screen, setScreen] = useState('onboarding');
  const [activeTab, setActiveTab] = useState('chats');
  const [activePeerId, setActivePeerId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Inputs
  const [name, setName] = useState('');
  const [compose, setCompose] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add peer
  const [addPeerTab, setAddPeerTab] = useState('mycode');
  const [peerIdInput, setPeerIdInput] = useState('');
  const [peerNameInput, setPeerNameInput] = useState('');
  const [manualSignal, setManualSignal] = useState('');
  const [generatedSignal, setGeneratedSignal] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');

  const [errorText, setErrorText] = useState('');
  const managerRef = useRef(null);
  const activePeerRef = useRef(activePeerId);
  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const restoreInputRef = useRef(null);
  const scannerVideoRef = useRef(null);
  const scannerReaderRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerHandlingRef = useRef(false);

  useEffect(() => { activePeerRef.current = activePeerId; }, [activePeerId]);
  useEffect(() => { document.title = 'Veil'; }, []);

  // Initial load: IndexedDB first, then legacy localStorage fallback.
  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const persisted = await getPersistedState();
        const legacy = persisted ? null : readLegacyState();
        const next = persisted || legacy;

        if (!mounted || !next) {
          if (mounted) setHydrated(true);
          return;
        }

        setProfile(next.profile);
        setPeers(next.peers);
        setMessagesByPeer(next.messagesByPeer);
        setScreen(next.profile ? 'contacts' : 'onboarding');

        if (legacy) {
          await setPersistedState(next);
          clearLegacyState();
        }
      } catch (e) {
        if (mounted) {
          setErrorText('Failed to load saved data');
        }
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  // Persist state
  useEffect(() => {
    if (!hydrated) return;

    setPersistedState({ profile, peers, messagesByPeer }).catch(() => {
      setErrorText('Failed to save data');
    });
  }, [hydrated, profile, peers, messagesByPeer]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByPeer, activePeerId]);

  const stopQrScanner = () => {
    scannerControlsRef.current?.stop?.();
    scannerControlsRef.current = null;

    if (scannerVideoRef.current?.srcObject) {
      scannerVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      scannerVideoRef.current.srcObject = null;
    }

    scannerReaderRef.current?.reset?.();
    scannerReaderRef.current = null;
    scannerHandlingRef.current = false;
  };

  const closeQrScanner = () => {
    setScannerOpen(false);
    stopQrScanner();
  };

  useEffect(() => () => stopQrScanner(), []);

  const ensureManager = () => {
    if (managerRef.current) return managerRef.current;
    if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC not supported');
    managerRef.current = new WebRtcManager();
    return managerRef.current;
  };

  useEffect(() => {
    if (!profile) return;
    let manager;
    try { manager = ensureManager(); } catch (e) { setErrorText(e.message); return; }

    manager.setCallbacks({
      onConnectionState: (peerId, state) => {
        setConnectionStates((prev) => ({ ...prev, [peerId]: state }));
      },
      onSecureMessage: (peerId, payload) => {
        if (payload.kind === 'chat') {
          const msg = {
            id: payload.messageId || generateId(),
            peerId,
            direction: 'incoming',
            text: payload.text,
            status: activePeerRef.current === peerId ? MESSAGE_STATUS.READ : MESSAGE_STATUS.DELIVERED,
            createdAt: payload.createdAt || now(),
          };
          setMessagesByPeer((prev) => ({
            ...prev,
            [peerId]: orderMessages([...(prev[peerId] || []), msg]),
          }));
          setPeers((prev) => prev.map((p) =>
            p.id === peerId ? { ...p, lastMessagePreview: payload.text, lastMessageAt: msg.createdAt } : p
          ));
        }
        if (payload.kind === 'read') {
          const ids = payload.messageIds || [];
          setMessagesByPeer((prev) => ({
            ...prev,
            [peerId]: (prev[peerId] || []).map((m) =>
              ids.includes(m.id) && m.direction === 'outgoing' ? { ...m, status: MESSAGE_STATUS.READ } : m
            ),
          }));
        }
      },
      onError: (err) => setErrorText(err.message || 'WebRTC error'),
    });

    return () => manager.closeAll();
  }, [profile]);

  const activePeer = useMemo(() => peers.find((p) => p.id === activePeerId) || null, [activePeerId, peers]);
  const activeMessages = useMemo(() => activePeerId ? messagesByPeer[activePeerId] || [] : [], [activePeerId, messagesByPeer]);

  const filteredPeers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) =>
      p.id.toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    );
  }, [peers, searchQuery]);

  const pinnedPeers = useMemo(() => filteredPeers.filter((p) => p.pinned), [filteredPeers]);
  const recentPeers = useMemo(() => filteredPeers.filter((p) => !p.pinned), [filteredPeers]);

  const upsertPeer = (patch) => {
    setPeers((prev) => {
      const idx = prev.findIndex((p) => p.id === patch.id);
      if (idx === -1) return [...prev, { id: patch.id, name: patch.name || `Peer ${patch.id.slice(0, 6)}`, lastMessagePreview: '', lastMessageAt: 0, pinned: false }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const createProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setErrorText('Display name is required.'); return; }
    try {
      const identity = await createIdentity();
      setProfile({ id: generateId(), name: trimmed, identityFingerprint: identity.publicFingerprint, createdAt: now() });
      setScreen('contacts');
      setActiveTab('chats');
      setErrorText('');
    } catch (e) { setErrorText(e.message || 'Failed to create profile'); }
  };

  const sendMessage = async () => {
    if (!profile || !activePeerId || !compose.trim()) return;
    const text = compose.trim();
    setCompose('');
    const messageId = generateId();
    const localMsg = { id: messageId, peerId: activePeerId, direction: 'outgoing', text, status: MESSAGE_STATUS.SENDING, createdAt: now() };

    setMessagesByPeer((prev) => ({ ...prev, [activePeerId]: orderMessages([...(prev[activePeerId] || []), localMsg]) }));
    setPeers((prev) => prev.map((p) => p.id === activePeerId ? { ...p, lastMessagePreview: text, lastMessageAt: localMsg.createdAt } : p));

    try {
      const mgr = ensureManager();
      await mgr.sendSecureMessage(activePeerId, { kind: 'chat', messageId, text, createdAt: localMsg.createdAt }, profile.id);
      setMessagesByPeer((prev) => ({ ...prev, [activePeerId]: (prev[activePeerId] || []).map((m) => m.id === messageId ? { ...m, status: MESSAGE_STATUS.SENT } : m) }));
    } catch (e) {
      setMessagesByPeer((prev) => ({ ...prev, [activePeerId]: (prev[activePeerId] || []).map((m) => m.id === messageId ? { ...m, status: MESSAGE_STATUS.FAILED } : m) }));
      setErrorText(e.message);
    }
  };

  const openChat = (peerId) => {
    setActivePeerId(peerId);
    setScreen('chat');
  };

  const handleGenerateOffer = async () => {
    if (!profile) return;
    const pid = peerIdInput.trim();
    if (!pid) { setErrorText('Target peer ID is required.'); return; }
    try {
      const mgr = ensureManager();
      upsertPeer({ id: pid, name: peerNameInput.trim() || `Peer ${pid.slice(0, 6)}` });
      const offer = await mgr.createOffer({ peerId: pid, localPeerId: profile.id, localIdentity: profile.identityFingerprint });
      setGeneratedSignal(toSignalString(offer));
      setErrorText('');
      setAddPeerTab('mycode');
    } catch (e) { setErrorText(e.message); }
  };

  const processSignalPayload = async (rawSignal) => {
    if (!profile) return;

    const mgr = ensureManager();
    const signal = fromSignalString(rawSignal);

    if (signal.targetPeerId && signal.targetPeerId !== profile.id) {
      throw new Error('Signal target mismatch.');
    }

    if (signal.type === 'offer') {
      const rpid = signal.peerId;
      upsertPeer({ id: rpid, name: peerNameInput.trim() || `Peer ${rpid.slice(0, 6)}` });
      const answer = await mgr.createAnswer({
        offerSignal: signal,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint
      });
      setGeneratedSignal(toSignalString(answer));
      setPeerIdInput(rpid);
      setAddPeerTab('mycode');
      return;
    }

    if (signal.type === 'answer') {
      const rpid = signal.peerId;
      upsertPeer({ id: rpid, name: peerNameInput.trim() || `Peer ${rpid.slice(0, 6)}` });
      await mgr.acceptAnswer({
        peerId: rpid,
        answerSignal: signal,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint
      });
      setPeerIdInput(rpid);
      return;
    }

    throw new Error('Unknown signal type');
  };

  const handleProcessSignal = async () => {
    if (!profile) return;
    if (!manualSignal.trim()) { setErrorText('Paste signal text first.'); return; }

    try {
      await processSignalPayload(manualSignal);
      setErrorText('');
    } catch (e) {
      setErrorText(e.message);
    }
  };

  const openQrScanner = () => {
    setScannerError('');
    scannerHandlingRef.current = false;
    setScannerOpen(true);
  };

  useEffect(() => {
    if (!scannerOpen) return undefined;

    let active = true;
    const reader = new BrowserMultiFormatReader();
    scannerReaderRef.current = reader;

    const start = async () => {
      if (!scannerVideoRef.current) {
        setScannerError('Camera preview is unavailable.');
        return;
      }

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          scannerVideoRef.current,
          async (result, err) => {
            if (!active) return;

            if (result && !scannerHandlingRef.current) {
              scannerHandlingRef.current = true;
              const scannedText = result.getText();

              try {
                await processSignalPayload(scannedText);
                setManualSignal(scannedText);
                setErrorText('');
                setScannerError('');
                closeQrScanner();
              } catch (scanError) {
                setScannerError(scanError?.message || 'Invalid QR payload');
                scannerHandlingRef.current = false;
              }
              return;
            }

            if (err && err.name !== 'NotFoundException' && !scannerHandlingRef.current) {
              setScannerError('Unable to read QR code. Keep the code inside frame.');
            }
          }
        );

        if (!active) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
      } catch {
        setScannerError('Camera access failed. Check browser camera permission.');
      }
    };

    start();

    return () => {
      active = false;
      stopQrScanner();
    };
  }, [scannerOpen]);

  const handleGenerateReconnect = async () => {
    if (!profile || !activePeerId) return;
    try {
      const mgr = ensureManager();
      const offer = await mgr.createOffer({ peerId: activePeerId, localPeerId: profile.id, localIdentity: profile.identityFingerprint, restartIce: true });
      setGeneratedSignal(toSignalString(offer));
      setScreen('addpeer');
      setAddPeerTab('mycode');
    } catch (e) { setErrorText(e.message); }
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { setErrorText('Clipboard write failed.'); }
  };

  const backupState = () => {
    try {
      const payload = makeBackupPayload({ profile, peers, messagesByPeer });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `veil-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setErrorText('');
    } catch {
      setErrorText('Backup failed');
    }
  };

  const triggerRestore = () => restoreInputRef.current?.click();

  const handleRestoreFromFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const restored = parseBackupPayload(parsed);
      setProfile(restored.profile);
      setPeers(restored.peers);
      setMessagesByPeer(restored.messagesByPeer);
      setScreen(restored.profile ? 'contacts' : 'onboarding');
      setActiveTab('chats');
      setActivePeerId(null);
      await setPersistedState(restored);
      setErrorText('');
    } catch {
      setErrorText('Restore failed: invalid backup file');
    } finally {
      event.target.value = '';
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setActiveTab('chats');
        setScreen('contacts');
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (event.key === 'Escape') {
        if (scannerOpen) {
          event.preventDefault();
          closeQrScanner();
          return;
        }

        if (['chat', 'addpeer', 'settings', 'connections'].includes(screen)) {
          event.preventDefault();
          setActiveTab('chats');
          setScreen('contacts');
        }
        return;
      }

      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        screen === 'chat' &&
        compose.trim()
      ) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'TEXTAREA') {
          event.preventDefault();
          sendMessage();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compose, screen, scannerOpen, sendMessage]);

  const getConnState = (peerId) => connectionStates[peerId] || CONNECTION_STATES.DISCONNECTED;
  const isConnected = (peerId) => getConnState(peerId) === CONNECTION_STATES.CONNECTED;
  const isConnecting = (peerId) => getConnState(peerId) === CONNECTION_STATES.CONNECTING;

  const getUnreadCount = (peerId) =>
    (messagesByPeer[peerId] || []).filter((m) => m.direction === 'incoming' && m.status !== MESSAGE_STATUS.READ).length;

  /* ������ Render: Onboarding �������������������������������������������� */
  const renderOnboarding = () => (
    <section className="onboarding-screen" data-testid="onboarding-screen">
      {/* Header */}
      <div className="onboarding-header">
        <div className="onboarding-header-left">
          <ArrowLeft size={20} />
        </div>
        <div className="onboarding-status-badge">
          <span className="onboarding-status-dot" />
          P2P NODE ACTIVE
        </div>
        <button className="onboarding-help-btn" aria-label="Help">?</button>
      </div>

      {/* Hero */}
      <div className="onboarding-hero">
        <div className="fingerprint-container">
          <div className="fingerprint-ring" />
          <div className="fingerprint-inner-ring" />
          <FingerprintIcon className="fingerprint-icon" />
        </div>
        <h1 className="onboarding-title">Secure Local Identity</h1>
        <p className="onboarding-subtitle">
          Your identity is a cryptographic key generated right here on your device. No servers. Total privacy.
        </p>
      </div>

      {/* Form */}
      <div className="onboarding-form">
        <span className="onboarding-field-label">Choose a Display Name</span>
        <div className="onboarding-input-wrap">
          <User size={20} />
          <input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alice"
            onKeyDown={(e) => e.key === 'Enter' && createProfile()}
          />
        </div>

        {/* Info Card */}
        <div className="onboarding-info-card">
          <div className="onboarding-info-icon">i</div>
          <div className="onboarding-info-content">
            <h4>Local Key Generation</h4>
            <p>
              We are generating a unique cryptographic key pair. Your private key never leaves this device. This name is just for your contacts to recognize you.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="onboarding-cta">
          <button className="onboarding-btn" onClick={createProfile}>
            <Key size={20} />
            Generate Identity
          </button>

          <div className="onboarding-badges">
            <div className="trust-badge">
              <Lock className="trust-badge-icon" />
              <span className="trust-badge-label">Encrypted</span>
            </div>
            <div className="trust-badge">
              <WifiOff className="trust-badge-icon" />
              <span className="trust-badge-label">No Servers</span>
            </div>
            <div className="trust-badge">
              <Smartphone className="trust-badge-icon" />
              <span className="trust-badge-label">Local Only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  /* ������ Render: Peer List Item ������������������������������������ */
  const renderPeerItem = (peer) => {
    const state = getConnState(peer.id);
    const unread = getUnreadCount(peer.id);
    const online = isConnected(peer.id);
    const connecting = isConnecting(peer.id);
    const lastMsg = peer.lastMessagePreview || '';
    const statusClass = online ? 'online' : connecting ? 'connecting' : 'offline';

    return (
      <button
        key={peer.id}
        className={`peer-item ${activePeerId === peer.id ? 'peer-item-active' : ''}`}
        onClick={() => openChat(peer.id)}
      >
        <div className="peer-avatar">
          <div className="peer-avatar-img">
            <span className="peer-avatar-fallback">
              {(peer.name || 'P')[0].toUpperCase()}
            </span>
          </div>
          <div className={`peer-avatar-status ${statusClass}`} />
        </div>
        <div className="peer-item-body">
          <div className="peer-item-row">
            <span className="peer-item-name">{peer.name}</span>
            <span className={`peer-item-time ${connecting ? 'connecting' : ''}`}>
              {connecting ? 'Connecting...' : peer.lastMessageAt ? relTime(peer.lastMessageAt) : ''}
            </span>
          </div>
          <div className="peer-item-sub-row">
            <span className="peer-item-id">id: {shortId(peer.id)}</span>
            {unread > 0 ? (
              <span className="peer-unread-badge">{unread}</span>
            ) : lastMsg ? (
              <span className="peer-read-check"><CheckCheck size={14} /></span>
            ) : null}
          </div>
        </div>
      </button>
    );
  };

  /* ������ Render: Contacts Screen ���������������������������������� */
  const renderContacts = () => (
    <section className="contacts-screen" data-testid="contacts-screen">
      <div className="contacts-header">
        <div className="contacts-title-row">
          <div>
            <h1 className="contacts-title">Veil</h1>
            <div className="contacts-id">
              <span className="contacts-id-dot" />
              id: {shortId(profile?.id)}
            </div>
          </div>
          <button className="contacts-settings-btn" onClick={() => { setActiveTab('settings'); setScreen('settings'); }}>
            <Settings size={18} />
            <span className="contacts-settings-dot" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="contacts-search">
        <Search size={18} />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ID or Alias..."
        />
      </div>

      {/* Peers */}
      {filteredPeers.length === 0 ? (
        <div className="contacts-empty">
          <div className="contacts-empty-icon">
            <MessageSquare size={28} />
          </div>
          <h3>No conversations yet</h3>
          <p>Tap + to connect with a peer and start a private, encrypted chat.</p>
        </div>
      ) : (
        <div className="contacts-list">
          {pinnedPeers.length > 0 && (
            <>
              <div className="contacts-section-label">Pinned</div>
              {pinnedPeers.map(renderPeerItem)}
            </>
          )}
          {recentPeers.length > 0 && (
            <>
              <div className="contacts-section-label">{pinnedPeers.length > 0 ? 'Recent' : ''}</div>
              {recentPeers.map(renderPeerItem)}
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button className="contacts-fab" onClick={() => setScreen('addpeer')} aria-label="Add Peer">
        <Plus size={24} />
      </button>
    </section>
  );

  /* ������ Render: Chat Screen ������������������������������������������ */
  const renderChat = () => {
    const peer = activePeer;
    if (!peer) return null;
    const connected = isConnected(peer.id);
    const connState = getConnState(peer.id);

    return (
      <section className="chat-screen" data-testid="chat-screen">
        {/* Header */}
        <div className="chat-header">
          <button className="chat-back-btn" onClick={() => { setScreen('contacts'); setActiveTab('chats'); }}>
            <ChevronLeft size={24} />
          </button>
          <div className="chat-header-avatar">
            <span className="chat-header-avatar-fallback">
              {(peer.name || 'P')[0].toUpperCase()}
            </span>
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name">
              {peer.name}
              <span className="node-id">(Node-ID: {shortId(peer.id)})</span>
            </div>
            <div className="chat-header-e2e">
              <Lock size={12} />
              E2E V2 ACTIVE
            </div>
          </div>
          <button className="chat-header-more" aria-label="More options">
            <MoreVertical size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          <div className="chat-date-separator">
            <span className="chat-date-label">Today</span>
          </div>

          {activeMessages.map((msg) => {
            const isOut = msg.direction === 'outgoing';
            return (
              <div key={msg.id} className={`msg-row ${isOut ? 'msg-row-outgoing' : 'msg-row-incoming'}`}>
                {!isOut && (
                  <div className="msg-avatar-row">
                    <div className="msg-small-avatar">
                      <span className="msg-small-avatar-fallback">
                        {(peer.name || 'P')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className={`msg-bubble msg-bubble-incoming`}>
                        {msg.text}
                      </div>
                      <div className="msg-meta">
                        <span className="msg-meta-time">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )}
                {isOut && (
                  <>
                    <div className={`msg-bubble msg-bubble-outgoing`}>
                      {msg.text}
                    </div>
                    <div className="msg-meta">
                      <span className="msg-meta-time">{formatTime(msg.createdAt)}</span>
                      {msg.status === MESSAGE_STATUS.SENDING && (
                        <span className="msg-status-sending">Sending...</span>
                      )}
                      {msg.status === MESSAGE_STATUS.SENT && (
                        <Check size={12} className="msg-status-icon" />
                      )}
                      {(msg.status === MESSAGE_STATUS.DELIVERED || msg.status === MESSAGE_STATUS.READ) && (
                        <CheckCheck size={12} className="msg-status-icon" />
                      )}
                      {msg.status === MESSAGE_STATUS.FAILED && (
                        <span style={{ color: 'var(--red-text)', fontWeight: 600 }}>!</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reconnect Banner */}
        {!connected && connState !== CONNECTION_STATES.CONNECTING && (
          <div className="reconnect-banner">
            <span className="reconnect-label">Connection interrupted</span>
            <button className="reconnect-btn" onClick={handleGenerateReconnect}>
              Reconnect
            </button>
          </div>
        )}

        {/* Compose */}
        <div className="chat-compose">
          <button className="compose-attach-btn" aria-label="Attach">
            <Plus size={20} />
          </button>
          <div className="compose-input-wrap">
            <input
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
              placeholder="Encrypted Message..."
            />
            <Lock size={14} className="compose-lock-icon" />
          </div>
          <button className="compose-send-btn" onClick={sendMessage} aria-label="Send">
            <Send size={20} />
          </button>
        </div>
      </section>
    );
  };

  /* ������ Render: Add Peer Screen ���������������������������������� */
  const renderAddPeer = () => (
    <section className="add-peer-screen" data-testid="add-peer-screen">
      <div className="add-peer-header">
        <button className="chat-back-btn" onClick={() => setScreen('contacts')}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="add-peer-title">New Connection</h2>
        <button className="onboarding-help-btn" aria-label="Help">?</button>
      </div>

      <div className="add-peer-body">
        {/* Tabs */}
        <div className="add-peer-tabs">
          <button
            className={`add-peer-tab ${addPeerTab === 'mycode' ? 'active' : ''}`}
            onClick={() => setAddPeerTab('mycode')}
          >
            My Code
          </button>
          <button
            className={`add-peer-tab ${addPeerTab === 'scan' ? 'active' : ''}`}
            onClick={() => setAddPeerTab('scan')}
          >
            Scan Peer
          </button>
        </div>

        {addPeerTab === 'mycode' ? (
          <div className="qr-section">
            <h2 className="qr-section-title">Secure P2P Handshake</h2>
            <p className="qr-section-subtitle">
              Ask your peer to scan this code to establish a direct, serverless connection.
            </p>

            {/* QR Code */}
            <div className="qr-frame">
              <div className="qr-frame-bl" />
              <div className="qr-frame-br" />
              <div className="qr-inner">
                <QRCodeSVG value={generatedSignal || profile?.id || 'veil://init'} size={180} />
              </div>
            </div>

            {/* ID */}
            <div className="qr-id-display">
              <Shield className="qr-id-icon" size={18} />
              <span className="qr-id-text">ID: {shortId(profile?.id)}</span>
              <button className="qr-copy-btn" onClick={() => copyToClipboard(profile?.id || '')} aria-label="Copy ID">
                <Copy size={12} />
              </button>
            </div>

            {/* Status */}
            <div className="qr-status">
              <span className="qr-status-dot" />
              <span className="qr-status-text">Waiting for handshake...</span>
            </div>

            {/* Actions */}
            <button className="qr-share-btn" onClick={() => copyToClipboard(generatedSignal || profile?.id || '')}>
              <Share2 size={18} />
              Share Code as Image
            </button>
            <button className="qr-regenerate-btn" onClick={() => { setGeneratedSignal(''); setPeerIdInput(''); }}>
              <RefreshCw size={16} />
              Regenerate Offer
            </button>

            {/* Privacy */}
            <div className="qr-privacy-notice">
              <span className="qr-privacy-dot" />
              Private & Direct: No data touches a central server.
            </div>

            {generatedSignal && (
              <div style={{ marginTop: 16 }}>
                <span className="scan-field-label">Generated Signal</span>
                <div className="signal-display">{generatedSignal}</div>
                <button className="scan-secondary-btn" style={{ marginTop: 8 }} onClick={() => copyToClipboard(generatedSignal)}>
                  Copy Signal
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="scan-section">
            <button className="scan-submit-btn" onClick={openQrScanner}>
              Scan QR Code
            </button>

            <span className="scan-field-label">Target Peer ID</span>
            <input
              className="scan-input"
              value={peerIdInput}
              onChange={(e) => setPeerIdInput(e.target.value)}
              placeholder="Enter peer ID"
            />

            <span className="scan-field-label">Peer Name (optional)</span>
            <input
              className="scan-input"
              value={peerNameInput}
              onChange={(e) => setPeerNameInput(e.target.value)}
              placeholder="e.g. Alice"
            />

            <button className="scan-submit-btn" onClick={handleGenerateOffer}>
              Create Connection Code
            </button>

            <span className="scan-field-label" style={{ marginTop: 12 }}>Paste Offer/Answer Signal</span>
            <textarea
              className="scan-textarea"
              value={manualSignal}
              onChange={(e) => setManualSignal(e.target.value)}
              placeholder="VEIL1:..."
            />

            <button className="scan-secondary-btn" onClick={handleProcessSignal}>
              Complete Connection
            </button>
          </div>
        )}
      </div>
    </section>
  );

  /* ������ Render: Nodes Screen ���������������������������������������� */
  const renderConnections = () => (
    <section className="nodes-screen">
      <div className="nodes-header">
        <h1 className="nodes-title">Connections</h1>
        <p className="nodes-subtitle">Active P2P peers and connection status</p>
      </div>

      {peers.length === 0 ? (
        <div className="nodes-empty">
          <p>No active connections. Add a peer to start direct messaging.</p>
        </div>
      ) : (
        <div className="nodes-list">
          {peers.map((peer) => {
            const cls = isConnected(peer.id) ? 'connected' : isConnecting(peer.id) ? 'connecting' : 'disconnected';
            const label = isConnected(peer.id) ? 'Connected' : isConnecting(peer.id) ? 'Connecting' : 'Offline';
            return (
              <div key={peer.id} className="node-card">
                <div className={`node-status-indicator ${cls}`} />
                <div className="node-info">
                  <div className="node-info-name">{peer.name}</div>
                  <div className="node-info-id">{shortId(peer.id)}</div>
                </div>
                <span className={`node-status-label ${cls}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  /* ������ Render: Settings Screen ���������������������������������� */
  const renderSettings = () => (
    <section className="settings-screen">
      <div className="settings-header">
        <h1 className="settings-title">Me</h1>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Profile</div>
        <div className="settings-item">
          <span className="settings-item-label">Display Name</span>
          <span className="settings-item-value">{profile?.name}</span>
        </div>
        <div className="settings-item">
          <span className="settings-item-label">Node ID</span>
          <span className="settings-item-value">{shortId(profile?.id)}</span>
        </div>
        <div className="settings-item">
          <span className="settings-item-label">Fingerprint</span>
          <span className="settings-item-value">{shortId(profile?.identityFingerprint)}</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Security</div>
        <div className="settings-item">
          <span className="settings-item-label">Encryption</span>
          <span className="settings-item-value" style={{ color: 'var(--green-text)' }}>E2E v2 Active</span>
        </div>
        <div className="settings-item">
          <span className="settings-item-label">Key Storage</span>
          <span className="settings-item-value">Local Device</span>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-label">Data</div>
        <div className="settings-actions">
          <button className="settings-action-btn" onClick={backupState}>
            Backup Data
          </button>
          <button className="settings-action-btn" onClick={triggerRestore}>
            Restore Data
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json"
            className="hidden-file-input"
            onChange={handleRestoreFromFile}
          />
        </div>
      </div>
    </section>
  );

  /* ������ Render: Bottom Navigation ������������������������������ */
  const renderBottomNav = () => {
    if (screen === 'onboarding' || screen === 'chat' || screen === 'addpeer') return null;

    const tabs = [
      { id: 'chats', label: 'Veil', icon: <MessageSquare size={22} />, screen: 'contacts' },
      ...(DEBUG_CONNECTIONS_VIEW
        ? [{ id: 'connections', label: 'Connections', icon: <Server size={22} />, screen: 'connections' }]
        : []),
      { id: 'keys', label: 'Keys', icon: <Key size={22} />, screen: 'addpeer' },
      { id: 'settings', label: 'Me', icon: <UserCircle size={22} />, screen: 'settings' },
    ];

    return (
      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setScreen(tab.screen); }}
          >
            {tab.icon}
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    );
  };

  /* ������ Main Render ���������������������������������������������������������� */
  const renderScreen = () => {
    if (!profile) return renderOnboarding();
    switch (screen) {
      case 'chat': return renderChat();
      case 'addpeer': return renderAddPeer();
      case 'connections':
        return DEBUG_CONNECTIONS_VIEW ? renderConnections() : renderContacts();
      case 'settings': return renderSettings();
      case 'contacts':
      default: return renderContacts();
    }
  };

  return (
    <div className="app-root">
      {renderScreen()}
      {renderBottomNav()}

      {scannerOpen && (
        <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Scan QR Code">
          <div className="scanner-modal">
            <div className="scanner-modal-header">
              <h3>Scan QR Code</h3>
              <button className="scanner-close-btn" onClick={closeQrScanner} aria-label="Close scanner">
                <X size={18} />
              </button>
            </div>
            <div className="scanner-video-wrap">
              <video ref={scannerVideoRef} className="scanner-video" muted playsInline />
            </div>
            <p className="scanner-hint">Align the code inside the frame.</p>
            {scannerError && <p className="scanner-error">{scannerError}</p>}
            <button className="scan-secondary-btn" onClick={closeQrScanner}>
              Close
            </button>
          </div>
        </div>
      )}

      {errorText && (
        <div className="error-toast" role="alert" onClick={() => setErrorText('')}>
          Warning: {errorText}
        </div>
      )}
    </div>
  );
}

export default App;


