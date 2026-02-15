import React, {useMemo, useState} from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import QRScanner from '../components/QRScanner';
import {useTheme} from '../context/ThemeContext';

const AddPeerScreen = ({route, navigation}) => {
  const prefillPeerId = route.params?.prefillPeerId || '';
  const [activeTab, setActiveTab] = useState('scan');
  const [peerId, setPeerId] = useState(prefillPeerId);
  const [peerName, setPeerName] = useState('');
  const [signalText, setSignalText] = useState('');
  const [manualSignal, setManualSignal] = useState('');
  const [scanEnabled, setScanEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const {profile, addOrUpdatePeer, createOfferSignal, handleScannedSignal} = useApp();
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
        privacyBanner: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.sm,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center'
        },
        privacyText: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
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
        idPill: {
          marginTop: spacing.sm,
          borderRadius: spacing.sm,
          backgroundColor: colors.surface02,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.sm
        },
        idPillText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary,
          fontFamily: typography.fontFamily.mono
        },
        qrPanel: {
          marginTop: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          borderRadius: spacing.sm,
          backgroundColor: '#FFFFFF'
        },
        signalHelper: {
          marginTop: spacing.sm,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary
        },
        signalText: {
          marginTop: spacing.xs,
          color: colors.textMuted,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular)
        }
      }),
    [colors, spacing, typography]
  );

  const myShortId = useMemo(() => {
    const id = profile?.id || '';
    if (id.length < 14) {
      return id;
    }
    return `${id.slice(0, 10)}...${id.slice(-6)}`;
  }, [profile]);

  const onGenerateOffer = async () => {
    const normalizedPeerId = peerId.trim();
    if (!normalizedPeerId) {
      Alert.alert('친구 고유 번호를 입력해 주세요', '코드를 만들려면 상대 ID가 필요해요.');
      return;
    }

    try {
      setBusy(true);
      addOrUpdatePeer({
        id: normalizedPeerId,
        name: peerName.trim() || `친구 ${normalizedPeerId.slice(0, 6)}`
      });
      const created = await createOfferSignal(normalizedPeerId);
      setSignalText(created);
      setActiveTab('myid');
      Alert.alert('연결 코드 생성 완료', '코드를 공유하고 상대 코드도 받아 연결해 주세요.');
    } catch (error) {
      Alert.alert('코드 생성에 실패했어요. 다시 시도해 주세요', error.message);
    } finally {
      setBusy(false);
    }
  };

  const processSignal = async (rawSignal) => {
    try {
      setBusy(true);
      const result = await handleScannedSignal(rawSignal, peerName.trim());

      if (result.status === 'answer-created') {
        setSignalText(result.responseSignal);
        setPeerId(result.peerId);
        setActiveTab('myid');
        Alert.alert('연결 코드가 준비됐어요', '상대가 이 코드를 스캔하면 연결이 완료됩니다.');
      } else {
        setPeerId(result.peerId);
        Alert.alert('연결 완료', '이제 채팅을 시작할 수 있어요.');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('코드를 확인해 주세요', error.message);
    } finally {
      setBusy(false);
      setScanEnabled(false);
    }
  };

  const onShareId = async () => {
    try {
      await Share.share({
        message: `내 Session ID: ${profile?.id || ''}`
      });
    } catch (error) {
      Alert.alert('공유 실패', '공유 창을 열 수 없어요.');
    }
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
          accessibilityLabel="뒤로 가기">
          <MaterialIcons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 Session 연결</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <View style={styles.privacyBanner}>
        <MaterialIcons name="shield" size={16} color={colors.success} />
        <Text style={styles.privacyText}>초대 코드와 메시지는 E2E 암호화로 보호됩니다</Text>
      </View>

      <View style={styles.tabWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'scan' && styles.tabBtnActive]}
          onPress={() => setActiveTab('scan')}
          accessibilityRole="button"
          accessibilityLabel="QR 스캔 탭 열기">
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            QR 스캔
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'myid' && styles.tabBtnActive]}
          onPress={() => setActiveTab('myid')}
          accessibilityRole="button"
          accessibilityLabel="내 Session ID 탭 열기">
          <Text style={[styles.tabText, activeTab === 'myid' && styles.tabTextActive]}>
            내 Session ID
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'scan' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>받은 Session 코드를 스캔하거나 붙여넣기</Text>
              <Text style={styles.sectionDesc}>
                친구가 보낸 QR 또는 텍스트 코드를 입력해 안전하게 연결하세요.
              </Text>

              <TouchableOpacity
                disabled={busy}
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={() => setScanEnabled((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={scanEnabled ? '스캐너 중지' : '스캐너 시작'}>
                <MaterialIcons
                  name={scanEnabled ? 'stop-circle' : 'qr-code-scanner'}
                  size={18}
                  color={colors.onPrimary}
                />
                <Text style={styles.primaryBtnText}>
                  {scanEnabled ? '스캐너 중지' : '스캐너 시작'}
                </Text>
              </TouchableOpacity>

              {scanEnabled ? (
                <View style={styles.scannerWrap}>
                  <QRScanner onRead={processSignal} />
                </View>
              ) : null}

              <TextInput
                value={manualSignal}
                onChangeText={setManualSignal}
                placeholder="받은 코드 붙여넣기"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.input, styles.textArea]}
                accessibilityLabel="받은 코드 입력"
              />

              <TouchableOpacity
                disabled={busy || !manualSignal.trim()}
                style={[
                  styles.secondaryBtn,
                  (!manualSignal.trim() || busy) && styles.disabledBtn
                ]}
                onPress={() => processSignal(manualSignal)}
                accessibilityRole="button"
                accessibilityLabel="연결하기">
                <MaterialIcons name="link" size={18} color={colors.textPrimary} />
                <Text style={styles.secondaryBtnText}>연결하기</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>상대와 Session 연결 코드 만들기</Text>
              <TextInput
                value={peerId}
                onChangeText={setPeerId}
                placeholder="친구 고유 번호"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel="친구 고유 번호"
              />
              <TextInput
                value={peerName}
                onChangeText={setPeerName}
                placeholder="친구 이름 (선택)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                accessibilityLabel="친구 이름"
              />
              <TouchableOpacity
                disabled={busy}
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={onGenerateOffer}
                accessibilityRole="button"
                accessibilityLabel="연결 코드 생성">
                <MaterialIcons name="bolt" size={18} color={colors.onPrimary} />
                <Text style={styles.primaryBtnText}>연결 코드 생성</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>내 Session ID</Text>
            <Text style={styles.sectionDesc}>신뢰하는 친구에게만 공유해 주세요. 전화번호 공유는 필요하지 않습니다.</Text>
            <View style={styles.idPill}>
              <Text style={styles.idPillText}>{myShortId}</Text>
            </View>

            <View style={styles.qrPanel}>
              <QRCode
                size={210}
                value={signalText || profile?.id || 'session-profile-id-unavailable'}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onShareId}
              accessibilityRole="button"
              accessibilityLabel="내 Session ID 공유">
              <MaterialIcons name="share" size={18} color={colors.onPrimary} />
              <Text style={styles.primaryBtnText}>내 Session ID 공유</Text>
            </TouchableOpacity>

            {signalText ? (
              <>
                <Text style={[styles.sectionTitle, {marginTop: spacing.sm}]}>대기 중인 연결 코드</Text>
                <Text style={styles.signalHelper}>상대가 지금 이 코드를 스캔하면 연결됩니다.</Text>
                <Text selectable style={styles.signalText}>
                  {signalText}
                </Text>
              </>
            ) : (
              <Text style={styles.signalHelper}>QR 스캔 탭에서 연결 코드를 먼저 생성해 주세요.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AddPeerScreen;
