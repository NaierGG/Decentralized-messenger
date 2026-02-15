import React, {useMemo} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import {useTheme} from '../context/ThemeContext';
import {toShortPeerLabel} from '../utils/crypto';

const SettingsScreen = ({navigation}) => {
  const {profile} = useApp();
  const {colors, typography, spacing, mode, toggleMode, useSystemMode} = useTheme();

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
        }
      }),
    [colors, typography, spacing]
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>Session 설정</Text>
          <Text style={styles.subtitle}>Privacy-first local profile</Text>
        </View>

        <View style={{width: spacing.component.iconButtonMin}} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.securityBanner}>
          <MaterialIcons name="verified-user" size={16} color={colors.success} />
          <Text style={styles.securityBannerText}>키와 프로필은 기기에만 저장되며 서버로 업로드되지 않습니다</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>내 Session 프로필</Text>
          <View style={styles.row}>
            <Text style={styles.label}>이름</Text>
            <Text style={styles.value}>{profile?.name || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Session ID</Text>
            <Text style={styles.value}>{toShortPeerLabel(profile?.id || '')}</Text>
          </View>
          <View>
            <Text style={styles.label}>지문</Text>
            <Text style={styles.value}>{toShortPeerLabel(profile?.identityFingerprint || '')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>화면 테마</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={toggleMode}
            accessibilityRole="button"
            accessibilityLabel="다크 모드 전환">
            <MaterialIcons
              name={mode === 'dark' ? 'dark-mode' : 'light-mode'}
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.actionText}>
              {mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={useSystemMode}
            accessibilityRole="button"
            accessibilityLabel="시스템 테마 사용">
            <MaterialIcons name="settings-suggest" size={18} color={colors.textPrimary} />
            <Text style={styles.actionText}>시스템 설정 사용</Text>
          </TouchableOpacity>

          <Text style={styles.themeHint}>현재 모드: {mode === 'dark' ? 'Dark' : 'Light'}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
