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
import {AppState} from 'react-native';
import {CONNECTION_STATES, MESSAGE_STATUS, SIGNAL_TYPES} from '../utils/constants';
import {generateId, hashPin, now} from '../utils/crypto';
import WebRTCService from '../services/WebRTCService';
import StorageService from '../services/StorageService';
import SecureStorageService from '../services/SecureStorageService';
import EncryptionService from '../services/EncryptionService';
import SignalingService from '../services/SignalingService';
import ReconnectionManager from '../services/ReconnectionManager';
import VoiceMessageService from '../services/VoiceMessageService';

const AppContext = createContext(null);

const withPeerDefaults = (peer) => ({
  name: 'Unknown peer',
  identity: null,
  isSelf: false,
  isPinned: false,
  createdAt: now(),
  disappearingTimerSec: 0,
  ...peer
});

const orderMessages = (messages) =>
  [...messages].sort((a, b) => a.createdAt - b.createdAt);

const attachmentPreviewText = (attachment) => {
  if (!attachment) {
    return '[Attachment]';
  }
  if (attachment.type === 'image') {
    return '[Image]';
  }
  if (attachment.type === 'audio') {
    return '[Voice message]';
  }
  return `[File] ${attachment.name || 'Attachment file'}`;
};

const normalizeAttachmentType = (value) => {
  if (value === 'image') {
    return 'image';
  }
  if (value === 'audio') {
    return 'audio';
  }
  return 'file';
};

const defaultPrivacySettings = {
  readReceiptsEnabled: false,
  typingIndicatorsEnabled: false
};

const defaultSecuritySettings = {
  pinEnabled: false,
  pinHash: ''
};

const normalizeProfile = (value) => {
  if (!value) {
    return null;
  }
  return {
    ...value,
    privacy: {
      ...defaultPrivacySettings,
      ...(value.privacy || {})
    },
    security: {
      ...defaultSecuritySettings,
      ...(value.security || {})
    }
  };
};

const normalizeMessage = (message) => ({
  ...message,
  type: message?.type || 'text',
  attachment: message?.attachment || null,
  reactions:
    message?.reactions && typeof message.reactions === 'object'
      ? message.reactions
      : {}
});

const normalizeMessagesByPeer = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const next = {};
  Object.entries(value).forEach(([peerId, messages]) => {
    next[peerId] = Array.isArray(messages)
      ? orderMessages(messages.map((message) => normalizeMessage(message)))
      : [];
  });
  return next;
};

const withReactionState = (message, emoji, actorId, active) => {
  const reactions = {...(message.reactions || {})};
  const actors = new Set(reactions[emoji] || []);
  if (active) {
    actors.add(actorId);
  } else {
    actors.delete(actorId);
  }

  if (actors.size === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = Array.from(actors);
  }

  return {
    ...message,
    reactions
  };
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
  const [appUnlocked, setAppUnlocked] = useState(true);
  const webrtcRef = useRef(new WebRTCService());
  const profileRef = useRef(profile);
  const appStateRef = useRef(AppState.currentState);
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
        normalizedProfile = normalizeProfile(profileWithoutSeed);
        await StorageService.saveProfile(normalizedProfile);
      }

      if (!mounted) {
        return;
      }

      const normalizedProfileValue = normalizeProfile(normalizedProfile);
      setProfile(normalizedProfileValue);
      setAppUnlocked(!normalizedProfileValue?.security?.pinEnabled);
      setPeers(storedPeers.map((peer) => withPeerDefaults(peer)));
      setMessagesByPeer(normalizeMessagesByPeer(storedMessages));
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
            name: 'Note to Self',
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
    if (!profile?.security?.pinEnabled) {
      setAppUnlocked(true);
    }
  }, [profile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const movedToBackground =
        previousState === 'active' &&
        (nextState === 'inactive' || nextState === 'background');

      if (movedToBackground && profileRef.current?.security?.pinEnabled) {
        setAppUnlocked(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
            type: 'text',
            text: payload.text,
            status:
              activeChatPeerRef.current === peerId
                ? MESSAGE_STATUS.READ
                : MESSAGE_STATUS.DELIVERED,
            createdAt: payload.createdAt || now(),
            expiresAt,
            reactions: {}
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

          if (
            activeChatPeerRef.current === peerId &&
            profileRef.current &&
            profileRef.current?.privacy?.readReceiptsEnabled
          ) {
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
          (async () => {
            const expiresAt =
              Number.isFinite(payload.expiresAt) && payload.expiresAt > 0
                ? Number(payload.expiresAt)
                : null;

            let normalizedAttachment = null;
            if (payload.attachment) {
              const attachmentType = normalizeAttachmentType(payload.attachment.type);
              let attachmentUrl = payload.attachment.url || '';

              if (attachmentType === 'audio' && payload.attachment.dataB64) {
                try {
                  attachmentUrl = await VoiceMessageService.saveIncomingAudioBase64(
                    payload.attachment.dataB64,
                    payload.attachment.name
                  );
                } catch (error) {
                  attachmentUrl = payload.attachment.url || '';
                }
              }

              normalizedAttachment = {
                type: attachmentType,
                url: attachmentUrl,
                name: payload.attachment.name || '',
                size: payload.attachment.size || null,
                mimeType: payload.attachment.mimeType || '',
                durationMs: payload.attachment.durationMs || null
              };
            }

            const incomingAttachmentMessage = {
              id: payload.messageId || generateId(),
              peerId,
              senderId: peerId,
              direction: 'incoming',
              type: 'attachment',
              attachment: normalizedAttachment,
              text: payload.text || '',
              status:
                activeChatPeerRef.current === peerId
                  ? MESSAGE_STATUS.READ
                  : MESSAGE_STATUS.DELIVERED,
              createdAt: payload.createdAt || now(),
              expiresAt,
              reactions: {}
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

            if (
              activeChatPeerRef.current === peerId &&
              profileRef.current &&
              profileRef.current?.privacy?.readReceiptsEnabled
            ) {
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
          })();
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

        if (payload.kind === 'reaction') {
          const targetMessageId = String(payload.targetMessageId || '').trim();
          const emoji = String(payload.emoji || '').trim();
          if (!targetMessageId || !emoji) {
            return;
          }
          const active = payload.active !== false;

          setMessagesByPeer((previous) => {
            const list = previous[peerId] || [];
            return {
              ...previous,
              [peerId]: list.map((message) =>
                message.id === targetMessageId
                  ? withReactionState(message, emoji, peerId, active)
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
        const updated = normalizeProfile({...safeProfile, name: trimmedName});
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

      const created = normalizeProfile({
        id: generateId(),
        name: trimmedName,
        identityFingerprint: identity.publicFingerprint,
        createdAt: now()
      });
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

  const togglePeerPinned = useCallback((peerId, forcePinned) => {
    const normalizedPeerId = String(peerId || '').trim();
    if (!normalizedPeerId) {
      return;
    }

    setPeers((previous) =>
      previous.map((peer) => {
        if (peer.id !== normalizedPeerId) {
          return peer;
        }
        const nextPinned =
          typeof forcePinned === 'boolean' ? forcePinned : !Boolean(peer.isPinned);
        return {
          ...peer,
          isPinned: nextPinned
        };
      })
    );
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
        type: 'text',
        attachment: null,
        text: trimmed,
        status: isSelfChat ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.SENDING,
        createdAt: now(),
        expiresAt: null,
        reactions: {}
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
      const normalizedType = normalizeAttachmentType(attachment.type);
      const baseAttachment = {
        type: normalizedType,
        url: attachment.url,
        name: attachment.name || '',
        size: attachment.size || null,
        mimeType: attachment.mimeType || '',
        durationMs: attachment.durationMs || null
      };

      const localMessage = {
        id: messageId,
        peerId: normalizedPeerId,
        senderId: profile.id,
        direction: 'outgoing',
        type: 'attachment',
        attachment: baseAttachment,
        text: String(text || ''),
        status: isSelfChat ? MESSAGE_STATUS.SENT : MESSAGE_STATUS.SENDING,
        createdAt,
        expiresAt: null,
        reactions: {}
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
        const transportAttachment =
          normalizedType === 'audio' && attachment.dataB64
            ? {...baseAttachment, dataB64: attachment.dataB64}
            : baseAttachment;

        await webrtcRef.current.sendSecureMessage(
          normalizedPeerId,
          {
            kind: 'attachment',
            messageId,
            attachment: transportAttachment,
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

  const updatePrivacySettings = useCallback((patch) => {
    setProfile((previous) => {
      if (!previous) {
        return previous;
      }
      return normalizeProfile({
        ...previous,
        privacy: {
          ...(previous.privacy || {}),
          ...(patch || {})
        }
      });
    });
  }, []);

  const normalizePinDigits = (value) => String(value || '').replace(/\D/g, '');

  const setAppPin = useCallback(
    async (pinValue) => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }

      const normalizedPin = normalizePinDigits(pinValue);
      if (normalizedPin.length < 4 || normalizedPin.length > 8) {
        throw new Error('PIN must be 4 to 8 digits');
      }

      setProfile((previous) =>
        normalizeProfile({
          ...previous,
          security: {
            ...(previous?.security || {}),
            pinEnabled: true,
            pinHash: hashPin(normalizedPin)
          }
        })
      );
      setAppUnlocked(true);
      return true;
    },
    [profile]
  );

  const disableAppPin = useCallback(
    async (pinValue) => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }

      const currentHash = String(profile?.security?.pinHash || '');
      if (profile?.security?.pinEnabled) {
        const normalizedPin = normalizePinDigits(pinValue);
        if (!normalizedPin || hashPin(normalizedPin) !== currentHash) {
          throw new Error('Current PIN is incorrect');
        }
      }

      setProfile((previous) =>
        normalizeProfile({
          ...previous,
          security: {
            ...(previous?.security || {}),
            pinEnabled: false,
            pinHash: ''
          }
        })
      );
      setAppUnlocked(true);
      return true;
    },
    [profile]
  );

  const unlockApp = useCallback(
    (pinValue) => {
      if (!profile?.security?.pinEnabled) {
        setAppUnlocked(true);
        return true;
      }

      const normalizedPin = normalizePinDigits(pinValue);
      if (!normalizedPin) {
        return false;
      }

      const verified = hashPin(normalizedPin) === profile.security.pinHash;
      if (verified) {
        setAppUnlocked(true);
      }
      return verified;
    },
    [profile]
  );

  const lockApp = useCallback(() => {
    if (profile?.security?.pinEnabled) {
      setAppUnlocked(false);
    }
  }, [profile]);

  const sendReactionToMessage = useCallback(
    async (peerId, messageId, emoji) => {
      if (!profile) {
        throw new Error('Profile is not initialized');
      }
      const normalizedPeerId = String(peerId || '').trim();
      const normalizedMessageId = String(messageId || '').trim();
      const normalizedEmoji = String(emoji || '').trim();
      if (!normalizedPeerId || !normalizedMessageId || !normalizedEmoji) {
        throw new Error('Reaction payload is invalid');
      }

      const actorId = profile.id;
      const existingMessage = (messagesByPeer[normalizedPeerId] || []).find(
        (message) => message.id === normalizedMessageId
      );
      if (!existingMessage) {
        throw new Error('Target message not found');
      }

      const currentlyActive = Boolean(
        (existingMessage.reactions || {})[normalizedEmoji]?.includes(actorId)
      );
      const nextActive = !currentlyActive;

      setMessagesByPeer((previous) => {
        const list = previous[normalizedPeerId] || [];
        return {
          ...previous,
          [normalizedPeerId]: list.map((message) =>
            message.id === normalizedMessageId
              ? withReactionState(message, normalizedEmoji, actorId, nextActive)
              : message
          )
        };
      });

      if (normalizedPeerId === actorId) {
        return nextActive;
      }

      try {
        await webrtcRef.current.sendSecureMessage(
          normalizedPeerId,
          {
            kind: 'reaction',
            targetMessageId: normalizedMessageId,
            emoji: normalizedEmoji,
            active: nextActive,
            sentAt: now()
          },
          actorId
        );
      } catch (error) {
        setMessagesByPeer((previous) => {
          const list = previous[normalizedPeerId] || [];
          return {
            ...previous,
            [normalizedPeerId]: list.map((message) =>
              message.id === normalizedMessageId
                ? withReactionState(message, normalizedEmoji, actorId, currentlyActive)
                : message
            )
          };
        });
        throw error;
      }

      return nextActive;
    },
    [messagesByPeer, profile]
  );

  const sendTypingSignal = useCallback(
    async (peerId, typing) => {
      if (!profile || !peerId || peerId === profile.id) {
        return;
      }
      if (!profile?.privacy?.typingIndicatorsEnabled) {
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

      if (!profile?.privacy?.readReceiptsEnabled) {
        return;
      }

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
      appUnlocked,
      activeChatPeerId,
      setActiveChatPeerId,
      createOrUpdateProfile,
      addOrUpdatePeer,
      togglePeerPinned,
      sendMessageToPeer,
      sendAttachmentToPeer,
      sendReactionToMessage,
      setAppPin,
      disableAppPin,
      unlockApp,
      lockApp,
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
      updatePrivacySettings,
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
      appUnlocked,
      activeChatPeerId,
      createOrUpdateProfile,
      addOrUpdatePeer,
      togglePeerPinned,
      sendMessageToPeer,
      sendAttachmentToPeer,
      sendReactionToMessage,
      setAppPin,
      disableAppPin,
      unlockApp,
      lockApp,
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
      updatePrivacySettings,
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
