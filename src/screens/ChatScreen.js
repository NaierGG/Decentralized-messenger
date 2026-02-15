import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
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

const COLORS = {
  bg: '#111022',
  surface: '#1C1B2E',
  text: '#F8FAFC',
  muted: '#9CA3AF',
  primary: '#6764F2',
  border: 'rgba(255,255,255,0.08)'
};

const ChatScreen = ({route, navigation}) => {
  const peerId = route.params?.peerId;
  const [text, setText] = useState('');
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

  const onSend = async () => {
    if (!text.trim()) {
      return;
    }
    const message = text;
    setText('');

    try {
      await sendMessageToPeer(peerId, message);
    } catch (error) {
      Alert.alert('Send failed', error.message);
    }
  };

  const onCreateReconnectSignal = async () => {
    try {
      await refreshReconnectSignal(peerId);
    } catch (error) {
      Alert.alert('Reconnect failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerMain}>
          <Text numberOfLines={1} style={styles.peerName}>
            {peer?.name || 'Unknown peer'}
          </Text>
          <ConnectionStatus state={connectionState} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtnSmall}>
            <MaterialIcons name="call" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnSmall}>
            <MaterialIcons name="videocam" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.encryptedBanner}>
        <View style={styles.encryptedRow}>
          <MaterialIcons name="lock" size={12} color="#C9CCFF" />
          <Text style={styles.encryptedText}>Messages secured by end-to-end encryption</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messageList}
        renderItem={({item}) => <MessageBubble message={item} />}
      />

      {connectionState !== CONNECTION_STATES.CONNECTED ? (
        <View style={styles.reconnectCard}>
          <Text style={styles.reconnectTitle}>Connection dropped</Text>
          <Text style={styles.reconnectText}>
            Generate and share reconnect QR to restore direct P2P channel.
          </Text>
          <TouchableOpacity style={styles.reconnectButton} onPress={onCreateReconnectSignal}>
            <Text style={styles.reconnectButtonText}>Generate Reconnect QR</Text>
          </TouchableOpacity>
          {reconnectSignal ? (
            <View style={styles.reconnectQrBox}>
              <QRCode value={reconnectSignal} size={136} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn}>
          <MaterialIcons name="add" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity>
            <MaterialIcons name="sentiment-satisfied-alt" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.sendBtn} onPress={onSend}>
          <MaterialIcons name="send" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 52
  },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface
  },
  headerMain: {
    flex: 1,
    marginLeft: 10
  },
  peerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2
  },
  headerActions: {
    flexDirection: 'row'
  },
  iconBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: COLORS.surface
  },
  encryptedBanner: {
    marginTop: 10,
    marginHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(103,100,242,0.25)',
    backgroundColor: 'rgba(103,100,242,0.12)',
    paddingVertical: 6,
    alignItems: 'center'
  },
  encryptedRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  encryptedText: {
    marginLeft: 4,
    color: '#C9CCFF',
    fontSize: 11,
    fontWeight: '600'
  },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10
  },
  reconnectCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface
  },
  reconnectTitle: {
    color: '#FCD34D',
    fontWeight: '700',
    marginBottom: 4
  },
  reconnectText: {
    color: COLORS.muted,
    marginBottom: 10,
    lineHeight: 18
  },
  reconnectButton: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary
  },
  reconnectButtonText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  reconnectQrBox: {
    marginTop: 12,
    alignItems: 'center'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputWrap: {
    flex: 1,
    marginHorizontal: 8,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 4
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
});

export default ChatScreen;
