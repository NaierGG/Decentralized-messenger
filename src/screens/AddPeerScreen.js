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

const COLORS = {
  bg: '#111022',
  surface: '#1C1B2E',
  text: '#F8FAFC',
  muted: '#A4ADC0',
  primary: '#6764F2',
  border: 'rgba(255,255,255,0.1)'
};

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
      Alert.alert('Peer ID required', 'Enter peer ID before creating offer QR.');
      return;
    }

    try {
      setBusy(true);
      addOrUpdatePeer({
        id: normalizedPeerId,
        name: peerName.trim() || `Peer ${normalizedPeerId.slice(0, 6)}`
      });
      const created = await createOfferSignal(normalizedPeerId);
      setSignalText(created);
      setActiveTab('myid');
      Alert.alert('Offer ready', 'Share this QR and get answer QR back from your peer.');
    } catch (error) {
      Alert.alert('Failed to create offer', error.message);
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
        Alert.alert('Answer created', 'Let offer owner scan your answer QR.');
      } else {
        setPeerId(result.peerId);
        Alert.alert('Connected', 'Answer applied. Peer connection is now available.');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Invalid signal', error.message);
    } finally {
      setBusy(false);
      setScanEnabled(false);
    }
  };

  const onShareId = async () => {
    try {
      await Share.share({
        message: `My P2P Messenger ID: ${profile?.id || ''}`
      });
    } catch (error) {
      Alert.alert('Share failed', 'Unable to open share sheet.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Peer</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <View style={styles.tabWrap}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'scan' && styles.tabBtnActive]}
          onPress={() => setActiveTab('scan')}>
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            Scan QR
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'myid' && styles.tabBtnActive]}
          onPress={() => setActiveTab('myid')}>
          <Text style={[styles.tabText, activeTab === 'myid' && styles.tabTextActive]}>
            My ID
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'scan' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Scan or paste signal</Text>
              <Text style={styles.sectionDesc}>
                Scan offer/answer QR from your peer, or paste raw signal text.
              </Text>

              <TouchableOpacity
                disabled={busy}
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={() => setScanEnabled((value) => !value)}>
                <Text style={styles.primaryBtnText}>
                  {scanEnabled ? 'Stop Scanner' : 'Start Scanner'}
                </Text>
              </TouchableOpacity>

              {scanEnabled ? <QRScanner onRead={processSignal} /> : null}

              <TextInput
                value={manualSignal}
                onChangeText={setManualSignal}
                placeholder="Paste offer/answer signal text"
                placeholderTextColor={COLORS.muted}
                multiline
                style={[styles.input, styles.textArea]}
              />

              <TouchableOpacity
                disabled={busy || !manualSignal.trim()}
                style={[
                  styles.secondaryBtn,
                  (!manualSignal.trim() || busy) && styles.disabledBtn
                ]}
                onPress={() => processSignal(manualSignal)}>
                <Text style={styles.secondaryBtnText}>Process Pasted Signal</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Create offer for target peer</Text>
              <TextInput
                value={peerId}
                onChangeText={setPeerId}
                placeholder="Target Peer ID"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <TextInput
                value={peerName}
                onChangeText={setPeerName}
                placeholder="Peer name (optional)"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
              />
              <TouchableOpacity
                disabled={busy}
                style={[styles.primaryBtn, busy && styles.disabledBtn]}
                onPress={onGenerateOffer}>
                <Text style={styles.primaryBtnText}>Generate Offer QR</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My Peer ID</Text>
            <Text style={styles.sectionDesc}>Share this with trusted contacts to connect.</Text>
            <View style={styles.idPill}>
              <Text style={styles.idPillText}>{myShortId}</Text>
            </View>

            <View style={styles.qrPanel}>
              <QRCode
                size={210}
                value={signalText || profile?.id || 'p2p-messenger-profile-id-unavailable'}
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={onShareId}>
              <Text style={styles.primaryBtnText}>Share ID</Text>
            </TouchableOpacity>

            {signalText ? (
              <>
                <Text style={[styles.sectionTitle, {marginTop: 14}]}>Pending Signal QR</Text>
                <Text style={styles.signalHelper}>
                  This QR contains offer/answer payload. Let your peer scan it now.
                </Text>
                <Text selectable style={styles.signalText}>
                  {signalText}
                </Text>
              </>
            ) : (
              <Text style={styles.signalHelper}>
                Generate offer from Scan tab to create shareable signaling QR.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 52
  },
  header: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface
  },
  iconPlaceholder: {
    width: 38
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800'
  },
  tabWrap: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    padding: 4
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    height: 38
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary
  },
  tabText: {
    color: COLORS.muted,
    fontWeight: '700'
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: 14,
    paddingBottom: 28
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginBottom: 12
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800'
  },
  sectionDesc: {
    color: COLORS.muted,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 19
  },
  input: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: COLORS.text,
    minHeight: 46,
    paddingHorizontal: 12
  },
  textArea: {
    minHeight: 90,
    paddingTop: 10,
    textAlignVertical: 'top'
  },
  primaryBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  secondaryBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    color: '#C9CCFF',
    fontWeight: '700'
  },
  disabledBtn: {
    opacity: 0.55
  },
  idPill: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  idPillText: {
    color: '#D8DEFF',
    fontWeight: '700'
  },
  qrPanel: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF'
  },
  signalHelper: {
    marginTop: 12,
    color: COLORS.muted,
    lineHeight: 18
  },
  signalText: {
    marginTop: 8,
    color: '#B8C0D4',
    fontSize: 11,
    lineHeight: 15
  }
});

export default AddPeerScreen;
