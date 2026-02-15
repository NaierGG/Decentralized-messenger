import React from 'react';
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: spacing.component.screenTop
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.component.screenHorizontal,
      marginBottom: spacing.md
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
    title: {
      ...typography.textStyle(typography.size.xl, typography.weight.bold),
      color: colors.textPrimary
    },
    card: {
      marginHorizontal: spacing.component.screenHorizontal,
      marginBottom: spacing.sm,
      borderRadius: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface01,
      padding: spacing.md
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
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
          <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>설정</Text>
        <View style={{width: spacing.component.iconButtonMin}} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>내 프로필</Text>
          <View style={styles.row}>
            <Text style={styles.label}>이름</Text>
            <Text style={styles.value}>{profile?.name || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>내 ID</Text>
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
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
