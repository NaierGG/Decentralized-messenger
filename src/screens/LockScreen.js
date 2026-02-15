import React, {useEffect, useMemo, useState} from 'react';
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

const LockScreen = () => {
  const {profile, unlockApp} = useApp();
  const {colors, spacing, typography} = useTheme();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());

  const lockoutActive = lockoutUntil > nowTs;
  const lockoutRemainingSec = lockoutActive
    ? Math.ceil((lockoutUntil - nowTs) / 1000)
    : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg
        },
        card: {
          borderRadius: spacing.md + 4,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.lg
        },
        iconWrap: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.surface02,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          marginBottom: spacing.md
        },
        title: {
          ...typography.textStyle(typography.size.lg, typography.weight.bold),
          color: colors.textPrimary,
          textAlign: 'center'
        },
        subtitle: {
          marginTop: spacing.xs,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary,
          textAlign: 'center'
        },
        lockoutText: {
          marginTop: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.warning,
          textAlign: 'center'
        },
        attemptText: {
          marginTop: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textMuted,
          textAlign: 'center'
        },
        inputWrap: {
          marginTop: spacing.md,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingHorizontal: spacing.sm
        },
        input: {
          height: 48,
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.md, typography.weight.semibold)
        },
        button: {
          marginTop: spacing.md,
          height: 46,
          borderRadius: spacing.sm,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center'
        },
        buttonDisabled: {
          opacity: 0.6
        },
        buttonText: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.onPrimary
        }
      }),
    [colors, spacing, typography]
  );

  useEffect(() => {
    if (!lockoutActive) {
      return undefined;
    }

    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 500);

    return () => clearInterval(timer);
  }, [lockoutActive]);

  const onUnlock = async () => {
    if (!pin.trim() || lockoutActive) {
      return;
    }

    try {
      setBusy(true);
      const verified = unlockApp(pin);
      if (!verified) {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setPin('');

        if (nextFailed >= 5) {
          const nextLockoutUntil = Date.now() + 30000;
          setLockoutUntil(nextLockoutUntil);
          setFailedAttempts(0);
          setNowTs(Date.now());
          Alert.alert('Too many attempts', 'Locked for 30 seconds.');
          return;
        }

        const remaining = 5 - nextFailed;
        Alert.alert('Wrong PIN', `${remaining} attempts left before lockout.`);
        return;
      }
      setFailedAttempts(0);
      setLockoutUntil(0);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="lock" size={34} color={colors.primary} />
        </View>
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          Enter PIN for {profile?.name || 'your profile'} to continue.
        </Text>
        {lockoutActive ? (
          <Text style={styles.lockoutText}>
            Too many attempts. Try again in {lockoutRemainingSec}s.
          </Text>
        ) : (
          <Text style={styles.attemptText}>
            {failedAttempts > 0 ? `${failedAttempts} failed attempts` : ' '}
          </Text>
        )}

        <View style={styles.inputWrap}>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(String(value || '').replace(/\D/g, ''))}
            placeholder="PIN"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            editable={!lockoutActive}
            accessibilityLabel="PIN input"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (busy || !pin.trim() || lockoutActive) && styles.buttonDisabled
          ]}
          disabled={busy || !pin.trim() || lockoutActive}
          onPress={onUnlock}
          accessibilityRole="button"
          accessibilityLabel="Unlock app">
          <Text style={styles.buttonText}>{busy ? 'Unlocking...' : 'Unlock'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LockScreen;
