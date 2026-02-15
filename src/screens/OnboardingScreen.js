import React, {useMemo, useState} from 'react';
import {
  Alert,
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
          backgroundColor: colors.background,
          overflow: 'hidden'
        },
        bgOrbTop: {
          position: 'absolute',
          top: -120,
          right: -130,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: colors.surface03,
          opacity: 0.5
        },
        bgOrbSide: {
          position: 'absolute',
          bottom: -80,
          left: -70,
          width: 230,
          height: 230,
          borderRadius: 115,
          backgroundColor: colors.surface02,
          opacity: 0.45
        },
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingTop: Platform.OS === 'ios' ? spacing['2xl'] + 10 : spacing.xl + spacing.sm,
          paddingBottom: spacing.lg
        },
        topBar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        },
        brand: {
          ...typography.textStyle(typography.size.xl, typography.weight.bold),
          color: colors.textPrimary,
          letterSpacing: -0.3
        },
        statusChip: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingHorizontal: spacing.sm - 1,
          paddingVertical: spacing.xxs + 1,
          flexDirection: 'row',
          alignItems: 'center'
        },
        statusDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          marginRight: spacing.xxs + 1,
          backgroundColor: colors.online
        },
        statusText: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
          color: colors.textSecondary
        },
        heroSection: {
          marginTop: spacing['2xl'] - 4,
          alignItems: 'center',
          justifyContent: 'center'
        },
        heroRing: {
          width: 124,
          height: 124,
          borderRadius: 62,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.25,
          shadowRadius: 24,
          elevation: 8
        },
        badge: {
          position: 'absolute',
          bottom: -spacing.xs + 2,
          right: -spacing.sm + 1,
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
          ...typography.textStyle(
            typography.size['3xl'],
            typography.weight.bold,
            typography.lineHeight.tight
          ),
          color: colors.textPrimary,
          letterSpacing: -0.5,
          textAlign: 'center'
        },
        titlePrimary: {
          color: colors.primary
        },
        subtitle: {
          marginTop: spacing.xs,
          maxWidth: 300,
          textAlign: 'center',
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary
        },
        formSection: {
          marginTop: spacing['2xl'],
          borderRadius: spacing.md + 6,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.md + 2,
          shadowColor: '#000000',
          shadowOffset: {width: 0, height: 10},
          shadowOpacity: 0.22,
          shadowRadius: 20,
          elevation: 6
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
        <View style={styles.topBar}>
          <Text style={styles.brand}>Session</Text>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Private routing ready</Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.heroRing}>
            <MaterialIcons name="lock" size={48} color={colors.primary} />
            <View style={styles.badge}>
              <MaterialIcons name="shield" size={12} color={colors.success} />
              <Text style={styles.badgeText}>E2E 암호화</Text>
            </View>
          </View>
          <Text style={styles.title}>
            <Text style={styles.titlePrimary}>Session 스타일</Text>
            {'\n'}
            보안 메신저
          </Text>
          <Text style={styles.subtitle}>
            전화번호 없이 Session ID로 연결하고, 모든 대화를 종단간 암호화로 보호합니다.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>표시 이름</Text>
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
              프로필과 암호화 키는 이 기기에만 저장되며 중앙 서버에 업로드되지 않습니다.
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
            <Text style={styles.restoreText}>복원 기능은 곧 제공됩니다</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default OnboardingScreen;
