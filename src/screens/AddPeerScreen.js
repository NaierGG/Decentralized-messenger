import React, {useMemo, useRef, useState} from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import QRScanner from '../components/QRScanner';
import InvitationService from '../services/InvitationService';
import {useTheme} from '../context/ThemeContext';

const FLOW_STATES = {
  IDLE: 'idle',
  INVITE_CREATED: 'invite_created',
  INVITE_RECEIVED: 'invite_received',
  WAITING_ACCEPT_SCAN: 'waiting_accept_scan',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected'
};

const INVALID_CODE_MESSAGE = 'This code isnt a valid Veil invite.';

const AddPeerScreen = ({navigation}) => {
  const [activeTab, setActiveTab] = useState('create');
  const [flowState, setFlowState] = useState(FLOW_STATES.IDLE);
  const [busy, setBusy] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [acceptCode, setAcceptCode] = useState('');
  const [pendingAcceptNonce, setPendingAcceptNonce] = useState('');
  const [connectedPeerId, setConnectedPeerId] = useState('');
  const recentScanRef = useRef({});

  const {
    createInviteCode,
    registerReceivedInvite,
    declineReceivedInvite,
    acceptInvite,
    confirmAcceptedInviteConnection,
    completeInviteWithAccept
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
          top: -130,
          right: -120,
          width: 290,
          height: 290,
          borderRadius: 145,
          backgroundColor: colors.surface03,
          opacity: 0.45
        },
        bgGlowBottom: {
          position: 'absolute',
          bottom: -100,
          left: -110,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: colors.surface02,
          opacity: 0.38
        },
        header: {
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
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
        iconPlaceholder: {
          width: spacing.component.iconButtonMin
        },
        headerTitle: {
          ...typography.textStyle(typography.size.lg, typography.weight.bold),
          color: colors.textPrimary,
          letterSpacing: -0.2
        },
        tabWrap: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.sm,
          borderRadius: 999,
          backgroundColor: colors.surface01,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          padding: spacing.xxs
        },
        tabBtn: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          height: spacing.component.buttonHeight
        },
        tabBtnActive: {
          backgroundColor: colors.primary
        },
        tabText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textSecondary
        },
        tabTextActive: {
          color: colors.onPrimary
        },
        statusPill: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.sm,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xxs + 2,
          paddingHorizontal: spacing.sm,
          alignSelf: 'flex-start'
        },
        statusText: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary,
          textTransform: 'uppercase'
        },
        scroll: {
          flex: 1
        },
        content: {
          padding: spacing.sm,
          paddingBottom: spacing.xl
        },
        card: {
          borderRadius: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.sm,
          marginBottom: spacing.sm,
          shadowColor: '#000000',
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.2,
          shadowRadius: 18,
          elevation: 4
        },
        sectionTitle: {
          ...typography.textStyle(typography.size.md, typography.weight.bold),
          color: colors.textPrimary
        },
        sectionDesc: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary,
          marginTop: spacing.xxs,
          marginBottom: spacing.sm
        },
        primaryBtn: {
          marginTop: spacing.sm,
          height: spacing.component.buttonHeight,
          borderRadius: spacing.sm,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row'
        },
        primaryBtnText: {
          marginLeft: spacing.xs - 2,
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.onPrimary
        },
        secondaryBtn: {
          marginTop: spacing.xs,
          height: spacing.component.buttonHeight,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row'
        },
        secondaryBtnText: {
          marginLeft: spacing.xs - 2,
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary
        },
        disabledBtn: {
          opacity: 0.55
        },
        scannerWrap: {
          marginTop: spacing.sm,
          borderRadius: spacing.sm,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02
        },
        input: {
          marginTop: spacing.xs,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          color: colors.textPrimary,
          minHeight: spacing.component.inputHeight,
          paddingHorizontal: spacing.sm
        },
        textArea: {
          minHeight: 94,
          paddingTop: spacing.xs,
          textAlignVertical: 'top'
        },
        qrPanel: {
          marginTop: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          borderRadius: spacing.sm,
          backgroundColor: '#FFFFFF'
        },
        codeText: {
          marginTop: spacing.xs,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: colors.textMuted
        },
        acceptTitle: {
          ...typography.textStyle(typography.size.lg, typography.weight.bold),
          color: colors.textPrimary,
          marginBottom: spacing.xs
        },
        acceptText: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary,
          marginBottom: spacing.sm
        },
        buttonRow: {
          flexDirection: 'row',
          marginTop: spacing.xs
        },
        halfBtn: {
          flex: 1,
          height: spacing.component.buttonHeight,
          borderRadius: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02
        },
        halfBtnPrimary: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          marginRight: spacing.xs
        },
        halfBtnDanger: {
          borderColor: colors.error,
          marginLeft: spacing.xs
        },
        halfBtnText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary
        },
        halfBtnTextPrimary: {
          color: colors.onPrimary
        },
        halfBtnTextDanger: {
          color: colors.error
        }
      }),
    [colors, spacing, typography]
  );

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert(message);
  };

  const onCopyCode = (code) => {
    Clipboard.setString(String(code || ''));
    showToast('Copied ');
  };

  const onShareCode = async (code) => {
    try {
      await Share.share({message: String(code || '')});
    } catch (error) {
      Alert.alert('Share failed', 'Could not open share sheet.');
    }
  };

  const markScanSeen = (rawCode) => {
    const key = String(rawCode || '').trim();
    if (!key) {
      return false;
    }
    const nowTs = Date.now();
    const previousTs = recentScanRef.current[key] || 0;
    if (nowTs - previousTs < 4000) {
      return true;
    }
    recentScanRef.current[key] = nowTs;
    return false;
  };

  const onCreateInvite = async () => {
    try {
      setBusy(true);
      const next = createInviteCode();
      setInviteCode(next.code);
      setFlowState(FLOW_STATES.INVITE_CREATED);
      setActiveTab('create');
      showToast('Invite created');
    } catch (error) {
      Alert.alert('Invite creation failed', error.message);
      setFlowState(FLOW_STATES.DISCONNECTED);
    } finally {
      setBusy(false);
    }
  };

  const onProcessCode = async (rawCodeInput) => {
    const rawCode = String(rawCodeInput || '').trim();
    if (!rawCode) {
      return;
    }
    if (markScanSeen(rawCode)) {
      return;
    }

    try {
      setBusy(true);
      const decoded = InvitationService.decodePayload(rawCode);
      if (!decoded.ok) {
        Alert.alert('Invalid code', INVALID_CODE_MESSAGE);
        setFlowState(FLOW_STATES.DISCONNECTED);
        return;
      }

      const payload = decoded.payload;

      if (InvitationService.isInvitePayload(payload)) {
        registerReceivedInvite(payload);
        setIncomingInvite(payload);
        setAcceptCode('');
        setPendingAcceptNonce('');
        setConnectedPeerId('');
        setFlowState(FLOW_STATES.INVITE_RECEIVED);
        setScanEnabled(false);
        setManualCode('');
        return;
      }

      if (InvitationService.isAcceptPayload(payload)) {
        const completed = completeInviteWithAccept(payload);
        setIncomingInvite(null);
        setAcceptCode('');
        setPendingAcceptNonce('');
        setConnectedPeerId(completed.peerId);
        setFlowState(FLOW_STATES.CONNECTED);
        setScanEnabled(false);
        setManualCode('');
        showToast('Connection completed');
        return;
      }

      Alert.alert('Invalid code', INVALID_CODE_MESSAGE);
      setFlowState(FLOW_STATES.DISCONNECTED);
    } catch (error) {
      Alert.alert('Invalid code', INVALID_CODE_MESSAGE);
      setFlowState(FLOW_STATES.DISCONNECTED);
    } finally {
      setBusy(false);
    }
  };

  const onAcceptInvite = async () => {
    try {
      setBusy(true);
      const accepted = acceptInvite(incomingInvite);
      setAcceptCode(accepted.code);
      setPendingAcceptNonce(accepted.nonce);
      setConnectedPeerId('');
      setFlowState(FLOW_STATES.WAITING_ACCEPT_SCAN);
    } catch (error) {
      Alert.alert('Accept failed', error.message);
      setFlowState(FLOW_STATES.DISCONNECTED);
    } finally {
      setBusy(false);
    }
  };

  const onDeclineInvite = () => {
    declineReceivedInvite();
    setIncomingInvite(null);
    setAcceptCode('');
    setPendingAcceptNonce('');
    setConnectedPeerId('');
    setFlowState(FLOW_STATES.IDLE);
  };

  const onCompleteAcceptedInvite = () => {
    if (!pendingAcceptNonce) {
      return;
    }

    try {
      setBusy(true);
      const completed = confirmAcceptedInviteConnection(pendingAcceptNonce);
      setConnectedPeerId(completed.peerId);
      setPendingAcceptNonce('');
      setFlowState(FLOW_STATES.CONNECTED);
      showToast('Connection completed');
    } catch (error) {
      Alert.alert('Connection failed', error.message);
      setFlowState(FLOW_STATES.DISCONNECTED);
    } finally {
      setBusy(false);
    }
  };

  const onOpenConnectedChat = () => {
    if (!connectedPeerId || flowState !== FLOW_STATES.CONNECTED) {
      return;
    }
    showToast('Connection completed');
    navigation.navigate('Chat', {peerId: connectedPeerId});
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialIcons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Veil Connection</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <View style={styles.tabWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
          onPress={() => setActiveTab('create')}
          accessibilityRole="button"
          accessibilityLabel="Create invite tab">
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
            Create Invite
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'scan' && styles.tabBtnActive]}
          onPress={() => setActiveTab('scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan invite tab">
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            Scan Invite
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{flowState}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'create' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create a Veil Invite</Text>
            <Text style={styles.sectionDesc}>
              Create a one-time invitation code. Peer is not created until accept handshake completes.
            </Text>

            <TouchableOpacity
              disabled={busy}
              style={[styles.primaryBtn, busy && styles.disabledBtn]}
              onPress={onCreateInvite}
              accessibilityRole="button"
              accessibilityLabel="Create invite">
              <MaterialIcons name="bolt" size={18} color={colors.onPrimary} />
              <Text style={styles.primaryBtnText}>Create Invite</Text>
            </TouchableOpacity>

            {inviteCode ? (
              <>
                <View style={styles.qrPanel}>
                  <QRCode value={inviteCode} size={210} />
                </View>
                <Text selectable style={styles.codeText}>
                  {inviteCode}
                </Text>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => onCopyCode(inviteCode)}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite code">
                  <MaterialIcons name="content-copy" size={18} color={colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => onShareCode(inviteCode)}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite code">
                  <MaterialIcons name="share" size={18} color={colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setActiveTab('scan');
                    setFlowState(FLOW_STATES.WAITING_ACCEPT_SCAN);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Scan accept code">
                  <MaterialIcons name="qr-code-scanner" size={18} color={colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Scan Accept</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Scan Invite</Text>
              <Text style={styles.sectionDesc}>
                Scan a VEIL1 code or paste manually.
              </Text>

              <TouchableOpacity
                disabled={busy}
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={() => setScanEnabled((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={scanEnabled ? 'Stop scanner' : 'Scan invite'}>
                <MaterialIcons
                  name={scanEnabled ? 'stop-circle' : 'qr-code-scanner'}
                  size={18}
                  color={colors.onPrimary}
                />
                <Text style={styles.primaryBtnText}>
                  {scanEnabled ? 'Stop Scanner' : 'Scan Invite'}
                </Text>
              </TouchableOpacity>

              {scanEnabled ? (
                <View style={styles.scannerWrap}>
                  <QRScanner onRead={onProcessCode} />
                </View>
              ) : null}

              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Paste VEIL1 code"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.input, styles.textArea]}
                accessibilityLabel="Manual invite code"
              />

              <TouchableOpacity
                disabled={busy || !manualCode.trim()}
                style={[styles.secondaryBtn, (busy || !manualCode.trim()) && styles.disabledBtn]}
                onPress={() => onProcessCode(manualCode)}
                accessibilityRole="button"
                accessibilityLabel="Process code">
                <MaterialIcons name="link" size={18} color={colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>Process Code</Text>
              </TouchableOpacity>
            </View>

            {flowState === FLOW_STATES.INVITE_RECEIVED && incomingInvite ? (
              <View style={styles.card}>
                <Text style={styles.acceptTitle}>Friend Request</Text>
                <Text style={styles.acceptText}>{incomingInvite.name} wants to connect</Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.halfBtn, styles.halfBtnPrimary]}
                    onPress={onAcceptInvite}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Accept invite">
                    <Text style={[styles.halfBtnText, styles.halfBtnTextPrimary]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.halfBtn, styles.halfBtnDanger]}
                    onPress={onDeclineInvite}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Decline invite">
                    <Text style={[styles.halfBtnText, styles.halfBtnTextDanger]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {acceptCode ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Accept QR</Text>
                <Text style={styles.sectionDesc}>Let the sender scan this code to complete handshake.</Text>

                <View style={styles.qrPanel}>
                  <QRCode value={acceptCode} size={210} />
                </View>

                <Text selectable style={styles.codeText}>
                  {acceptCode}
                </Text>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => onCopyCode(acceptCode)}
                  accessibilityRole="button"
                  accessibilityLabel="Copy accept code">
                  <MaterialIcons name="content-copy" size={18} color={colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => onShareCode(acceptCode)}
                  accessibilityRole="button"
                  accessibilityLabel="Share accept code">
                  <MaterialIcons name="share" size={18} color={colors.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Share</Text>
                </TouchableOpacity>

                {flowState === FLOW_STATES.WAITING_ACCEPT_SCAN ? (
                  <TouchableOpacity
                    disabled={busy || !pendingAcceptNonce}
                    style={[
                      styles.primaryBtn,
                      (busy || !pendingAcceptNonce) && styles.disabledBtn
                    ]}
                    onPress={onCompleteAcceptedInvite}
                    accessibilityRole="button"
                    accessibilityLabel="Complete connection">
                    <MaterialIcons name="verified" size={18} color={colors.onPrimary} />
                    <Text style={styles.primaryBtnText}>Complete Connection</Text>
                  </TouchableOpacity>
                ) : null}

              </View>
            ) : null}
          </>
        )}

        {flowState === FLOW_STATES.CONNECTED && connectedPeerId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Connection ready</Text>
            <Text style={styles.sectionDesc}>
              Handshake completed. You can open the conversation now.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onOpenConnectedChat}
              accessibilityRole="button"
              accessibilityLabel="Open chat">
              <MaterialIcons name="chat" size={18} color={colors.onPrimary} />
              <Text style={styles.primaryBtnText}>Open Chat</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AddPeerScreen;
