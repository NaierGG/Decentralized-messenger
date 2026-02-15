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
import {CONNECTION_STATES} from '../utils/constants';
import {useTheme} from '../context/ThemeContext';

const ChatScreen = ({route, navigation}) => {
  const peerId = route.params?.peerId;
  const [text, setText] = useState('');
  const [showEncryptedBanner, setShowEncryptedBanner] = useState(true);
  const [reconnectExpanded, setReconnectExpanded] = useState(false);
  const bannerOpacity = useRef(new Animated.Value(1)).current;

  const {
    getPeerById,
    getMessagesForPeer,
    getPeerConnectionState,
    getReconnectSignalForPeer,
    sendMessageToPeer,
    markPeerRead,
    setActiveChatPeerId,
    refreshReconnectSignal
  } = useApp();

  const {colors, spacing, typography} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: spacing.component.screenTop - 12
        },
        header: {
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.xs,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center'
        },
        iconBtn: {
          width: spacing.component.iconButtonMin,
          height: spacing.component.iconButtonMin,
          borderRadius: spacing.component.iconButtonMin / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface01,
          borderWidth: 1,
          borderColor: colors.border
        },
        headerMain: {
          flex: 1,
          marginLeft: spacing.xs + 2
        },
        peerName: {
          ...typography.textStyle(typography.size.md, typography.weight.bold),
          color: colors.textPrimary,
          marginBottom: spacing.xxs
        },
        encryptedBanner: {
          marginTop: spacing.xs,
          marginHorizontal: spacing.lg,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingVertical: spacing.xs - 2,
          alignItems: 'center'
        },
        encryptedRow: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        encryptedText: {
          marginLeft: spacing.xxs,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
          color: colors.textSecondary
        },
        messageList: {
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.md,
          paddingBottom: spacing.xs
        },
        reconnectCard: {
          marginHorizontal: spacing.sm,
          marginBottom: spacing.xs,
          borderRadius: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          overflow: 'hidden'
        },
        reconnectHeader: {
          minHeight: 60,
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
          alignItems: 'flex-end',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border
        },
        inputWrap: {
          flex: 1,
          marginRight: spacing.xs,
          minHeight: spacing.component.inputHeight,
          maxHeight: 120,
          borderRadius: 22,
          backgroundColor: colors.surface01,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs - 2,
          justifyContent: 'center'
        },
        input: {
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          paddingVertical: spacing.xxs,
          maxHeight: 108
        },
        sendBtn: {
          width: spacing.component.buttonHeight,
          height: spacing.component.buttonHeight,
          borderRadius: spacing.component.buttonHeight / 2,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center'
        }
      }),
    [colors, spacing, typography]
  );

  const peer = getPeerById(peerId);
  const connectionState = getPeerConnectionState(peerId);
  const reconnectSignal = getReconnectSignalForPeer(peerId);
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
        duration: 300,
        useNativeDriver: true
      }).start(() => setShowEncryptedBanner(false));
    }, 3000);

    return () => clearTimeout(timer);
  }, [bannerOpacity, peerId]);

  useEffect(() => {
    if (connectionState === CONNECTION_STATES.CONNECTED) {
      setReconnectExpanded(false);
    }
  }, [connectionState]);

  const onSend = async () => {
    if (!text.trim()) {
      return;
    }
    const message = text;
    setText('');

    try {
      await sendMessageToPeer(peerId, message);
    } catch (error) {
      Alert.alert('메시지를 보낼 수 없어요', error.message);
    }
  };

  const onCreateReconnectSignal = async () => {
    try {
      await refreshReconnectSignal(peerId);
    } catch (error) {
      Alert.alert('재연결 코드 생성 실패', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기">
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerMain}>
          <Text numberOfLines={1} style={styles.peerName}>
            {peer?.name || '알 수 없는 친구'}
          </Text>
          <ConnectionStatus state={connectionState} />
        </View>
      </View>

      {showEncryptedBanner ? (
        <Animated.View style={[styles.encryptedBanner, {opacity: bannerOpacity}]}>
          <View style={styles.encryptedRow}>
            <MaterialIcons name="lock" size={12} color={colors.textSecondary} />
            <Text style={styles.encryptedText}>대화는 종단간 암호화로 보호돼요</Text>
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

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <View style={styles.reconnectCard}>
          <TouchableOpacity
            style={styles.reconnectHeader}
            onPress={() => setReconnectExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={reconnectExpanded ? '재연결 카드 접기' : '재연결 카드 펼치기'}>
            <Text style={styles.reconnectHeaderText}>연결이 끊겼어요. 재연결 코드를 확인해 주세요.</Text>
            <MaterialIcons
              name={reconnectExpanded ? 'expand-less' : 'expand-more'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {reconnectExpanded ? (
            <View style={styles.reconnectBody}>
              <Text style={styles.reconnectText}>
                재연결 코드를 생성한 뒤 상대가 스캔하면 P2P 채널을 다시 열 수 있어요.
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
        <View style={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="메시지를 입력하세요"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={2000}
            accessibilityLabel="메시지 입력"
          />
        </View>
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={onSend}
          accessibilityRole="button"
          accessibilityLabel="메시지 전송">
          <MaterialIcons name="send" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
