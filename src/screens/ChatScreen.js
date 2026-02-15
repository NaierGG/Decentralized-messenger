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
import {CONNECTION_STATES} from '../utils/constants';
import {toShortPeerLabel} from '../utils/crypto';
import {useTheme} from '../context/ThemeContext';

const peerInitial = (name) => (name && name.trim() ? name.trim()[0].toUpperCase() : 'P');
const timerOptions = [
  {label: '끔', seconds: 0},
  {label: '30초', seconds: 30},
  {label: '5분', seconds: 300},
  {label: '1시간', seconds: 3600},
  {label: '1일', seconds: 86400}
];

const formatTimerLabel = (seconds) => {
  if (!seconds) {
    return '사라짐 끔';
  }
  if (seconds < 60) {
    return `${seconds}초`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}분`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}시간`;
  }
  return `${Math.floor(seconds / 86400)}일`;
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
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  const typingActiveRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  const {
    getPeerById,
    getMessagesForPeer,
    getPeerConnectionState,
    getReconnectSignalForPeer,
    sendMessageToPeer,
    sendAttachmentToPeer,
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
        timerMenuBtn: {
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
        messageList: {
          paddingHorizontal: spacing.sm - 1,
          paddingTop: spacing.sm + 2,
          paddingBottom: spacing.sm
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

  useEffect(() => {
    setActiveChatPeerId(peerId);
    markPeerRead(peerId);
    return () => {
      setActiveChatPeerId(null);
    };
  }, [markPeerRead, peerId, setActiveChatPeerId]);

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
  }, [peerId]);

  useEffect(
    () => () => {
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
      Alert.alert('메시지를 보낼 수 없어요', error.message);
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
      Alert.alert('첨부 URL을 입력해 주세요');
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
      Alert.alert('첨부를 보낼 수 없어요', error.message);
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
      Alert.alert('첨부를 보낼 수 없어요', error.message);
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

  const onCreateReconnectSignal = async () => {
    try {
      await refreshReconnectSignal(peerId);
    } catch (error) {
      Alert.alert('재연결 코드 생성 실패', error.message);
    }
  };

  const onSelectDisappearingTimer = (seconds) => {
    setPeerDisappearingTimer(peerId, seconds).catch((error) => {
      Alert.alert('타이머를 설정할 수 없어요', error.message);
    });
  };

  const onOpenDisappearingMenu = () => {
    const buttons = timerOptions.map((option) => ({
      text: option.label,
      onPress: () => onSelectDisappearingTimer(option.seconds)
    }));
    buttons.push({text: '취소', style: 'cancel'});

    Alert.alert(
      '사라지는 메시지',
      '새 메시지가 자동으로 삭제될 시간을 선택하세요.',
      buttons
    );
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
        text: '이미지 선택',
        onPress: () => {
          setShowAttachComposer(false);
          onPickImageAttachment().catch((error) => {
            Alert.alert('이미지를 불러올 수 없어요', error.message);
          });
        }
      },
      {
        text: '파일 선택',
        onPress: () => {
          setShowAttachComposer(false);
          onPickFileAttachment().catch((error) => {
            Alert.alert('파일을 불러올 수 없어요', error.message);
          });
        }
      },
      {
        text: showAttachComposer ? '링크 첨부 닫기' : '링크 첨부',
        onPress: () => setShowAttachComposer((prev) => !prev)
      },
      {
        text: '취소',
        style: 'cancel'
      }
    ];

    Alert.alert('첨부 메뉴', '보낼 첨부 방식을 선택하세요.', options);
  };

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
          accessibilityLabel="뒤로 가기">
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.peerAvatar}>
          <Text style={styles.peerAvatarText}>{peerInitial(peer?.name)}</Text>
        </View>

        <View style={styles.headerMain}>
          <Text numberOfLines={1} style={styles.peerName}>
            {peer?.name || '알 수 없는 친구'}
          </Text>
          <Text style={styles.peerId}>ID {toShortPeerLabel(peerId || '')}</Text>
          <View style={styles.headerMetaRow}>
            <ConnectionStatus state={connectionState} />
            <View style={styles.timerPill}>
              <MaterialIcons name="timer" size={11} color={colors.textSecondary} />
              <Text style={styles.timerPillText}>{formatTimerLabel(disappearingTimerSec)}</Text>
            </View>
            {isPeerTyping ? <Text style={styles.typingText}>입력 중...</Text> : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.timerMenuBtn}
          onPress={onOpenDisappearingMenu}
          accessibilityRole="button"
          accessibilityLabel="사라지는 메시지 타이머 설정">
          <MaterialIcons name="timer" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {showEncryptedBanner ? (
        <Animated.View style={[styles.encryptedBanner, {opacity: bannerOpacity}]}>
          <View style={styles.encryptedRow}>
            <MaterialIcons name="shield" size={13} color={colors.success} />
            <Text style={styles.encryptedText}>이 대화는 Session 방식의 E2E 암호화로 보호됩니다</Text>
          </View>
        </Animated.View>
      ) : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageList}
        renderItem={({item}) => <MessageBubble message={item} />}
      />

      {showAttachComposer ? (
        <View style={styles.attachComposer}>
          <Text style={styles.attachTitle}>첨부 전송</Text>
          <View style={styles.attachTypeRow}>
            <TouchableOpacity
              style={[
                styles.attachTypeBtn,
                attachmentKind === 'image' && styles.attachTypeBtnActive
              ]}
              onPress={() => setAttachmentKind('image')}
              accessibilityRole="button"
              accessibilityLabel="이미지 첨부 선택">
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
                이미지 URL
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
              accessibilityLabel="파일 첨부 선택">
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
                파일 링크
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={attachmentUrl}
            onChangeText={setAttachmentUrl}
            placeholder={attachmentKind === 'image' ? 'https://... 이미지 URL' : 'https://... 파일 URL'}
            placeholderTextColor={colors.textMuted}
            style={styles.attachInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="첨부 URL 입력"
          />
          <TextInput
            value={attachmentName}
            onChangeText={setAttachmentName}
            placeholder="표시 이름 (선택)"
            placeholderTextColor={colors.textMuted}
            style={styles.attachInput}
            accessibilityLabel="첨부 이름 입력"
          />

          <View style={styles.attachActionRow}>
            <TouchableOpacity
              style={styles.attachCancelBtn}
              disabled={attachmentBusy}
              onPress={resetAttachmentComposer}
              accessibilityRole="button"
              accessibilityLabel="첨부 취소">
              <Text style={styles.attachCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachSendBtn, attachmentBusy && styles.sendBtnDisabled]}
              onPress={onSendAttachment}
              disabled={attachmentBusy}
              accessibilityRole="button"
              accessibilityLabel="첨부 전송">
              <Text style={styles.attachSendText}>
                {attachmentBusy ? '전송 중...' : '첨부 전송'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <View style={styles.reconnectCard}>
          <TouchableOpacity
            style={styles.reconnectHeader}
            onPress={() => setReconnectExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={reconnectExpanded ? '재연결 카드 접기' : '재연결 카드 펼치기'}>
            <Text style={styles.reconnectHeaderText}>연결이 끊겼습니다. 재연결 코드를 확인해 주세요.</Text>
            <MaterialIcons
              name={reconnectExpanded ? 'expand-less' : 'expand-more'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {reconnectExpanded ? (
            <View style={styles.reconnectBody}>
              <Text style={styles.reconnectText}>
                재연결 코드를 생성한 뒤 상대가 스캔하면 P2P 채널을 다시 열 수 있습니다.
              </Text>
              <TouchableOpacity
                style={styles.reconnectButton}
                onPress={onCreateReconnectSignal}
                accessibilityRole="button"
                accessibilityLabel="재연결 코드 생성">
                <Text style={styles.reconnectButtonText}>재연결 코드 생성</Text>
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
          style={[styles.attachBtn, attachmentBusy && styles.sendBtnDisabled]}
          onPress={onOpenAttachmentMenu}
          disabled={attachmentBusy}
          accessibilityRole="button"
          accessibilityLabel="추가 메뉴">
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
            placeholder="메시지를 입력하세요"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            accessibilityLabel="메시지 입력"
          />
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="메시지 전송">
          <MaterialIcons name="send" size={17} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
