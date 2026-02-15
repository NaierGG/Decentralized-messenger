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
  createdAt: now(),
  ...peer
});

const orderMessages = (messages) =>
  [...messages].sort((a, b) => a.createdAt - b.createdAt);

export const AppProvider = ({children}) => {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messagesByPeer, setMessagesByPeer] = useState({});
  const [connectionStates, setConnectionStates] = useState({});
  const [reconnectSignals, setReconnectSignals] = useState({});
  const [networkOnline, setNetworkOnline] = useState(true);
  const [activeChatPeerId, setActiveChatPeerId] = useState(null);
  const webrtcRef = useRef(new WebRTCService());
  const profileRef = useRef(profile);
  const activeChatPeerRef = useRef(activeChatPeerId);
  const reconnectSignalsRef = useRef(reconnectSignals);
  const reconnectGeneratingRef = useRef({});
  const reconnectionManagerRef = useRef(new ReconnectionManager());

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
      setPeers(storedPeers);
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
        ...cloned[existingIndex],
        ...peerPatch
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
      const localMessage = {
        id: messageId,
        peerId,
        senderId: profile.id,
        direction: 'outgoing',
        text: trimmed,
        status: MESSAGE_STATUS.SENDING,
        createdAt: now()
      };

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

      try {
        await webrtcRef.current.sendSecureMessage(
          peerId,
          {
            kind: 'chat',
            messageId,
            text: trimmed,
            createdAt: localMessage.createdAt
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
    [profile, updateOutgoingMessageStatus]
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
    (peerId) => connectionStates[peerId] || CONNECTION_STATES.DISCONNECTED,
    [connectionStates]
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
    (peerId) =>
      (messagesByPeer[peerId] || []).filter(
        (message) =>
          message.direction === 'incoming' && message.status !== MESSAGE_STATUS.READ
      ).length,
    [messagesByPeer]
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
      markPeerRead,
      createOfferSignal,
      handleScannedSignal,
      getMessagesForPeer,
      getPeerById,
      getPeerConnectionState,
      getReconnectSignalForPeer,
      refreshReconnectSignal,
      getUnreadCountForPeer
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
      markPeerRead,
      createOfferSignal,
      handleScannedSignal,
      getMessagesForPeer,
      getPeerById,
      getPeerConnectionState,
      getReconnectSignalForPeer,
      refreshReconnectSignal,
      getUnreadCountForPeer
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
