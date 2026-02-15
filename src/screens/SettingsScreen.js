import React, {useMemo, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import {useTheme} from '../context/ThemeContext';
import {toShortPeerLabel} from '../utils/crypto';

const SettingsScreen = ({navigation}) => {
  const {
    profile,
    updatePrivacySettings,
    setAppPin,
    disableAppPin,
    lockApp
  } = useApp();
  const {colors, typography, spacing, mode, toggleMode, useSystemMode} = useTheme();
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const readReceiptsEnabled = Boolean(profile?.privacy?.readReceiptsEnabled);
  const typingIndicatorsEnabled = Boolean(profile?.privacy?.typingIndicatorsEnabled);
  const pinEnabled = Boolean(profile?.security?.pinEnabled);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: spacing.component.screenTop,
          overflow: 'hidden'
        },
        bgGlowTop: {
          position: 'absolute',
          top: -120,
          right: -110,
          width: 270,
          height: 270,
          borderRadius: 135,
          backgroundColor: colors.surface03,
          opacity: 0.42
        },
        bgGlowBottom: {
          position: 'absolute',
          bottom: -120,
          left: -100,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: colors.surface02,
          opacity: 0.36
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.component.screenHorizontal,
          marginBottom: spacing.sm
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
        titleWrap: {
          alignItems: 'center'
        },
        title: {
          ...typography.textStyle(typography.size.xl, typography.weight.bold),
          color: colors.textPrimary,
          letterSpacing: -0.25
        },
        subtitle: {
          marginTop: 2,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
        },
        scroll: {
          flex: 1
        },
        content: {
          paddingBottom: spacing.lg
        },
        securityBanner: {
          marginHorizontal: spacing.component.screenHorizontal,
          marginBottom: spacing.sm,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center'
        },
        securityBannerText: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
        },
        card: {
          marginHorizontal: spacing.component.screenHorizontal,
          marginBottom: spacing.sm,
          borderRadius: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          padding: spacing.md,
          shadowColor: '#000000',
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.2,
          shadowRadius: 18,
          elevation: 4
        },
        sectionTitle: {
          ...typography.textStyle(typography.size.md, typography.weight.bold),
          color: colors.textPrimary,
          marginBottom: spacing.sm
        },
        row: {
          marginBottom: spacing.sm
        },
        label: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary,
          marginBottom: spacing.xxs,
          textTransform: 'uppercase'
        },
        value: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textPrimary,
          fontFamily: typography.fontFamily.mono
        },
        actionBtn: {
          height: spacing.component.buttonHeight,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs
        },
        actionText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary,
          marginLeft: spacing.xs
        },
        themeHint: {
          marginTop: spacing.xxs,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textMuted
        },
        toggleRow: {
          minHeight: 54,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xs
        },
        toggleMain: {
          flex: 1,
          paddingRight: spacing.sm
        },
        toggleTitle: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary
        },
        toggleDescription: {
          marginTop: spacing.xxs,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textSecondary
        },
        statusPill: {
          alignSelf: 'flex-start',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          paddingVertical: 4,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.xs
        },
        statusText: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: pinEnabled ? colors.online : colors.textSecondary
        },
        pinInputWrap: {
          minHeight: 44,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface02,
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.xs
        },
        pinInput: {
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          paddingVertical: 0
        },
        pinHint: {
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textMuted,
          marginBottom: spacing.xs
        },
        dangerBtn: {
          height: spacing.component.buttonHeight,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.error,
          backgroundColor: colors.surface02,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs
        },
        dangerText: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.error,
          marginLeft: spacing.xs
        }
      }),
    [colors, typography, spacing, pinEnabled]
  );

  const onSavePin = async () => {
    const pin = String(pinValue || '').replace(/\D/g, '');
    const confirm = String(pinConfirm || '').replace(/\D/g, '');

    if (pin.length < 4 || pin.length > 8) {
      Alert.alert('Invalid PIN', 'Use 4 to 8 digits.');
      return;
    }

    if (pin !== confirm) {
      Alert.alert('PIN mismatch', 'PIN and confirmation must match.');
      return;
    }

    try {
      setPinBusy(true);
      await setAppPin(pin);
      setPinValue('');
      setPinConfirm('');
      Alert.alert('PIN updated', 'App lock PIN has been saved.');
    } catch (error) {
      Alert.alert('Failed to save PIN', error.message);
    } finally {
      setPinBusy(false);
    }
  };

  const onDisablePin = async () => {
    try {
      setPinBusy(true);
      await disableAppPin(pinValue);
      setPinValue('');
      setPinConfirm('');
      Alert.alert('PIN disabled', 'App lock has been turned off.');
    } catch (error) {
      Alert.alert('Failed to disable PIN', error.message);
    } finally {
      setPinBusy(false);
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
          accessibilityLabel="Back"
          hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>Session Settings</Text>
          <Text style={styles.subtitle}>Privacy-first local profile</Text>
        </View>

        <View style={{width: spacing.component.iconButtonMin}} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.securityBanner}>
          <MaterialIcons name="verified-user" size={16} color={colors.success} />
          <Text style={styles.securityBannerText}>
            Keys and profile data stay on this device and are never uploaded.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My Session Profile</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{profile?.name || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session ID</Text>
            <Text style={styles.value}>{toShortPeerLabel(profile?.id || '')}</Text>
          </View>
          <View>
            <Text style={styles.label}>Fingerprint</Text>
            <Text style={styles.value}>
              {toShortPeerLabel(profile?.identityFingerprint || '')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleMain}>
              <Text style={styles.toggleTitle}>Send read receipts</Text>
              <Text style={styles.toggleDescription}>
                Let the peer know when messages are read.
              </Text>
            </View>
            <Switch
              value={readReceiptsEnabled}
              onValueChange={(value) =>
                updatePrivacySettings({readReceiptsEnabled: Boolean(value)})
              }
              thumbColor={colors.onPrimary}
              trackColor={{false: colors.border, true: colors.primary}}
              accessibilityLabel="Read receipts"
            />
          </View>

          <View style={[styles.toggleRow, {marginBottom: 0}]}>
            <View style={styles.toggleMain}>
              <Text style={styles.toggleTitle}>Send typing indicators</Text>
              <Text style={styles.toggleDescription}>
                Let the peer know when you are typing.
              </Text>
            </View>
            <Switch
              value={typingIndicatorsEnabled}
              onValueChange={(value) =>
                updatePrivacySettings({typingIndicatorsEnabled: Boolean(value)})
              }
              thumbColor={colors.onPrimary}
              trackColor={{false: colors.border, true: colors.primary}}
              accessibilityLabel="Typing indicators"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App Lock PIN</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{pinEnabled ? 'PIN enabled' : 'PIN disabled'}</Text>
          </View>

          <View style={styles.pinInputWrap}>
            <TextInput
              value={pinValue}
              onChangeText={(value) => setPinValue(String(value || '').replace(/\D/g, ''))}
              placeholder={pinEnabled ? 'Current or new PIN' : 'New PIN'}
              placeholderTextColor={colors.textMuted}
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              accessibilityLabel="PIN"
            />
          </View>
          <View style={styles.pinInputWrap}>
            <TextInput
              value={pinConfirm}
              onChangeText={(value) => setPinConfirm(String(value || '').replace(/\D/g, ''))}
              placeholder="Confirm PIN"
              placeholderTextColor={colors.textMuted}
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              accessibilityLabel="Confirm PIN"
            />
          </View>
          <Text style={styles.pinHint}>Use 4 to 8 digits. The app locks on background.</Text>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onSavePin}
            disabled={pinBusy}
            accessibilityRole="button"
            accessibilityLabel="Save PIN">
            <MaterialIcons name="lock" size={18} color={colors.textPrimary} />
            <Text style={styles.actionText}>{pinEnabled ? 'Change PIN' : 'Enable PIN'}</Text>
          </TouchableOpacity>

          {pinEnabled ? (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={lockApp}
                disabled={pinBusy}
                accessibilityRole="button"
                accessibilityLabel="Lock now">
                <MaterialIcons name="lock-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.actionText}>Lock now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={onDisablePin}
                disabled={pinBusy}
                accessibilityRole="button"
                accessibilityLabel="Disable PIN">
                <MaterialIcons name="lock-open" size={18} color={colors.error} />
                <Text style={styles.dangerText}>Disable PIN</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={toggleMode}
            accessibilityRole="button"
            accessibilityLabel="Toggle dark mode">
            <MaterialIcons
              name={mode === 'dark' ? 'dark-mode' : 'light-mode'}
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.actionText}>
              {mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={useSystemMode}
            accessibilityRole="button"
            accessibilityLabel="Use system theme">
            <MaterialIcons name="settings-suggest" size={18} color={colors.textPrimary} />
            <Text style={styles.actionText}>Use system theme</Text>
          </TouchableOpacity>

          <Text style={styles.themeHint}>Current mode: {mode === 'dark' ? 'Dark' : 'Light'}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
