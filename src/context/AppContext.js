import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {CONNECTION_STATES, MESSAGE_STATUS, SIGNAL_TYPES} from '../utils/constants';
import {generateId, now} from '../utils/crypto';
import WebRTCService from '../services/WebRTCService';
import StorageService from '../services/StorageService';
import SecureStorageService from '../services/SecureStorageService';
import EncryptionService from '../services/EncryptionService';
import SignalingService from '../services/SignalingService';
import ReconnectionManager from '../services/ReconnectionManager';

const AppContext = createContext(null);

const withPeerDefaults = (peer) => ({
  name: 'Unknown peer',
  identity: null,
  isSelf: false,
  createdAt: now(),
  disappearingTimerSec: 0,
  ...peer
});

const orderMessages = (messages) =>
  [...messages].sort((a, b) => a.createdAt - b.createdAt);

const attachmentPreviewText = (attachment) => {
  if (!attachment) {
    return '[첨부]';
  }
  if (attachment.type === 'image') {
    return '[이미지]';
  }
  return `[파일] ${attachment.name || '첨부 파일'}`;
};

export const AppProvider = ({children}) => {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messagesByPeer, setMessagesByPeer] = useState({});
  const [connectionStates, setConnectionStates] = useState({});
  const [typingStates, setTypingStates] = useState({});
  const [reconnectSignals, setReconnectSignals] = useState({});
  const [networkOnline, setNetworkOnline] = useState(true);
  const [activeChatPeerId, setActiveChatPeerId] = useState(null);
  const webrtcRef = useRef(new WebRTCService());
  const profileRef = useRef(profile);
  const activeChatPeerRef = useRef(activeChatPeerId);
  const reconnectSignalsRef = useRef(reconnectSignals);
  const reconnectGeneratingRef = useRef({});
  const reconnectionManagerRef = useRef(new ReconnectionManager());

  const normalizeDisappearingTimer = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Math.floor(value);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [storedProfile, storedPeers, storedMessages] = await Promise.all([
        StorageService.getProfile(),
        StorageService.getPeers(),
        StorageService.getMessagesByPeer()
      ]);

      if (!mounted) {
        return;
      }

      let normalizedProfile = storedProfile;
      if (storedProfile?.identitySeed) {
        await SecureStorageService.setIdentitySeed(storedProfile.identitySeed);
        const {identitySeed: _identitySeed, ...profileWithoutSeed} = storedProfile;
        normalizedProfile = profileWithoutSeed;
        await StorageService.saveProfile(profileWithoutSeed);
      }

      if (!mounted) {
        return;
      }

      setProfile(normalizedProfile);
      setPeers(storedPeers.map((peer) => withPeerDefaults(peer)));
      setMessagesByPeer(storedMessages);
      setReady(true);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline =
        Boolean(state.isConnected) && state.isInternetReachable !== false;
      setNetworkOnline(isOnline);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setPeers((previous) => {
      const existingIndex = previous.findIndex((peer) => peer.id === profile.id);
      if (existingIndex === -1) {
        return [
          withPeerDefaults({
            id: profile.id,
            name: '나에게 보내기',
            identity: profile.identityFingerprint || null,
            isSelf: true,
            lastMessagePreview: '',
            lastMessageAt: 0
          }),
          ...previous
        ];
      }

      const cloned = [...previous];
      cloned[existingIndex] = withPeerDefaults({
        ...cloned[existingIndex],
        isSelf: true
      });
      return cloned;
    });
  }, [profile]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    activeChatPeerRef.current = activeChatPeerId;
  }, [activeChatPeerId]);

  useEffect(() => {
    reconnectSignalsRef.current = reconnectSignals;
  }, [reconnectSignals]);

  useEffect(() => {
    const webrtc = webrtcRef.current;

    webrtc.setCallbacks({
      onSecureMessage: (peerId, payload) => {
        if (payload.kind === 'chat') {
          const expiresAt =
            Number.isFinite(payload.expiresAt) && payload.expiresAt > 0
              ? Number(payload.expiresAt)
              : null;
          const incomingMessage = {
            id: payload.messageId || generateId(),
            peerId,
            senderId: peerId,
            direction: 'incoming',
            text: payload.text,
            status:
              activeChatPeerRef.current === peerId
                ? MESSAGE_STATUS.READ
                : MESSAGE_STATUS.DELIVERED,
            createdAt: payload.createdAt || now(),
            expiresAt
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

          if (activeChatPeerRef.current === peerId && profileRef.current) {
            webrtc
              .sendSecureMessage(
                peerId,
                {
                  kind: 'read',
                  messageIds: [incomingMessage.id],
                  readAt: now()
                },
                profileRef.current.id
              )
              .catch(() => null);
          }
        }

        if (payload.kind === 'attachment') {
          const expiresAt =
            Number.isFinite(payload.expiresAt) && payload.expiresAt > 0
              ? Number(payload.expiresAt)
              : null;
          const incomingAttachmentMessage = {
            id: payload.messageId || generateId(),
            peerId,
            senderId: peerId,
            direction: 'incoming',
            type: 'attachment',
            attachment: payload.attachment
              ? {
                  type: payload.attachment.type === 'image' ? 'image' : 'file',
                  url: payload.attachment.url || '',
                  name: payload.attachment.name || '',
                  size: payload.attachment.size || null,
                  mimeType: payload.attachment.mimeType || ''
                }
              : null,
            text: payload.text || '',
            status:
              activeChatPeerRef.current === peerId
                ? MESSAGE_STATUS.READ
                : MESSAGE_STATUS.DELIVERED,
            createdAt: payload.createdAt || now(),
            expiresAt
          };

          setMessagesByPeer((previous) => {
            const list = previous[peerId] || [];
            return {
              ...previous,
              [peerId]: orderMessages([...list, incomingAttachmentMessage])
            };
          });

          setPeers((previous) =>
            previous.map((peer) =>
              peer.id === peerId
                ? {
                    ...peer,
                    lastMessagePreview: attachmentPreviewText(
                      incomingAttachmentMessage.attachment
                    ),
                    lastMessageAt: incomingAttachmentMessage.createdAt
                  }
                : peer
            )
          );

          if (activeChatPeerRef.current === peerId && profileRef.current) {
            webrtc
              .sendSecureMessage(
                peerId,
                {
                  kind: 'read',
                  messageIds: [incomingAttachmentMessage.id],
                  readAt: now()
                },
                profileRef.current.id
              )
              .catch(() => null);
          }
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

        if (payload.kind === 'disappearing_timer') {
          const nextTimer = normalizeDisappearingTimer(payload.seconds);
          setPeers((previous) =>
            previous.map((peer) =>
              peer.id === peerId
                ? {
                    ...peer,
                    disappearingTimerSec: nextTimer
                  }
                : peer
            )
          );
        }

        if (payload.kind === 'typing') {
          setTypingStates((previous) => ({
            ...previous,
            [peerId]: {
              typing: Boolean(payload.typing),
              updatedAt: now()
            }
          }));
        }
      },
      onConnectionState: (peerId, state) => {
        setConnectionStates((previous) => ({...previous, [peerId]: state}));

        if (state === CONNECTION_STATES.CONNECTED) {
          reconnectGeneratingRef.current[peerId] = false;
          reconnectionManagerRef.current.reset(peerId);
          setReconnectSignals((previous) => {
            if (!previous[peerId]) {
              return previous;
            }
            const next = {...previous};
            delete next[peerId];
            return next;
          });
          return;
        }

        if (
          state !== CONNECTION_STATES.DISCONNECTED &&
          state !== CONNECTION_STATES.FAILED
        ) {
          return;
        }

        if (!profileRef.current) {
          return;
        }

        if (
          reconnectSignalsRef.current[peerId] ||
          reconnectGeneratingRef.current[peerId]
        ) {
          return;
        }

        reconnectionManagerRef.current.schedule(peerId, async () => {
          if (!profileRef.current || reconnectSignalsRef.current[peerId]) {
            return false;
          }

          if (reconnectGeneratingRef.current[peerId]) {
            return true;
          }

          reconnectGeneratingRef.current[peerId] = true;

          try {
            const offerSignal = await webrtc.createOffer({
              peerId,
              localPeerId: profileRef.current.id,
              localIdentity: profileRef.current.identityFingerprint,
              restartIce: true
            });
            const encoded = SignalingService.toQrString(offerSignal);

            setReconnectSignals((previous) => {
              if (previous[peerId]) {
                return previous;
              }
              return {...previous, [peerId]: encoded};
            });
            return false;
          } catch (error) {
            return true;
          } finally {
            reconnectGeneratingRef.current[peerId] = false;
          }
        });
      },
      onError: () => {
        // Keep app resilient during signaling and WebRTC edge failures.
      }
    });

    return () => {
      reconnectionManagerRef.current.clearAll();
      webrtc.closeAll();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    StorageService.saveProfile(profile);
  }, [profile, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    StorageService.savePeers(peers);
  }, [peers, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    StorageService.saveMessagesByPeer(messagesByPeer);
  }, [messagesByPeer, ready]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nowTs = now();
      setTypingStates((previous) => {
        let changed = false;
        const next = {};

        Object.entries(previous).forEach(([peerId, state]) => {
          if (!state?.typing) {
            next[peerId] = state;
            return;
          }
          if (nowTs - (state.updatedAt || 0) > 9000) {
            changed = true;
            next[peerId] = {typing: false, updatedAt: nowTs};
            return;
          }
          next[peerId] = state;
        });

        return changed ? next : previous;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const interval = setInterval(() => {
      const nowTs = now();
      setMessagesByPeer((previous) => {
        let changed = false;
        const next = {};

        Object.entries(previous).forEach(([peerId, messages]) => {
          const filtered = (messages || []).filter((message) => {
            if (!message.expiresAt) {
              return true;
            }
            return message.expiresAt > nowTs;
          });

          if (filtered.length !== (messages || []).length) {
            changed = true;
          }
          next[peerId] = filtered;
        });

        return changed ? next : previous;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [ready]);

  const createOrUpdateProfile = useCallback(
    async (name) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error('Name is required');
      }

      if (profile) {
        const {identitySeed: _identitySeed, ...safeProfile} = profile;
        const updated = {...safeProfile, name: trimmedName};
        setProfile(updated);
        return updated;
      }

      const identity = EncryptionService.createIdentity();
      const stored = await SecureStorageService.setIdentitySeed(
        identity.privateSeed
      );
      if (!stored) {
        throw new Error('Failed to store identity seed securely');
      }

      const created = {
        id: generateId(),
        name: trimmedName,
        identityFingerprint: identity.publicFingerprint,
        createdAt: now()
      };
      setProfile(created);
      return created;
    },
    [profile]
  );

  const addOrUpdatePeer = useCallback((peerPatch) => {
    setPeers((previous) => {
      const existingIndex = previous.findIndex((peer) => peer.id === peerPatch.id);
      if (existingIndex === -1) {
        return [...previous, withPeerDefaults(peerPatch)];
      }
      const cloned = [...previous];
      cloned[existingIndex] = {
        ...withPeerDefaults(cloned[existingIndex]),
        ...peerPatch,
        disappearingTimerSec: normalizeDisappearingTimer(
          peerPatch.disappearingTimerSec ?? cloned[existingIndex].disappearingTimerSec
        )
      };
      return cloned;
    });
  }, []);

  const updateOutgoingMessageStatus = useCallback((peerId, messageId, status) => {
    setMessagesByPeer((previous) => {
      const list = previous[peerId] || [];
      return {
        ...previous,
        [peerId]: list.map((message) =>
          message.id === messageId ? {...message, status} : message
        )
      };
    });
  }, []);

  const sendMessageToPeer = useCallback(
    async (peerId, text) => {
      const trimmed = text.trim();
      if (!trimmed || !profile) {
        return null;
      }

      const messageId = generateId();
      const isSelfChat = peerId === profile.id;
      const localMessage = {
        id: messageId,
        peerId,
        senderId: profile.id,
        direction: 'outgoing',
        text: trimmed,
        status: isSelfChat ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.SENDING,
        createdAt: now(),
        expiresAt: null
      };

      const peerTimerSec = normalizeDisappearingTimer(
        peers.find((peer) => peer.id === peerId)?.disappearingTimerSec || 0
      );
      if (peerTimerSec > 0) {
        localMessage.expiresAt = localMessage.createdAt + peerTimerSec * 1000;
      }

      setMessagesByPeer((previous) => {
        const list = previous[peerId] || [];
        return {
          ...previous,
          [peerId]: orderMessages([...list, localMessage])
        };
      });

      setPeers((previous) =>
        previous.map((peer) =>
          peer.id === peerId
            ? {
                ...peer,
                lastMessagePreview: trimmed,
                lastMessageAt: localMessage.createdAt
              }
            : peer
        )
      );

      if (isSelfChat) {
        return messageId;
      }

      try {
        await webrtcRef.current.sendSecureMessage(
          peerId,
          {
            kind: 'chat',
            messageId,
            text: trimmed,
            createdAt: localMessage.createdAt,
            expiresAt: localMessage.expiresAt
          },
          profile.id
        );
        updateOutgoingMessageStatus(peerId, messageId, MESSAGE_STATUS.SENT);
      } catch (error) {
        updateOutgoingMessageStatus(peerId, messageId, MESSAGE_STATUS.FAILED);
        throw error;
      }

      return messageId;
    },
    [peers, profile, updateOutgoingMessageStatus]
  );

  const sendAttachmentToPeer = useCallback(
    async (peerId, attachment, text = '') => {
      const normalizedPeerId = String(peerId || '').trim();
      if (!normalizedPeerId || !profile) {
        return null;
      }
      if (!attachment?.url) {
        throw new Error('Attachment URL is required');
      }

      const messageId = generateId();
      const isSelfChat = normalizedPeerId === profile.id;
      const createdAt = now();
      const localMessage = {
        id: messageId,
        peerId: normalizedPeerId,
        senderId: profile.id,
        direction: 'outgoing',
        type: 'attachment',
        attachment: {
          type: attachment.type === 'image' ? 'image' : 'file',
          url: attachment.url,
          name: attachment.name || '',
          size: attachment.size || null,
          mimeType: attachment.mimeType || ''
        },
        text: String(text || ''),
        status: isSelfChat ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.SENDING,
        createdAt,
        expiresAt: null
      };

      const peerTimerSec = normalizeDisappearingTimer(
        peers.find((peer) => peer.id === normalizedPeerId)?.disappearingTimerSec || 0
      );
      if (peerTimerSec > 0) {
        localMessage.expiresAt = localMessage.createdAt + peerTimerSec * 1000;
      }

      setMessagesByPeer((previous) => {
        const list = previous[normalizedPeerId] || [];
        return {
          ...previous,
          [normalizedPeerId]: orderMessages([...list, localMessage])
        };
      });

      setPeers((previous) =>
        previous.map((peer) =>
          peer.id === normalizedPeerId
            ? {
                ...peer,
                lastMessagePreview: attachmentPreviewText(localMessage.attachment),
                lastMessageAt: localMessage.createdAt
              }
            : peer
        )
      );

      if (isSelfChat) {
        return messageId;
      }

      try {
        await webrtcRef.current.sendSecureMessage(
          normalizedPeerId,
          {
            kind: 'attachment',
            messageId,
            attachment: localMessage.attachment,
            text: localMessage.text,
            createdAt: localMessage.createdAt,
            expiresAt: localMessage.expiresAt
          },
          profile.id
        );
        updateOutgoingMessageStatus(normalizedPeerId, messageId, MESSAGE_STATUS.SENT);
      } catch (error) {
        updateOutgoingMessageStatus(normalizedPeerId, messageId, MESSAGE_STATUS.FAILED);
        throw error;
      }

      return messageId;
    },
    [peers, profile, updateOutgoingMessageStatus]
  );

  const getDisappearingTimerForPeer = useCallback(
    (peerId) =>
      normalizeDisappearingTimer(
        peers.find((peer) => peer.id === peerId)?.disappearingTimerSec || 0
      ),
    [peers]
  );

  const setPeerDisappearingTimer = useCallback(
    async (peerId, seconds, options = {}) => {
      const normalizedPeerId = String(peerId || '').trim();
      if (!normalizedPeerId) {
        throw new Error('Peer ID is required');
      }
      const nextTimer = normalizeDisappearingTimer(seconds);

      setPeers((previous) =>
        previous.map((peer) =>
          peer.id === normalizedPeerId
            ? {
                ...peer,
                disappearingTimerSec: nextTimer
              }
            : peer
        )
      );

      if (options.sync === false || !profile) {
        return nextTimer;
      }

      try {
        await webrtcRef.current.sendSecureMessage(
          normalizedPeerId,
          {
            kind: 'disappearing_timer',
            seconds: nextTimer,
            updatedAt: now()
          },
          profile.id
        );
      } catch (error) {
        // Best-effort sync. Local timer still applies.
      }

      return nextTimer;
    },
    [profile]
  );

  const sendTypingSignal = useCallback(
    async (peerId, typing) => {
      if (!profile || !peerId || peerId === profile.id) {
        return;
      }
      try {
        await webrtcRef.current.sendSecureMessage(
          peerId,
          {
            kind: 'typing',
            typing: Boolean(typing),
            sentAt: now()
          },
          profile.id
        );
      } catch (error) {
        // Typing indicator is best-effort only.
      }
    },
    [profile]
  );

  const getPeerTypingState = useCallback(
    (peerId) => Boolean(typingStates[peerId]?.typing),
    [typingStates]
  );

  const markPeerRead = useCallback(
    async (peerId) => {
      if (!profile) {
        return;
      }

      const unreadIds = (messagesByPeer[peerId] || [])
        .filter(
          (message) =>
            message.direction === 'incoming' && message.status !== MESSAGE_STATUS.READ
        )
        .map((message) => message.id);

      if (!unreadIds.length) {
        return;
      }

      setMessagesByPeer((previous) => {
        const list = previous[peerId] || [];
        return {
          ...previous,
          [peerId]: list.map((message) =>
            unreadIds.includes(message.id)
              ? {...message, status: MESSAGE_STATUS.READ}
              : message
          )
        };
      });

      try {
        await webrtcRef.current.sendSecureMessage(
          peerId,
          {
            kind: 'read',
            messageIds: unreadIds,
            readAt: now()
          },
          profile.id
        );
      } catch (error) {
        // Read receipts are best-effort in P2P mode.
      }
    },
    [messagesByPeer, profile]
  );

  const createOfferSignal = useCallback(
    async (peerId, options = {}) => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }
      const normalizedPeerId = String(peerId || '').trim();
      if (!normalizedPeerId) {
        throw new Error('Peer ID is required');
      }

      reconnectionManagerRef.current.reset(normalizedPeerId);

      const offerSignal = await webrtcRef.current.createOffer({
        peerId: normalizedPeerId,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint,
        restartIce: Boolean(options.restartIce)
      });

      return SignalingService.toQrString(offerSignal);
    },
    [profile]
  );

  const handleScannedSignal = useCallback(
    async (rawSignal, peerNameFallback = '') => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }

      const signal = SignalingService.fromQrString(rawSignal);

      if (signal.targetPeerId && signal.targetPeerId !== profile.id) {
        throw new Error('Signal target does not match this user');
      }

      if (signal.type === SIGNAL_TYPES.OFFER) {
        const remotePeerId = signal.peerId;
        addOrUpdatePeer({
          id: remotePeerId,
          name: peerNameFallback || `Peer ${remotePeerId.slice(0, 6)}`,
          identity: signal.identity || null
        });

        const answerSignal = await webrtcRef.current.createAnswer({
          offerSignal: signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint
        });

        return {
          status: 'answer-created',
          peerId: remotePeerId,
          responseSignal: SignalingService.toQrString(answerSignal)
        };
      }

      if (signal.type === SIGNAL_TYPES.ANSWER) {
        const remotePeerId = signal.peerId;
        addOrUpdatePeer({
          id: remotePeerId,
          name: peerNameFallback || `Peer ${remotePeerId.slice(0, 6)}`,
          identity: signal.identity || null
        });

        await webrtcRef.current.acceptAnswer({
          peerId: remotePeerId,
          answerSignal: signal,
          localPeerId: profile.id,
          localIdentity: profile.identityFingerprint
        });

        return {
          status: 'connected',
          peerId: remotePeerId
        };
      }

      throw new Error('Unsupported signal type');
    },
    [addOrUpdatePeer, profile]
  );

  const getMessagesForPeer = useCallback(
    (peerId) => messagesByPeer[peerId] || [],
    [messagesByPeer]
  );

  const getPeerById = useCallback(
    (peerId) => peers.find((peer) => peer.id === peerId) || null,
    [peers]
  );

  const getPeerConnectionState = useCallback(
    (peerId) => {
      if (profile && peerId === profile.id) {
        return CONNECTION_STATES.CONNECTED;
      }
      return connectionStates[peerId] || CONNECTION_STATES.DISCONNECTED;
    },
    [connectionStates, profile]
  );

  const getReconnectSignalForPeer = useCallback(
    (peerId) => reconnectSignals[peerId] || '',
    [reconnectSignals]
  );

  const refreshReconnectSignal = useCallback(
    async (peerId) => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }

      const normalizedPeerId = String(peerId || '').trim();
      if (!normalizedPeerId) {
        throw new Error('Peer ID is required');
      }

      const offerSignal = await webrtcRef.current.createOffer({
        peerId: normalizedPeerId,
        localPeerId: profile.id,
        localIdentity: profile.identityFingerprint,
        restartIce: true
      });
      const encoded = SignalingService.toQrString(offerSignal);
      setReconnectSignals((previous) => ({...previous, [normalizedPeerId]: encoded}));
      return encoded;
    },
    [profile]
  );

  const getUnreadCountForPeer = useCallback(
    (peerId) => {
      if (profile && peerId === profile.id) {
        return 0;
      }
      return (messagesByPeer[peerId] || []).filter(
        (message) =>
          message.direction === 'incoming' && message.status !== MESSAGE_STATUS.READ
      ).length;
    },
    [messagesByPeer, profile]
  );

  const value = useMemo(
    () => ({
      ready,
      profile,
      peers,
      messagesByPeer,
      reconnectSignals,
      networkOnline,
      activeChatPeerId,
      setActiveChatPeerId,
      createOrUpdateProfile,
      addOrUpdatePeer,
      sendMessageToPeer,
      sendAttachmentToPeer,
      markPeerRead,
      createOfferSignal,
      handleScannedSignal,
      getMessagesForPeer,
      getPeerById,
      getPeerConnectionState,
      getReconnectSignalForPeer,
      refreshReconnectSignal,
      getUnreadCountForPeer,
      getDisappearingTimerForPeer,
      setPeerDisappearingTimer,
      sendTypingSignal,
      getPeerTypingState
    }),
    [
      ready,
      profile,
      peers,
      messagesByPeer,
      reconnectSignals,
      networkOnline,
      activeChatPeerId,
      createOrUpdateProfile,
      addOrUpdatePeer,
      sendMessageToPeer,
      sendAttachmentToPeer,
      markPeerRead,
      createOfferSignal,
      handleScannedSignal,
      getMessagesForPeer,
      getPeerById,
      getPeerConnectionState,
      getReconnectSignalForPeer,
      refreshReconnectSignal,
      getUnreadCountForPeer,
      getDisappearingTimerForPeer,
      setPeerDisappearingTimer,
      sendTypingSignal,
      getPeerTypingState
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
};
