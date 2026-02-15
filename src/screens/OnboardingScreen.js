import React, {useMemo, useState} from 'react';
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
import {useTheme} from '../context/ThemeContext';

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCixoI0R-UBwVip6lkjlxzTDG7vVcb3snxaLvJ4zB3ii1AnzgDXrCzfxkEginiX1kwCAP3Ci9NMbGEj292yptV665yT44nYJMhlrnj47nBBj627RWCHfxOCPLTL-ji8Slni4bROeTmU8dfUQSUsmaGPcsSyvaco43RYEKwMlnsXSiHC4hF4gnLE9mvDME2xGfRgKTzDJDmnfft68koIyEjP_Hb0M3r57hE2Ja0Ijrvf40TrnMovniAyCWPcQqX39qkGxG61LFKLPoM';

const OnboardingScreen = () => {
  const {createOrUpdateProfile} = useApp();
  const {colors, spacing, typography} = useTheme();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background
        },
        bgOrbTop: {
          position: 'absolute',
          top: -100,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: colors.surface03
        },
        bgOrbSide: {
          position: 'absolute',
          top: 210,
          left: -70,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: colors.surface02
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: Platform.OS === 'ios' ? spacing['2xl'] + 10 : spacing.xl + spacing.xs,
          paddingBottom: spacing.lg
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
          marginBottom: spacing.lg,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.surface01
        },
        heroImage: {
          width: 170,
          height: 170,
          borderRadius: 85
        },
        badge: {
          position: 'absolute',
          bottom: spacing.xs,
          right: -spacing.xs + 2,
          borderRadius: 999,
          backgroundColor: colors.surface01,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.xs + 1,
          paddingVertical: spacing.xxs + 1,
          flexDirection: 'row',
          alignItems: 'center'
        },
        badgeText: {
          marginLeft: spacing.xxs,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
          color: colors.textPrimary
        },
        title: {
          ...typography.textStyle(typography.size['3xl'], typography.weight.bold, typography.lineHeight.tight),
          color: colors.textPrimary,
          letterSpacing: -0.5
        },
        titlePrimary: {
          color: colors.primary
        },
        subtitle: {
          marginTop: spacing.xs,
          maxWidth: 290,
          textAlign: 'center',
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary
        },
        formSection: {
          borderRadius: spacing.md + 6,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.md + 2
        },
        label: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary,
          marginBottom: spacing.xs
        },
        inputWrap: {
          borderRadius: spacing.sm + 2,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm
        },
        input: {
          flex: 1,
          marginLeft: spacing.xs - 1,
          height: 52,
          color: colors.textPrimary
        },
        infoBox: {
          marginTop: spacing.sm,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          flexDirection: 'row',
          paddingHorizontal: spacing.sm - 1,
          paddingVertical: spacing.xs + 2
        },
        infoText: {
          flex: 1,
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textSecondary
        },
        button: {
          marginTop: spacing.sm + 3,
          height: 54,
          borderRadius: spacing.sm + 2,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center'
        },
        buttonDisabled: {
          opacity: 0.7
        },
        buttonText: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.onPrimary
        },
        restoreText: {
          marginTop: spacing.sm,
          textAlign: 'center',
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textSecondary
        }
      }),
    [colors, spacing, typography]
  );

  const onContinue = async () => {
    try {
      setSaving(true);
      await createOrUpdateProfile(name);
    } catch (error) {
      Alert.alert('이름을 확인해 주세요', error.message);
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
              <MaterialIcons name="lock" size={12} color={colors.success} />
              <Text style={styles.badgeText}>안전 보장</Text>
            </View>
          </View>
          <Text style={styles.title}>
            <Text style={styles.titlePrimary}>안전한</Text> 메신저
          </Text>
          <Text style={styles.subtitle}>당신의 대화는 오직 당신만 볼 수 있어요</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>어떻게 불러드릴까요?</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="person-outline" size={18} color={colors.textSecondary} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="표시 이름 입력"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
              accessibilityLabel="표시 이름 입력"
            />
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              프로필과 키는 이 기기에만 저장됩니다. 서버로 업로드되지 않아요.
            </Text>
          </View>

          <TouchableOpacity
            disabled={saving}
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="프로필 만들기">
            <Text style={styles.buttonText}>
              {saving ? '프로필 생성 중...' : '프로필 만들고 시작하기'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="기존 프로필 복원">
            <Text style={styles.restoreText}>기존 프로필 복원</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default OnboardingScreen;
