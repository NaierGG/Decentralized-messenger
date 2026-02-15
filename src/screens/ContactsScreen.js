import React, {useMemo} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {useApp} from '../context/AppContext';
import {CONNECTION_STATES} from '../utils/constants';
import {toShortPeerLabel} from '../utils/crypto';
import {useTheme} from '../context/ThemeContext';

const stateMeta = (state, colors) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return {label: '온라인', color: colors.online};
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return {label: '연결 중', color: colors.connecting};
  }
  return {label: '오프라인', color: colors.offline};
};

const initials = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return 'P';
  }
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const ContactsScreen = ({navigation}) => {
  const {
    profile,
    peers,
    getMessagesForPeer,
    getPeerConnectionState,
    getUnreadCountForPeer,
    networkOnline
  } = useApp();
  const {colors, spacing, typography} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: spacing.component.screenTop
        },
        header: {
          paddingHorizontal: spacing.component.screenHorizontal,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        },
        title: {
          ...typography.textStyle(typography.size['2xl'], typography.weight.bold, typography.lineHeight.tight),
          color: colors.textPrimary
        },
        nodeRow: {
          marginTop: spacing.xs - 2,
          flexDirection: 'row',
          alignItems: 'center'
        },
        onlineDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 7
        },
        nodeText: {
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textSecondary
        },
        settingsBtn: {
          width: spacing.component.iconButtonMin,
          height: spacing.component.iconButtonMin,
          borderRadius: spacing.component.iconButtonMin / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface01,
          borderWidth: 1,
          borderColor: colors.border
        },
        listContent: {
          marginTop: spacing.md,
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing['3xl'] + spacing.lg
        },
        emptyState: {
          marginTop: spacing['2xl'] + spacing.sm,
          alignItems: 'center',
          paddingHorizontal: spacing.lg
        },
        emptyTitle: {
          ...typography.textStyle(typography.size.lg, typography.weight.bold),
          color: colors.textPrimary
        },
        emptyDesc: {
          marginTop: spacing.xs,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary,
          textAlign: 'center',
          maxWidth: 260
        },
        peerCard: {
          marginBottom: spacing.xs + 2,
          borderRadius: spacing.md,
          padding: spacing.sm,
          borderWidth: 1,
          borderColor: 'transparent',
          backgroundColor: colors.surface01,
          flexDirection: 'row'
        },
        peerCardPressed: {
          backgroundColor: colors.surface02,
          borderColor: colors.border
        },
        avatarWrap: {
          width: 52,
          height: 52,
          borderRadius: spacing.sm,
          backgroundColor: colors.surface03,
          alignItems: 'center',
          justifyContent: 'center'
        },
        avatarText: {
          ...typography.textStyle(typography.size.sm, typography.weight.bold),
          color: colors.textPrimary
        },
        statusDot: {
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: colors.surface01
        },
        peerMain: {
          flex: 1,
          marginLeft: spacing.sm - 1
        },
        peerTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        },
        peerName: {
          flex: 1,
          ...typography.textStyle(typography.size.md, typography.weight.bold),
          color: colors.textPrimary,
          marginRight: spacing.xs
        },
        peerState: {
          ...typography.textStyle(typography.size.xs, typography.weight.semibold)
        },
        peerBottom: {
          marginTop: spacing.xxs + 1,
          flexDirection: 'row',
          alignItems: 'center'
        },
        lastText: {
          flex: 1,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary
        },
        unreadBadge: {
          minWidth: 21,
          height: 21,
          borderRadius: 10.5,
          paddingHorizontal: spacing.xs - 2,
          marginLeft: spacing.xs - 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary
        },
        unreadText: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.bold),
          color: colors.onPrimary
        },
        peerId: {
          marginTop: spacing.xxs + 1,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: colors.textMuted,
          fontFamily: typography.fontFamily.mono
        },
        fab: {
          position: 'absolute',
          right: spacing.md + 6,
          bottom: spacing.xl - 4,
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          shadowColor: '#000000',
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 10
        }
      }),
    [colors, spacing, typography]
  );

  const rows = useMemo(
    () =>
      peers.map((peer) => {
        const messages = getMessagesForPeer(peer.id);
        const last = messages[messages.length - 1];
        return {
          ...peer,
          lastText: last ? last.text : '아직 메시지가 없어요',
          unreadCount: getUnreadCountForPeer(peer.id),
          connectionState: getPeerConnectionState(peer.id)
        };
      }),
    [peers, getMessagesForPeer, getPeerConnectionState, getUnreadCountForPeer]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Veil</Text>
          <View style={styles.nodeRow}>
            <View
              style={[
                styles.onlineDot,
                {backgroundColor: networkOnline ? colors.online : colors.offline}
              ]}
            />
            <Text style={styles.nodeText}>
              노드 {networkOnline ? '온라인' : '오프라인'} · ID {toShortPeerLabel(profile?.id || '')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('settings')}
          accessibilityRole="button"
          accessibilityLabel="설정 열기">
          <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>연결된 친구가 없어요</Text>
            <Text style={styles.emptyDesc}>아래 + 버튼으로 친구를 추가하고 안전한 대화를 시작해 보세요.</Text>
          </View>
        }
        renderItem={({item}) => {
          const meta = stateMeta(item.connectionState, colors);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 채팅 열기`}
              style={({pressed}) => [styles.peerCard, pressed && styles.peerCardPressed]}
              onPress={() =>
                navigation.navigate('Chat', {
                  peerId: item.id,
                  peerName: item.name
                })
              }>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
                <View style={[styles.statusDot, {backgroundColor: meta.color}]} />
              </View>

              <View style={styles.peerMain}>
                <View style={styles.peerTop}>
                  <Text numberOfLines={1} style={styles.peerName}>
                    {item.name}
                  </Text>
                  <Text style={[styles.peerState, {color: meta.color}]}>{meta.label}</Text>
                </View>

                <View style={styles.peerBottom}>
                  <Text numberOfLines={1} style={styles.lastText}>
                    {item.lastText}
                  </Text>
                  {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.peerId}>{toShortPeerLabel(item.id)}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPeer')}
        accessibilityRole="button"
        accessibilityLabel="친구 추가">
        <MaterialIcons name="add" size={28} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

export default ContactsScreen;
