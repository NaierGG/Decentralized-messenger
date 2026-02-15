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

const COLORS = {
  bg: '#111022',
  surface: '#1C1B2E',
  surfaceHover: '#25243A',
  text: '#F8FAFC',
  muted: '#A4ADC0',
  primary: '#6764F2',
  border: 'rgba(255,255,255,0.09)',
  online: '#10B981',
  connecting: '#F59E0B',
  offline: '#64748B'
};

const STATUS_FILTERS = ['All Peers', 'Online', 'Recent'];

const stateMeta = (state) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return {label: 'Online', color: COLORS.online};
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return {label: 'Connecting', color: COLORS.connecting};
  }
  return {label: 'Offline', color: COLORS.offline};
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

  const rows = useMemo(
    () =>
      peers.map((peer) => {
        const messages = getMessagesForPeer(peer.id);
        const last = messages[messages.length - 1];
        return {
          ...peer,
          lastText: last ? last.text : 'No messages yet',
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
          <Text style={styles.title}>P2P Messenger</Text>
          <View style={styles.nodeRow}>
            <View
              style={[
                styles.onlineDot,
                {backgroundColor: networkOnline ? COLORS.online : COLORS.offline}
              ]}
            />
            <Text style={styles.nodeText}>
              Node {networkOnline ? 'Online' : 'Offline'} - ID {toShortPeerLabel(profile?.id || '')}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsBtn}>
          <MaterialIcons name="settings" size={18} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((label, index) => (
          <View
            key={label}
            style={[styles.filterChip, index === 0 ? styles.filterChipActive : undefined]}>
            <Text
              style={[
                styles.filterText,
                index === 0 ? styles.filterTextActive : undefined
              ]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No peers yet</Text>
            <Text style={styles.emptyDesc}>Tap + to add a peer via QR and start secure chat.</Text>
          </View>
        }
        renderItem={({item}) => {
          const meta = stateMeta(item.connectionState);
          return (
            <Pressable
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

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddPeer')}>
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 56
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800'
  },
  nodeRow: {
    marginTop: 6,
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
    color: COLORS.muted,
    fontSize: 12
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface
  },
  filterRow: {
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 20,
    flexDirection: 'row'
  },
  filterChip: {
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  filterTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 92
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center'
  },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 20
  },
  emptyDesc: {
    marginTop: 8,
    color: COLORS.muted,
    textAlign: 'center',
    maxWidth: 250
  },
  peerCard: {
    marginBottom: 9,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: COLORS.surface,
    flexDirection: 'row'
  },
  peerCardPressed: {
    backgroundColor: COLORS.surfaceHover,
    borderColor: COLORS.border
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#302E4A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#D6DCFF',
    fontWeight: '800',
    fontSize: 15
  },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.surface
  },
  peerMain: {
    flex: 1,
    marginLeft: 11
  },
  peerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  peerName: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
    marginRight: 8
  },
  peerState: {
    fontSize: 11,
    fontWeight: '700'
  },
  peerBottom: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  lastText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 13
  },
  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 10.5,
    paddingHorizontal: 6,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  peerId: {
    marginTop: 5,
    color: '#74809C',
    fontSize: 11
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 28,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary
  },
});

export default ContactsScreen;
