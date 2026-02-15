import React, {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
    return {label: 'Online', color: colors.online};
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return {label: 'Connecting', color: colors.connecting};
  }
  return {label: 'Offline', color: colors.offline};
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

const getLastMessagePreview = (message, isSelf) => {
  if (!message) {
    return isSelf ? 'Write a note to yourself.' : 'No messages yet.';
  }

  if (message.type === 'attachment') {
    if (message.attachment?.type === 'audio') {
      return '[Voice message]';
    }
    const name = String(message.attachment?.name || '').trim();
    return name ? `[Attachment] ${name}` : '[Attachment]';
  }

  const text = String(message.text || '').trim();
  return text || (isSelf ? 'Write a note to yourself.' : 'No messages yet.');
};

const ContactsScreen = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    profile,
    peers,
    getMessagesForPeer,
    getPeerConnectionState,
    getUnreadCountForPeer,
    networkOnline,
    togglePeerPinned
  } = useApp();
  const {colors, spacing, typography} = useTheme();

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
          right: -120,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: colors.surface03,
          opacity: 0.45
        },
        bgGlowBottom: {
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: colors.surface02,
          opacity: 0.4
        },
        header: {
          paddingHorizontal: spacing.component.screenHorizontal,
          paddingBottom: spacing.xs,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        },
        title: {
          ...typography.textStyle(
            typography.size['2xl'],
            typography.weight.bold,
            typography.lineHeight.tight
          ),
          color: colors.textPrimary,
          letterSpacing: -0.5
        },
        subtitle: {
          marginTop: spacing.xxs,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          color: colors.textSecondary
        },
        statusRow: {
          marginTop: spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          borderRadius: 999,
          paddingVertical: spacing.xxs + 1,
          paddingHorizontal: spacing.xs + 2,
          alignSelf: 'flex-start'
        },
        onlineDot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          marginRight: spacing.xxs + 1
        },
        statusText: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
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
        securityBanner: {
          marginTop: spacing.xs,
          marginHorizontal: spacing.component.screenHorizontal,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm
        },
        securityBannerText: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: colors.textSecondary
        },
        searchWrap: {
          marginTop: spacing.sm,
          marginHorizontal: spacing.component.screenHorizontal,
          minHeight: 42,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm
        },
        searchInput: {
          flex: 1,
          color: colors.textPrimary,
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          paddingVertical: 0,
          marginLeft: spacing.xxs
        },
        searchClearBtn: {
          width: 26,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center'
        },
        pinnedSection: {
          marginBottom: spacing.sm
        },
        pinnedTitle: {
          marginBottom: spacing.xs,
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.bold),
          color: colors.textSecondary,
          letterSpacing: 0.3,
          textTransform: 'uppercase'
        },
        pinnedScroll: {
          paddingHorizontal: spacing.xs
        },
        pinnedChip: {
          minWidth: 132,
          maxWidth: 180,
          borderRadius: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          marginRight: spacing.xs
        },
        pinnedChipPressed: {
          backgroundColor: colors.surface02
        },
        pinnedChipTop: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        pinnedChipName: {
          flex: 1,
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary
        },
        pinnedChipMeta: {
          marginTop: 2,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: colors.textMuted
        },
        listSectionTitle: {
          marginBottom: spacing.xs,
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.bold),
          color: colors.textSecondary,
          letterSpacing: 0.3,
          textTransform: 'uppercase'
        },
        listContent: {
          marginTop: spacing.sm,
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
          maxWidth: 280
        },
        peerCard: {
          marginBottom: spacing.xs + 3,
          borderRadius: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          flexDirection: 'row'
        },
        peerCardPressed: {
          backgroundColor: colors.surface02
        },
        avatarWrap: {
          width: 52,
          height: 52,
          borderRadius: 26,
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
          right: 1,
          bottom: 1,
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.surface01
        },
        peerMain: {
          flex: 1,
          marginLeft: spacing.sm
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
        peerStatePill: {
          borderRadius: 999,
          paddingVertical: 3,
          paddingHorizontal: spacing.xs,
          backgroundColor: colors.surface02
        },
        peerState: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold)
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
          marginTop: spacing.xxs + 2,
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
          shadowOffset: {width: 0, height: 10},
          shadowOpacity: 0.3,
          shadowRadius: 14,
          elevation: 10
        }
      }),
    [colors, spacing, typography]
  );

  const rows = useMemo(
    () =>
      [...peers]
        .sort((a, b) => {
          if (Boolean(a.isSelf) !== Boolean(b.isSelf)) {
            return a.isSelf ? -1 : 1;
          }
          if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
            return a.isPinned ? -1 : 1;
          }
          return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
        })
        .map((peer) => {
          const messages = getMessagesForPeer(peer.id);
          const last = messages[messages.length - 1];
          return {
            ...peer,
            lastText: getLastMessagePreview(last, Boolean(peer.isSelf)),
            unreadCount: getUnreadCountForPeer(peer.id),
            connectionState: getPeerConnectionState(peer.id)
          };
        }),
    [peers, getMessagesForPeer, getPeerConnectionState, getUnreadCountForPeer]
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((item) => {
      const searchBlob = [item.name, item.id, item.lastText].join(' ').toLowerCase();
      return searchBlob.includes(query);
    });
  }, [rows, searchQuery]);

  const pinnedRows = useMemo(
    () => filteredRows.filter((item) => Boolean(item.isPinned)),
    [filteredRows]
  );
  const isFiltering = Boolean(searchQuery.trim());

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Session</Text>
          <Text style={styles.subtitle}>Secure messages routed privately</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.onlineDot,
                {backgroundColor: networkOnline ? colors.online : colors.offline}
              ]}
            />
            <Text style={styles.statusText}>
              {networkOnline ? 'Network online' : 'Network offline'} | Session ID{' '}
              {toShortPeerLabel(profile?.id || '')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings">
          <MaterialIcons name="settings" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.securityBanner}>
        <MaterialIcons name="shield" size={16} color={colors.success} />
        <Text style={styles.securityBannerText}>
          Every conversation is protected by end-to-end encryption.
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={17} color={colors.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts or last messages"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search contacts"
        />
        {searchQuery ? (
          <TouchableOpacity
            style={styles.searchClearBtn}
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <MaterialIcons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {pinnedRows.length ? (
              <View style={styles.pinnedSection}>
                <Text style={styles.pinnedTitle}>Pinned</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pinnedScroll}>
                  {pinnedRows.map((item) => {
                    const meta = stateMeta(item.connectionState, colors);
                    return (
                      <Pressable
                        key={`pinned-${item.id}`}
                        style={({pressed}) => [
                          styles.pinnedChip,
                          pressed && styles.pinnedChipPressed
                        ]}
                        onPress={() =>
                          navigation.navigate('Chat', {
                            peerId: item.id,
                            peerName: item.name
                          })
                        }
                        onLongPress={() => togglePeerPinned(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open pinned chat with ${item.name}`}>
                        <View style={styles.pinnedChipTop}>
                          <Text numberOfLines={1} style={styles.pinnedChipName}>
                            {item.name}
                          </Text>
                          <MaterialIcons name="push-pin" size={15} color={colors.primary} />
                        </View>
                        <Text numberOfLines={1} style={styles.pinnedChipMeta}>
                          {meta.label} | {item.lastText}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.listSectionTitle}>All conversations</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {isFiltering ? 'No matching conversations' : 'No contacts yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {isFiltering
                ? 'Try another keyword.'
                : 'Add a peer and start a new private conversation.'}
            </Text>
          </View>
        }
        renderItem={({item}) => {
          const meta = stateMeta(item.connectionState, colors);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${item.name}`}
              style={({pressed}) => [styles.peerCard, pressed && styles.peerCardPressed]}
              onLongPress={() => togglePeerPinned(item.id)}
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
                  {item.isPinned ? (
                    <MaterialIcons
                      name="push-pin"
                      size={16}
                      color={colors.primary}
                      style={{marginRight: spacing.xs}}
                    />
                  ) : null}
                  <View style={styles.peerStatePill}>
                    <Text style={[styles.peerState, {color: meta.color}]}>{meta.label}</Text>
                  </View>
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

                <Text style={styles.peerId}>ID {toShortPeerLabel(item.id)}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddPeer')}
        accessibilityRole="button"
        accessibilityLabel="Add peer">
        <MaterialIcons name="add" size={28} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

export default ContactsScreen;
