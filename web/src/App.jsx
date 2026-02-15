import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { QRCodeCanvas } from 'qrcode.react';
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
import {
  computeSasCode,
  decodePayload,
  encodePayload,
  logPayloadError,
  randomNonce,
} from './lib/payload';
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
  const [addPeerTab, setAddPeerTab] = useState('invite');
  const [manualSignal, setManualSignal] = useState('');
  const [generatedSignal, setGeneratedSignal] = useState('');
  const [pendingConnections, setPendingConnections] = useState([]);
  const [connectionFlow, setConnectionFlow] = useState({
    state: 'idle',
    payload: null,
    responsePayload: null,
    sas: '',
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');

  const [toast, setToast] = useState(null);
  const managerRef = useRef(null);
  const activePeerRef = useRef(activePeerId);
  const messagesEndRef = useRef(null);
  const searchInputRef = useRef(null);
  const restoreInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const scannerVideoRef = useRef(null);
  const scannerReaderRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const scannerHandlingRef = useRef(false);
  const pendingConnectionsRef = useRef(pendingConnections);

  useEffect(() => { activePeerRef.current = activePeerId; }, [activePeerId]);
  useEffect(() => { pendingConnectionsRef.current = pendingConnections; }, [pendingConnections]);
  useEffect(() => { document.title = 'Veil'; }, []);

  const showToast = (message, tone = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1500);
  };

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
        setPendingConnections(next.pendingConnections || []);
        setMessagesByPeer(next.messagesByPeer);
        setScreen(next.profile ? 'contacts' : 'onboarding');

        if (legacy) {
          await setPersistedState(next);
          clearLegacyState();
        }
      } catch (e) {
        if (mounted) {
          console.error('[hydrate] failed', e);
          showToast('저장된 데이터를 불러오지 못했어요', 'error');
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

    setPersistedState({
      profile,
      peers,
      pendingConnections,
      messagesByPeer,
    }).catch((error) => {
      console.error('[persist] failed', error);
    });
  }, [hydrated, profile, peers, pendingConnections, messagesByPeer]);

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

  useEffect(
    () => () => {
      stopQrScanner();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  const ensureManager = () => {
    if (managerRef.current) return managerRef.current;
    if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC not supported');
    managerRef.current = new WebRtcManager();
    return managerRef.current;
  };

  const upsertPendingConnection = (patch) => {
    setPendingConnections((prev) => {
      const key = patch.id || patch.remoteId || patch.nonce;
      const idx = prev.findIndex((item) =>
        key
          ? item.id === key || item.remoteId === patch.remoteId
          : false
      );
      if (idx === -1) {
        return [
          ...prev,
          {
            id: key || generateId(),
            state: 'idle',
            createdAt: now(),
            ...patch,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const clearPendingByRemoteId = (remoteId) => {
    setPendingConnections((prev) => prev.filter((item) => item.remoteId !== remoteId));
  };

  useEffect(() => {
    if (!profile) return;
    let manager;
    try {
      manager = ensureManager();
    } catch (e) {
      console.error('[webrtc:init]', e);
      showToast('현재 브라우저에서 실시간 연결을 사용할 수 없어요', 'error');
      return;
    }

    manager.setCallbacks({
      onConnectionState: (peerId, state) => {
        setConnectionStates((prev) => ({ ...prev, [peerId]: state }));

        if (state === CONNECTION_STATES.CONNECTED) {
          const pending = pendingConnectionsRef.current.find(
            (item) => item.remoteId === peerId
          );
          upsertPeer({
            id: peerId,
            name: pending?.displayName || pending?.name || `Peer ${peerId.slice(0, 6)}`,
            lifecycle: 'connected',
          });
          clearPendingByRemoteId(peerId);
          setConnectionFlow((current) => ({ ...current, state: 'connected' }));
        }

        if (state === CONNECTION_STATES.DISCONNECTED || state === CONNECTION_STATES.FAILED) {
          setPeers((prev) =>
            prev.map((peer) =>
              peer.id === peerId ? { ...peer, lifecycle: 'disconnected' } : peer
            )
          );
          setConnectionFlow((current) =>
            current.state === 'connected' ? { ...current, state: 'disconnected' } : current
          );
        }
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
      onError: (err) => {
        console.error('[webrtc:error]', err);
        showToast('연결 중 문제가 발생했어요. 다시 시도해 주세요.', 'error');
      },
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
      if (idx === -1) {
        return [
          ...prev,
          {
            id: patch.id,
            name: patch.name || `Peer ${patch.id.slice(0, 6)}`,
            lastMessagePreview: '',
            lastMessageAt: 0,
            pinned: false,
            lifecycle: patch.lifecycle || 'connected',
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  };

  const createProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('이름을 먼저 입력해 주세요', 'error');
      return;
    }
    try {
      const identity = await createIdentity();
      setProfile({ id: generateId(), name: trimmed, identityFingerprint: identity.publicFingerprint, createdAt: now() });
      setScreen('contacts');
      setActiveTab('chats');
      showToast('프로필이 준비됐어요', 'success');
    } catch (e) {
      console.error('[profile:create]', e);
      showToast('프로필 생성에 실패했어요. 다시 시도해 주세요.', 'error');
    }
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
      console.error('[message:send]', e);
      showToast('메시지를 보내지 못했어요. 다시 시도해 주세요.', 'error');
    }
  };

  const openChat = (peerId) => {
    setActivePeerId(peerId);
    setScreen('chat');
  };

  const makeEnvelope = (type, extra = {}) => ({
    v: 1,
    t: type,
    from: profile?.id || '',
    name: profile?.name || '',
    ts: Date.now(),
    nonce: extra.nonce || randomNonce(),
    ...extra,
  });

  const addPendingFromPayload = (payload) => {
    upsertPendingConnection({
      id: payload.nonce,
      nonce: payload.nonce,
      remoteId: payload.from,
      displayName: payload.name || `Peer ${payload.from.slice(0, 6)}`,
      state: payload.t === 'reconnect' ? 'reconnecting' : 'invite_scanned',
      updatedAt: now(),
    });
  };

  const handleCreateInviteQr = () => {
    if (!profile) return;

    const invite = makeEnvelope('invite');
    setGeneratedSignal(encodePayload(invite));
    setConnectionFlow({
      state: 'invite_created',
      payload: invite,
      responsePayload: null,
      sas: '',
    });
    upsertPendingConnection({
      id: invite.nonce,
      nonce: invite.nonce,
      state: 'invite_created',
      updatedAt: now(),
    });
    setAddPeerTab('invite');
    showToast('초대 QR이 준비됐어요', 'success');
  };

  const moveToInviteReview = async (payload) => {
    const sas = await computeSasCode(payload.from, profile.id);
    addPendingFromPayload(payload);
    setConnectionFlow({
      state: 'invite_scanned',
      payload,
      responsePayload: null,
      sas,
    });
    setAddPeerTab('receive');
  };

  const handleAcceptInvite = async () => {
    if (!profile || !connectionFlow.payload || actionBusy) return;
    const invite = connectionFlow.payload;

    setActionBusy(true);
    try {
      const mgr = ensureManager();
      const offer = await mgr.createOffer({
        peerId: invite.from,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint,
      });

      const acceptPayload = makeEnvelope('accept', {
        nonce: invite.nonce,
        inviteFrom: invite.from,
        signal: offer,
      });

      setGeneratedSignal(encodePayload(acceptPayload));
      setConnectionFlow((current) => ({
        ...current,
        state: 'accept_created',
        responsePayload: acceptPayload,
      }));
      upsertPendingConnection({
        id: invite.nonce,
        nonce: invite.nonce,
        remoteId: invite.from,
        displayName: invite.name || `Peer ${invite.from.slice(0, 6)}`,
        state: 'accept_created',
        updatedAt: now(),
      });
      setAddPeerTab('invite');
      showToast('수락 QR이 생성됐어요', 'success');
    } catch (error) {
      console.error('[invite:accept]', error);
      showToast('요청을 처리하지 못했어요. 다시 시도해 주세요.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const processDecodedPayload = async (payload) => {
    if (!profile) return;
    const mgr = ensureManager();

    if (payload.from === profile.id) {
      throw new Error('self_payload');
    }

    if (payload.t === 'invite') {
      await moveToInviteReview(payload);
      return;
    }

    if (payload.t === 'accept') {
      if (!payload.signal || !payload.signal.type) {
        throw new Error('missing_signal');
      }

      if (payload.signal.type === 'offer') {
        const answer = await mgr.createAnswer({
          offerSignal: payload.signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint,
        });

        const responsePayload = makeEnvelope('accept', {
          nonce: payload.nonce,
          inviteFrom: payload.from,
          signal: answer,
        });

        setGeneratedSignal(encodePayload(responsePayload));
        setConnectionFlow({
          state: 'accept_created',
          payload,
          responsePayload,
          sas: await computeSasCode(payload.from, profile.id),
        });
        upsertPendingConnection({
          id: payload.nonce,
          nonce: payload.nonce,
          remoteId: payload.from,
          displayName: payload.name || `Peer ${payload.from.slice(0, 6)}`,
          state: 'accept_created',
          updatedAt: now(),
        });
        setAddPeerTab('invite');
        showToast('완료 QR을 상대에게 보여주세요', 'info');
        return;
      }

      if (payload.signal.type === 'answer') {
        await mgr.acceptAnswer({
          peerId: payload.from,
          answerSignal: payload.signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint,
        });
        upsertPendingConnection({
          id: payload.nonce,
          nonce: payload.nonce,
          remoteId: payload.from,
          displayName: payload.name || `Peer ${payload.from.slice(0, 6)}`,
          state: 'connected',
          updatedAt: now(),
        });
        setConnectionFlow((current) => ({ ...current, state: 'connected' }));
        showToast('연결이 완료되고 있어요', 'success');
        return;
      }
    }

    if (payload.t === 'reconnect') {
      if (!payload.signal || !payload.signal.type) {
        throw new Error('missing_signal');
      }

      if (payload.signal.type === 'offer') {
        const answer = await mgr.createAnswer({
          offerSignal: payload.signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint,
        });
        const responsePayload = makeEnvelope('reconnect', {
          nonce: payload.nonce,
          signal: answer,
        });
        setGeneratedSignal(encodePayload(responsePayload));
        setConnectionFlow({
          state: 'reconnecting',
          payload,
          responsePayload,
          sas: '',
        });
        setAddPeerTab('invite');
        showToast('재연결 응답 QR을 공유해 주세요', 'info');
        return;
      }

      if (payload.signal.type === 'answer') {
        await mgr.acceptAnswer({
          peerId: payload.from,
          answerSignal: payload.signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint,
        });
        showToast('재연결을 시도하고 있어요', 'success');
        return;
      }
    }

    throw new Error('unsupported_payload');
  };

  const safeDecodeAndProcess = async (rawText) => {
    try {
      const decoded = decodePayload(rawText);
      await processDecodedPayload(decoded);
      return { ok: true, decoded };
    } catch (error) {
      logPayloadError(error, 'decode_or_process');
      return { ok: false, error };
    }
  };

  const handleProcessSignal = async () => {
    if (!manualSignal.trim()) {
      showToast('코드를 입력해 주세요', 'error');
      return;
    }

    const result = await safeDecodeAndProcess(manualSignal);
    if (!result.ok) {
      showToast('코드가 올바르지 않아요. 다시 스캔해 주세요.', 'error');
      return;
    }
    showToast('코드를 확인했어요', 'success');
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
        showToast('카메라 미리보기를 열 수 없어요', 'error');
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

              const parsed = await safeDecodeAndProcess(scannedText);
              if (parsed.ok) {
                setManualSignal(scannedText);
                setScannerError('');
                closeQrScanner();
                showToast('Code verified', 'success');
              } else {
                setScannerError('invalid_payload');
                scannerHandlingRef.current = false;
              }
              return;
            }

            if (err && err.name !== 'NotFoundException' && !scannerHandlingRef.current) {
              // Scanner keeps running; no UI error for transient frame misses.
            }
          }
        );

        if (!active) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
      } catch (cameraError) {
        console.error('[scanner:start]', cameraError);
        showToast('카메라 권한을 확인해 주세요', 'error');
        closeQrScanner();
      }
    };

    start();

    return () => {
      active = false;
      stopQrScanner();
    };
  }, [scannerOpen]);

  const handleGenerateReconnect = async () => {
    if (!profile || !activePeerId || actionBusy) return;
    setActionBusy(true);
    try {
      const mgr = ensureManager();
      const offer = await mgr.createOffer({
        peerId: activePeerId,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint,
        restartIce: true,
      });
      const reconnectPayload = makeEnvelope('reconnect', {
        signal: offer,
      });
      setGeneratedSignal(encodePayload(reconnectPayload));
      setConnectionFlow({
        state: 'reconnecting',
        payload: reconnectPayload,
        responsePayload: null,
        sas: '',
      });
      setScreen('addpeer');
      setAddPeerTab('invite');
      showToast('Reconnect QR created', 'success');
    } catch (e) {
      console.error('[reconnect:create]', e);
      showToast('Could not create reconnect code. Try again.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const getQrCanvas = () => document.getElementById('veil-qr-canvas');

  const getQrBlob = () =>
    new Promise((resolve, reject) => {
      const canvas = getQrCanvas();
      if (!canvas) {
        reject(new Error('QR canvas not ready'));
        return;
      }

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create PNG'));
            return;
          }
          resolve(blob);
        }, 'image/png');
        return;
      }

      try {
        const dataUrl = canvas.toDataURL('image/png');
        fetch(dataUrl)
          .then((res) => res.blob())
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('복사됨 ✅', 'success');
    } catch (error) {
      console.error('[clipboard]', error);
      showToast('복사 실패 - 다시 시도', 'error');
    }
  };

  const saveQrImage = async () => {
    try {
      const blob = await getQrBlob();
      const url = URL.createObjectURL(blob);
      const ua = navigator.userAgent || '';
      const isIosSafari =
        /iP(hone|ad|od)/.test(ua) &&
        /Safari/.test(ua) &&
        !/CriOS|FxiOS|EdgiOS/.test(ua);

      if (isIosSafari) {
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        showToast('이미지가 열렸어요. 길게 눌러 저장해 주세요.', 'info');
        return;
      }

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `veil-qr-${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('이미지 저장됨', 'success');
    } catch (error) {
      console.error('[qr:save]', error);
      showToast('이미지 저장에 실패했어요. 다시 시도해 주세요.', 'error');
    }
  };

  const shareQrImage = async () => {
    try {
      const blob = await getQrBlob();
      const file = new File([blob], 'veil-qr.png', { type: 'image/png' });
      if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        showToast("이 브라우저는 이미지 공유를 지원하지 않아요. '이미지로 저장'을 사용해 주세요.", 'info');
        return;
      }
      await navigator.share({
        files: [file],
        title: 'Veil QR',
      });
      showToast('공유됨', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[qr:share]', error);
      showToast('공유에 실패했어요. 이미지로 저장을 사용해 주세요.', 'error');
    }
  };

  const backupState = () => {
    try {
      const payload = makeBackupPayload({ profile, peers, pendingConnections, messagesByPeer });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `veil-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('Backup saved', 'success');
    } catch {
      showToast('Backup failed', 'error');
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
      setPendingConnections(restored.pendingConnections || []);
      setMessagesByPeer(restored.messagesByPeer);
      setScreen(restored.profile ? 'contacts' : 'onboarding');
      setActiveTab('chats');
      setActivePeerId(null);
      await setPersistedState(restored);
      showToast('Backup restored', 'success');
    } catch {
      showToast('Restore failed. Invalid backup file.', 'error');
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
            <span className="reconnect-label">연결이 끊겼어요</span>
            <button
              className="reconnect-btn"
              onClick={handleGenerateReconnect}
              disabled={actionBusy}
            >
              {actionBusy ? '...' : '재연결'}
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
  const renderAddPeer = () => {
    const shareSupported =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function';

    const resetFlow = () => {
      setConnectionFlow({
        state: 'idle',
        payload: null,
        responsePayload: null,
        sas: '',
      });
      setGeneratedSignal('');
    };

    return (
      <section className="add-peer-screen" data-testid="add-peer-screen">
        <div className="add-peer-header">
          <button className="chat-back-btn" onClick={() => setScreen('contacts')}>
            <ChevronLeft size={24} />
          </button>
          <h2 className="add-peer-title">New Connection</h2>
          <button className="onboarding-help-btn" aria-label="Help">
            ?
          </button>
        </div>

        <div className="add-peer-body">
          <div className="add-peer-tabs">
            <button
              className={`add-peer-tab ${addPeerTab === 'invite' ? 'active' : ''}`}
              onClick={() => setAddPeerTab('invite')}
            >
              초대하기
            </button>
            <button
              className={`add-peer-tab ${addPeerTab === 'receive' ? 'active' : ''}`}
              onClick={() => setAddPeerTab('receive')}
            >
              초대받기
            </button>
          </div>

          {addPeerTab === 'invite' ? (
            <div className="qr-section">
              <h2 className="qr-section-title">초대 QR 만들기</h2>
              <p className="qr-section-subtitle">
                상대가 이 QR을 스캔하면 다음 단계로 넘어가요.
              </p>

              {!generatedSignal ? (
                <button
                  className="scan-submit-btn"
                  onClick={handleCreateInviteQr}
                  disabled={actionBusy}
                >
                  {actionBusy ? '처리 중...' : '초대 QR 만들기'}
                </button>
              ) : (
                <>
                  <div className="qr-frame">
                    <div className="qr-frame-bl" />
                    <div className="qr-frame-br" />
                    <div className="qr-inner">
                      <QRCodeCanvas id="veil-qr-canvas" value={generatedSignal} size={180} />
                    </div>
                  </div>

                  <div className="qr-status">
                    <span className="qr-status-dot" />
                    <span className="qr-status-text">
                      {connectionFlow.state === 'accept_created'
                        ? '상대가 이 QR을 스캔하면 연결이 완료돼요.'
                        : '상대가 이 QR을 스캔하면 다음 단계로 이동해요.'}
                    </span>
                  </div>

                  <button
                    className="qr-share-btn"
                    onClick={() => copyToClipboard(generatedSignal)}
                    disabled={actionBusy}
                  >
                    <Copy size={18} />
                    코드 복사
                  </button>
                  <button
                    className="qr-share-btn"
                    onClick={saveQrImage}
                    disabled={actionBusy}
                  >
                    <FileText size={18} />
                    이미지로 저장
                  </button>
                  {shareSupported ? (
                    <button
                      className="qr-share-btn"
                      onClick={shareQrImage}
                      disabled={actionBusy}
                    >
                      <Share2 size={18} />
                      공유
                    </button>
                  ) : null}

                  <button className="qr-regenerate-btn" onClick={resetFlow}>
                    <RefreshCw size={16} />
                    다시 만들기
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="scan-section">
              {connectionFlow.state === 'invite_scanned' && connectionFlow.payload ? (
                <div className="onboarding-info-card">
                  <div className="onboarding-info-content">
                    <h4>친구 요청</h4>
                    <p>
                      {(connectionFlow.payload.name || '상대')}님과 연결할까요?
                    </p>
                    <p style={{ marginTop: 8 }}>
                      둘 다 같은 코드가 보이면 안전해요: {connectionFlow.sas || '------'}
                    </p>
                    <div className="settings-actions" style={{ marginTop: 12 }}>
                      <button
                        className="scan-submit-btn"
                        onClick={handleAcceptInvite}
                        disabled={actionBusy}
                      >
                        {actionBusy ? '처리 중...' : '수락'}
                      </button>
                      <button
                        className="scan-secondary-btn"
                        onClick={() => {
                          setConnectionFlow({
                            state: 'idle',
                            payload: null,
                            responsePayload: null,
                            sas: '',
                          });
                          showToast('요청을 거절했어요', 'info');
                        }}
                        disabled={actionBusy}
                      >
                        거절
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="scan-submit-btn"
                    onClick={openQrScanner}
                    disabled={actionBusy}
                  >
                    QR 스캔하기
                  </button>

                  <button
                    className="scan-secondary-btn"
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                  >
                    텍스트 코드로 연결(고급)
                  </button>

                  {advancedOpen ? (
                    <>
                      <textarea
                        className="scan-textarea"
                        value={manualSignal}
                        onChange={(e) => setManualSignal(e.target.value)}
                        placeholder="VEIL1: 코드를 붙여넣기"
                      />
                      <button className="scan-secondary-btn" onClick={handleProcessSignal}>
                        코드 확인
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

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
            {scannerError ? (
              <div className="scanner-error">
                <strong>이 QR 코드는 Veil용이 아니에요</strong>
                <p>상대가 Veil에서 만든 초대 QR인지 확인하고 다시 스캔해 주세요.</p>
                <button
                  className="scan-secondary-btn"
                  onClick={() => {
                    setScannerError('');
                    scannerHandlingRef.current = false;
                  }}
                >
                  다시 스캔
                </button>
              </div>
            ) : null}
            <button className="scan-secondary-btn" onClick={closeQrScanner}>
              Close
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`error-toast ${toast.tone === 'success' ? 'toast-success' : ''} ${toast.tone === 'info' ? 'toast-info' : ''}`}
          role="status"
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;


