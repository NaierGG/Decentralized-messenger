import React, {useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';

const COLORS = {
  bg: '#111022',
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.12)',
  text: '#F8FAFC',
  muted: '#A4ADC0',
  primary: '#6764F2',
  primarySoft: 'rgba(103,100,242,0.16)',
  success: '#34D399',
  input: 'rgba(255,255,255,0.08)'
};

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCixoI0R-UBwVip6lkjlxzTDG7vVcb3snxaLvJ4zB3ii1AnzgDXrCzfxkEginiX1kwCAP3Ci9NMbGEj292yptV665yT44nYJMhlrnj47nBBj627RWCHfxOCPLTL-ji8Slni4bROeTmU8dfUQSUsmaGPcsSyvaco43RYEKwMlnsXSiHC4hF4gnLE9mvDME2xGfRgKTzDJDmnfft68koIyEjP_Hb0M3r57hE2Ja0Ijrvf40TrnMovniAyCWPcQqX39qkGxG61LFKLPoM';

const OnboardingScreen = () => {
  const {createOrUpdateProfile} = useApp();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    try {
      setSaving(true);
      await createOrUpdateProfile(name);
    } catch (error) {
      Alert.alert('Invalid profile', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbSide} />

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.heroRing}>
            <Image source={{uri: HERO_IMAGE}} style={styles.heroImage} />
            <View style={styles.badge}>
              <MaterialIcons name="lock" size={12} color={COLORS.success} />
              <Text style={styles.badgeText}>E2E Encrypted</Text>
            </View>
          </View>
          <Text style={styles.title}>
            Secure <Text style={styles.titlePrimary}>P2P</Text> Chat
          </Text>
          <Text style={styles.subtitle}>
            Experience true privacy. No servers. No tracking. Just direct WebRTC connection.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Who are you?</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="person-outline" size={18} color={COLORS.muted} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Choose a display name"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Your profile is stored locally on this device. No personal data is uploaded.
            </Text>
          </View>

          <TouchableOpacity
            disabled={saving}
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={onContinue}>
            <Text style={styles.buttonText}>
              {saving ? 'Creating Profile...' : 'Create Profile & Start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity disabled={saving}>
            <Text style={styles.restoreText}>Restore existing profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  bgOrbTop: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(103,100,242,0.22)'
  },
  bgOrbSide: {
    position: 'absolute',
    top: 210,
    left: -70,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(139,92,246,0.2)'
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 24
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroRing: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card
  },
  heroImage: {
    width: 170,
    height: 170,
    borderRadius: 85
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    right: -6,
    borderRadius: 999,
    backgroundColor: '#1A1B33',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeText: {
    marginLeft: 4,
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '700'
  },
  title: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  titlePrimary: {
    color: COLORS.primary
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 290,
    textAlign: 'center',
    color: COLORS.muted,
    lineHeight: 21
  },
  formSection: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: 'rgba(17,16,34,0.7)',
    padding: 18
  },
  label: {
    color: '#E2E8F0',
    fontWeight: '700',
    marginBottom: 10
  },
  inputWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.input,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  input: {
    flex: 1,
    marginLeft: 7,
    height: 52,
    color: COLORS.text
  },
  infoBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(103,100,242,0.45)',
    backgroundColor: COLORS.primarySoft,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 10
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17
  },
  button: {
    marginTop: 15,
    height: 54,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15
  },
  restoreText: {
    marginTop: 13,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12
  }
});

export default OnboardingScreen;
