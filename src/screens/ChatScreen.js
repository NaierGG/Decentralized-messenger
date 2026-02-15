import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import ConnectionStatus from '../components/ConnectionStatus';
import MessageBubble from '../components/MessageBubble';
import AttachmentService from '../services/AttachmentService';
import VoiceMessageService from '../services/VoiceMessageService';
import {CONNECTION_STATES} from '../utils/constants';
import {toShortPeerLabel} from '../utils/crypto';
import {useTheme} from '../context/ThemeContext';

const peerInitial = (name) => (name && name.trim() ? name.trim()[0].toUpperCase() : 'P');

const timerOptions = [
  {label: 'Off', seconds: 0},
  {label: '30 sec', seconds: 30},
  {label: '5 min', seconds: 300},
  {label: '1 hour', seconds: 3600},
  {label: '1 day', seconds: 86400}
];

const reactionOptions = [
  '\u2764\uFE0F',
  '\uD83D\uDC4D',
  '\uD83D\uDE02',
  '\uD83D\uDE2E',
  '\uD83D\uDD25',
  '\uD83D\uDC4E'
];

const formatTimerLabel = (seconds) => {
  if (!seconds) {
    return 'Off';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
};

const getSearchText = (message) => {
  const parts = [message?.text, message?.attachment?.name, message?.attachment?.url];
  return parts
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const formatVoiceDuration = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const ChatScreen = ({route, navigation}) => {
  const peerId = route.params?.peerId;
  const [text, setText] = useState('');
  const [showAttachComposer, setShowAttachComposer] = useState(false);
  const [attachmentKind, setAttachmentKind] = useState('image');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [showEncryptedBanner, setShowEncryptedBanner] = useState(true);
  const [reconnectExpanded, setReconnectExpanded] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceStartedAt, setVoiceStartedAt] = useState(0);
  const [voiceElapsedSec, setVoiceElapsedSec] = useState(0);
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  const typingActiveRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const {
    profile,
    getPeerById,
    getMessagesForPeer,
    getPeerConnectionState,
    getReconnectSignalForPeer,
    sendMessageToPeer,
    sendAttachmentToPeer,
    sendReactionToMessage,
    togglePeerPinned,
    markPeerRead,
    setActiveChatPeerId,
    refreshReconnectSignal,
    getDisappearingTimerForPeer,
    setPeerDisappearingTimer,
    sendTypingSignal,
    getPeerTypingState
  } = useApp();

  const {colors, spacing, typography} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: spacing.component.screenTop - 12,
          overflow: 'hidden'
        },
        bgGlowTop: {
          position: 'absolute',
          top: -120,
          left: -100,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: colors.surface03,
          opacity: 0.33
        },
        bgGlowBottom: {
          position: 'absolute',
          bottom: -120,
          right: -100,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: colors.surface02,
          opacity: 0.3
        },
        header: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          minHeight: 62,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface01
        },
        iconBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface02,
          borderWidth: 1,
          borderColor: colors.border
        },
        peerAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          marginLeft: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface03
        },
        peerAvatarText: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.textPrimary
        },
        headerMain: {
          flex: 1,
          marginLeft: spacing.xs + 2
        },
        headerMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 1
        },
        timerPill: {
          marginLeft: spacing.xs,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingVertical: 2,
          paddingHorizontal: spacing.xs - 1,
          flexDirection: 'row',
          alignItems: 'center'
        },
        timerPillText: {
          marginLeft: 3,
          ...typography.textStyle(typography.size.xs - 3, typography.weight.semibold),
          color: colors.textSecondary
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: spacing.xs
        },
        headerActionBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.xs
        },
        typingText: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs - 2, typography.weight.semibold),
          color: colors.online
        },
        peerName: {
          ...typography.textStyle(typography.size.md, typography.weight.bold),
          color: colors.textPrimary,
          marginBottom: 1
        },
        peerId: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: colors.textMuted,
          fontFamily: typography.fontFamily.mono,
          marginBottom: 1
        },
        encryptedBanner: {
          marginTop: spacing.xs,
          marginHorizontal: spacing.md,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xxs + 1,
          paddingHorizontal: spacing.sm,
          alignItems: 'center'
        },
        encryptedRow: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        encryptedText: {
          marginLeft: spacing.xxs,
          ...typography.textStyle(typography.size.xs - 2, typography.weight.semibold),
          color: colors.textSecondary
        },
        searchBar: {
          marginTop: spacing.xs,
          marginHorizontal: spacing.sm,
          minHeight: 40,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm
        },
        searchInput: {
          flex: 1,
          marginLeft: spacing.xxs,
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          paddingVertical: 0
        },
        searchMeta: {
          marginTop: spacing.xxs,
          marginHorizontal: spacing.sm,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
          color: colors.textSecondary
        },
        messageList: {
          paddingHorizontal: spacing.sm - 1,
          paddingTop: spacing.sm + 2,
          paddingBottom: spacing.sm
        },
        emptySearchState: {
          marginTop: spacing.lg,
          alignItems: 'center'
        },
        emptySearchText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textMuted
        },
        voiceBanner: {
          marginHorizontal: spacing.sm,
          marginBottom: spacing.xs,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.warning,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xs - 1,
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center'
        },
        voiceDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.error,
          marginRight: spacing.xs
        },
        voiceBannerText: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textPrimary
        },
        voiceBannerHint: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: colors.textSecondary
        },
        reconnectCard: {
          marginHorizontal: spacing.sm,
          marginBottom: spacing.xs + 1,
          borderRadius: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          overflow: 'hidden'
        },
        reconnectHeader: {
          minHeight: 58,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        },
        reconnectHeaderText: {
          flex: 1,
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.warning
        },
        reconnectBody: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          padding: spacing.md
        },
        reconnectText: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary,
          marginBottom: spacing.sm
        },
        reconnectButton: {
          borderRadius: spacing.sm,
          height: spacing.component.buttonHeight,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary
        },
        reconnectButtonText: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.onPrimary
        },
        reconnectQrBox: {
          marginTop: spacing.sm,
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: spacing.sm,
          paddingVertical: spacing.sm
        },
        inputBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface01
        },
        attachBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.xs
        },
        inputWrap: {
          flex: 1,
          marginRight: spacing.xs,
          minHeight: 40,
          maxHeight: 110,
          borderRadius: 20,
          backgroundColor: colors.surface02,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm - 1,
          paddingVertical: spacing.xxs + 1,
          justifyContent: 'center'
        },
        input: {
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          paddingVertical: 0,
          maxHeight: 100
        },
        sendBtn: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center'
        },
        sendBtnDisabled: {
          opacity: 0.55
        },
        attachComposer: {
          marginHorizontal: spacing.sm,
          marginBottom: spacing.xs,
          borderRadius: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.sm
        },
        attachTitle: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.textPrimary
        },
        attachTypeRow: {
          marginTop: spacing.xs,
          flexDirection: 'row'
        },
        attachTypeBtn: {
          flex: 1,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row'
        },
        attachTypeBtnActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary
        },
        attachTypeText: {
          marginLeft: 4,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
        },
        attachTypeTextActive: {
          color: colors.onPrimary
        },
        attachInput: {
          marginTop: spacing.xs,
          minHeight: 38,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingHorizontal: spacing.sm,
          color: colors.textPrimary
        },
        attachActionRow: {
          marginTop: spacing.xs,
          flexDirection: 'row'
        },
        attachCancelBtn: {
          flex: 1,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center'
        },
        attachCancelText: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
        },
        attachSendBtn: {
          flex: 1,
          height: 36,
          borderRadius: 18,
          marginLeft: spacing.xs,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center'
        },
        attachSendText: {
          ...typography.textStyle(typography.size.xs, typography.weight.bold),
          color: colors.onPrimary
        }
      }),
    [colors, spacing, typography]
  );

  const peer = getPeerById(peerId);
  const connectionState = getPeerConnectionState(peerId);
  const reconnectSignal = getReconnectSignalForPeer(peerId);
  const disappearingTimerSec = getDisappearingTimerForPeer(peerId);
  const isPeerTyping = getPeerTypingState(peerId);
  const messages = useMemo(() => getMessagesForPeer(peerId), [getMessagesForPeer, peerId]);

  const visibleMessages = useMemo(() => {
    const query = messageSearchQuery.trim().toLowerCase();
    if (!query) {
      return messages;
    }
    return messages.filter((message) => getSearchText(message).includes(query));
  }, [messages, messageSearchQuery]);

  useEffect(() => {
    setActiveChatPeerId(peerId);
    markPeerRead(peerId);
    return () => {
      setActiveChatPeerId(null);
    };
  }, [markPeerRead, peerId, setActiveChatPeerId]);

  useEffect(() => {
    markPeerRead(peerId);
  }, [markPeerRead, messages, peerId]);

  useEffect(() => {
    setShowEncryptedBanner(true);
    bannerOpacity.setValue(1);

    const timer = setTimeout(() => {
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true
      }).start(() => setShowEncryptedBanner(false));
    }, 2800);

    return () => clearTimeout(timer);
  }, [bannerOpacity, peerId]);

  useEffect(() => {
    if (connectionState === CONNECTION_STATES.CONNECTED) {
      setReconnectExpanded(false);
    }
  }, [connectionState]);

  useEffect(() => {
    setShowAttachComposer(false);
    setAttachmentKind('image');
    setAttachmentUrl('');
    setAttachmentName('');
    setShowSearchBar(false);
    setMessageSearchQuery('');
    setVoiceRecording(false);
    setVoiceStartedAt(0);
    setVoiceElapsedSec(0);
    VoiceMessageService.cancelRecording().catch(() => null);
  }, [peerId]);

  useEffect(() => {
    if (!voiceRecording) {
      return undefined;
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - voiceStartedAt) / 1000);
      setVoiceElapsedSec(elapsed);
    }, 400);

    return () => clearInterval(timer);
  }, [voiceRecording, voiceStartedAt]);

  useEffect(
    () => () => {
      VoiceMessageService.cancelRecording().catch(() => null);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingActiveRef.current) {
        sendTypingSignal(peerId, false);
      }
    },
    [peerId, sendTypingSignal]
  );

  const onSend = async () => {
    if (!text.trim()) {
      return;
    }
    if (voiceRecording) {
      await VoiceMessageService.cancelRecording().catch(() => null);
      setVoiceRecording(false);
      setVoiceStartedAt(0);
      setVoiceElapsedSec(0);
    }

    const message = text;
    setText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      sendTypingSignal(peerId, false);
    }

    try {
      await sendMessageToPeer(peerId, message);
    } catch (error) {
      Alert.alert('Failed to send message', error.message);
    }
  };

  const resetAttachmentComposer = () => {
    setAttachmentUrl('');
    setAttachmentName('');
    setAttachmentKind('image');
    setShowAttachComposer(false);
  };

  const onSendAttachment = async () => {
    if (!attachmentUrl.trim()) {
      Alert.alert('Attachment URL required', 'Enter a valid URL.');
      return;
    }

    try {
      setAttachmentBusy(true);
      await sendAttachmentToPeer(
        peerId,
        {
          type: attachmentKind,
          url: attachmentUrl.trim(),
          name: attachmentName.trim()
        },
        ''
      );
      resetAttachmentComposer();
    } catch (error) {
      Alert.alert('Failed to send attachment', error.message);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const sendPreparedAttachment = async (attachment) => {
    if (!attachment?.url) {
      return;
    }

    try {
      setAttachmentBusy(true);
      await sendAttachmentToPeer(peerId, attachment, '');
    } catch (error) {
      Alert.alert('Failed to send attachment', error.message);
    } finally {
      setAttachmentBusy(false);
    }
  };

  const onPickImageAttachment = async () => {
    const picked = await AttachmentService.pickImage();
    if (!picked) {
      return;
    }
    await sendPreparedAttachment(picked);
  };

  const onPickFileAttachment = async () => {
    const picked = await AttachmentService.pickFile();
    if (!picked) {
      return;
    }
    await sendPreparedAttachment(picked);
  };

  const onPickAudioAttachment = async () => {
    const picked = await AttachmentService.pickAudioFile();
    if (!picked) {
      return;
    }
    await sendPreparedAttachment(picked);
  };

  const onToggleVoiceRecording = async () => {
    if (voiceBusy) {
      return;
    }

    try {
      setVoiceBusy(true);
      if (!voiceRecording) {
        await VoiceMessageService.startRecording();
        setVoiceRecording(true);
        setVoiceStartedAt(Date.now());
        setVoiceElapsedSec(0);
        return;
      }

      const recordedAttachment = await VoiceMessageService.stopRecording();
      setVoiceRecording(false);
      setVoiceStartedAt(0);
      setVoiceElapsedSec(0);

      if (!recordedAttachment) {
        return;
      }

      await sendPreparedAttachment(recordedAttachment);
    } catch (error) {
      setVoiceRecording(false);
      setVoiceStartedAt(0);
      setVoiceElapsedSec(0);
      Alert.alert('Voice message failed', error.message);
    } finally {
      setVoiceBusy(false);
    }
  };

  const onCreateReconnectSignal = async () => {
    try {
      await refreshReconnectSignal(peerId);
    } catch (error) {
      Alert.alert('Reconnect code generation failed', error.message);
    }
  };

  const onSelectDisappearingTimer = (seconds) => {
    setPeerDisappearingTimer(peerId, seconds).catch((error) => {
      Alert.alert('Failed to update timer', error.message);
    });
  };

  const onOpenDisappearingMenu = () => {
    const buttons = timerOptions.map((option) => ({
      text: option.label,
      onPress: () => onSelectDisappearingTimer(option.seconds)
    }));
    buttons.push({text: 'Cancel', style: 'cancel'});

    Alert.alert(
      'Disappearing Messages',
      'Choose when sent messages are auto-deleted.',
      buttons
    );
  };

  const onReactMessage = async (messageId, emoji) => {
    try {
      await sendReactionToMessage(peerId, messageId, emoji);
    } catch (error) {
      Alert.alert('Reaction failed', error.message);
    }
  };

  const onOpenReactionPicker = (message) => {
    const actions = reactionOptions.map((emoji) => ({
      text: emoji,
      onPress: () => onReactMessage(message.id, emoji)
    }));

    actions.push({text: 'Cancel', style: 'cancel'});
    Alert.alert('Reaction', 'Choose an emoji reaction.', actions);
  };

  const onChangeInput = (value) => {
    setText(value);

    if (!peerId || !value.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        sendTypingSignal(peerId, false);
      }
      return;
    }

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      sendTypingSignal(peerId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        sendTypingSignal(peerId, false);
      }
      typingTimeoutRef.current = null;
    }, 1400);
  };

  const onOpenAttachmentMenu = () => {
    const options = [
      {
        text: 'Choose image',
        onPress: () => {
          setShowAttachComposer(false);
          onPickImageAttachment().catch((error) => {
            Alert.alert('Failed to load image', error.message);
          });
        }
      },
      {
        text: 'Choose file',
        onPress: () => {
          setShowAttachComposer(false);
          onPickFileAttachment().catch((error) => {
            Alert.alert('Failed to load file', error.message);
          });
        }
      },
      {
        text: 'Choose audio file',
        onPress: () => {
          setShowAttachComposer(false);
          onPickAudioAttachment().catch((error) => {
            Alert.alert('Failed to load audio', error.message);
          });
        }
      },
      {
        text: showAttachComposer ? 'Close link compose' : 'Link compose',
        onPress: () => setShowAttachComposer((prev) => !prev)
      },
      {
        text: 'Cancel',
        style: 'cancel'
      }
    ];

    Alert.alert('Attachment Menu', 'Choose how to attach a file.', options);
  };

  const onToggleSearchBar = () => {
    setShowSearchBar((prev) => {
      const next = !prev;
      if (!next) {
        setMessageSearchQuery('');
      }
      return next;
    });
  };

  const onTogglePinPeer = () => {
    if (!peerId) {
      return;
    }
    togglePeerPinned(peerId, !Boolean(peer?.isPinned));
  };

  const hasInputText = Boolean(text.trim());
  const primaryActionIcon = hasInputText
    ? 'send'
    : voiceRecording
      ? 'stop'
      : 'mic';
  const primaryActionLabel = hasInputText
    ? 'Send message'
    : voiceRecording
      ? 'Stop recording'
      : 'Start voice recording';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.peerAvatar}>
          <Text style={styles.peerAvatarText}>{peerInitial(peer?.name)}</Text>
        </View>

        <View style={styles.headerMain}>
          <Text numberOfLines={1} style={styles.peerName}>
            {peer?.name || 'Unknown peer'}
          </Text>
          <Text style={styles.peerId}>ID {toShortPeerLabel(peerId || '')}</Text>
          <View style={styles.headerMetaRow}>
            <ConnectionStatus state={connectionState} />
            <View style={styles.timerPill}>
              <MaterialIcons name="timer" size={11} color={colors.textSecondary} />
              <Text style={styles.timerPillText}>{formatTimerLabel(disappearingTimerSec)}</Text>
            </View>
            {isPeerTyping ? <Text style={styles.typingText}>Typing...</Text> : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={onTogglePinPeer}
            accessibilityRole="button"
            accessibilityLabel={peer?.isPinned ? 'Unpin conversation' : 'Pin conversation'}>
            <MaterialIcons
              name={peer?.isPinned ? 'push-pin' : 'push-pin'}
              size={17}
              color={peer?.isPinned ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={onToggleSearchBar}
            accessibilityRole="button"
            accessibilityLabel="Search messages">
            <MaterialIcons
              name={showSearchBar ? 'close' : 'search'}
              size={17}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={onOpenDisappearingMenu}
            accessibilityRole="button"
            accessibilityLabel="Disappearing timer settings">
            <MaterialIcons name="timer" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearchBar ? (
        <>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              value={messageSearchQuery}
              onChangeText={setMessageSearchQuery}
              placeholder="Search in this conversation"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search messages"
            />
          </View>
          {messageSearchQuery.trim() ? (
            <Text style={styles.searchMeta}>
              {visibleMessages.length} / {messages.length} matches
            </Text>
          ) : null}
        </>
      ) : null}

      {showEncryptedBanner ? (
        <Animated.View style={[styles.encryptedBanner, {opacity: bannerOpacity}]}>
          <View style={styles.encryptedRow}>
            <MaterialIcons name="shield" size={13} color={colors.success} />
            <Text style={styles.encryptedText}>
              Messages are protected with end-to-end encryption.
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <FlatList
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          messageSearchQuery.trim() ? (
            <View style={styles.emptySearchState}>
              <Text style={styles.emptySearchText}>No messages match your search.</Text>
            </View>
          ) : null
        }
        renderItem={({item}) => (
          <MessageBubble
            message={item}
            currentUserId={profile?.id}
            onReact={onReactMessage}
            onOpenReactionPicker={onOpenReactionPicker}
          />
        )}
      />

      {showAttachComposer ? (
        <View style={styles.attachComposer}>
          <Text style={styles.attachTitle}>Send attachment</Text>
          <View style={styles.attachTypeRow}>
            <TouchableOpacity
              style={[
                styles.attachTypeBtn,
                attachmentKind === 'image' && styles.attachTypeBtnActive
              ]}
              onPress={() => setAttachmentKind('image')}
              accessibilityRole="button"
              accessibilityLabel="Select image type">
              <MaterialIcons
                name="image"
                size={14}
                color={attachmentKind === 'image' ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.attachTypeText,
                  attachmentKind === 'image' && styles.attachTypeTextActive
                ]}>
                Image URL
              </Text>
            </TouchableOpacity>
            <View style={{width: spacing.xs}} />
            <TouchableOpacity
              style={[
                styles.attachTypeBtn,
                attachmentKind === 'file' && styles.attachTypeBtnActive
              ]}
              onPress={() => setAttachmentKind('file')}
              accessibilityRole="button"
              accessibilityLabel="Select file type">
              <MaterialIcons
                name="attach-file"
                size={14}
                color={attachmentKind === 'file' ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.attachTypeText,
                  attachmentKind === 'file' && styles.attachTypeTextActive
                ]}>
                File URL
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={attachmentUrl}
            onChangeText={setAttachmentUrl}
            placeholder={attachmentKind === 'image' ? 'https://... image URL' : 'https://... file URL'}
            placeholderTextColor={colors.textMuted}
            style={styles.attachInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Attachment URL"
          />
          <TextInput
            value={attachmentName}
            onChangeText={setAttachmentName}
            placeholder="Display name (optional)"
            placeholderTextColor={colors.textMuted}
            style={styles.attachInput}
            accessibilityLabel="Attachment name"
          />

          <View style={styles.attachActionRow}>
            <TouchableOpacity
              style={styles.attachCancelBtn}
              disabled={attachmentBusy}
              onPress={resetAttachmentComposer}
              accessibilityRole="button"
              accessibilityLabel="Cancel attachment">
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachSendBtn, attachmentBusy && styles.sendBtnDisabled]}
              onPress={onSendAttachment}
              disabled={attachmentBusy}
              accessibilityRole="button"
              accessibilityLabel="Send attachment">
              <Text style={styles.attachSendText}>
                {attachmentBusy ? 'Sending...' : 'Send attachment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {voiceRecording ? (
        <View style={styles.voiceBanner}>
          <View style={styles.voiceDot} />
          <Text style={styles.voiceBannerText}>
            Recording voice message {formatVoiceDuration(voiceElapsedSec)}
          </Text>
          <Text style={styles.voiceBannerHint}>Tap mic button again to send</Text>
        </View>
      ) : null}

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <View style={styles.reconnectCard}>
          <TouchableOpacity
            style={styles.reconnectHeader}
            onPress={() => setReconnectExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={reconnectExpanded ? 'Hide reconnect card' : 'Show reconnect card'}>
            <Text style={styles.reconnectHeaderText}>
              Connection was lost. Open a new reconnect QR code.
            </Text>
            <MaterialIcons
              name={reconnectExpanded ? 'expand-less' : 'expand-more'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {reconnectExpanded ? (
            <View style={styles.reconnectBody}>
              <Text style={styles.reconnectText}>
                Generate and scan this code from the other device to restore the P2P session.
              </Text>
              <TouchableOpacity
                style={styles.reconnectButton}
                onPress={onCreateReconnectSignal}
                accessibilityRole="button"
                accessibilityLabel="Generate reconnect code">
                <Text style={styles.reconnectButtonText}>Generate reconnect code</Text>
              </TouchableOpacity>
              {reconnectSignal ? (
                <View style={styles.reconnectQrBox}>
                  <QRCode value={reconnectSignal} size={136} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <TouchableOpacity
          style={[
            styles.attachBtn,
            (attachmentBusy || voiceBusy || voiceRecording) && styles.sendBtnDisabled
          ]}
          onPress={onOpenAttachmentMenu}
          disabled={attachmentBusy || voiceBusy || voiceRecording}
          accessibilityRole="button"
          accessibilityLabel="Open attachment menu">
          <MaterialIcons
            name={showAttachComposer ? 'close' : 'add'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={onChangeInput}
            placeholder="Type a message"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            accessibilityLabel="Message input"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!hasInputText && !voiceRecording && voiceBusy) && styles.sendBtnDisabled
          ]}
          onPress={hasInputText ? onSend : onToggleVoiceRecording}
          disabled={!hasInputText && !voiceRecording && voiceBusy}
          accessibilityRole="button"
          accessibilityLabel={primaryActionLabel}>
          <MaterialIcons name={primaryActionIcon} size={17} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
