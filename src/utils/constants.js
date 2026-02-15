export const STORAGE_KEYS = {
  PROFILE: '@p2p_messenger/profile',
  PEERS: '@p2p_messenger/peers',
  MESSAGES: '@p2p_messenger/messages'
};

export const SIGNAL_TYPES = {
  OFFER: 'offer',
  ANSWER: 'answer'
};

export const CONNECTION_STATES = {
  NEW: 'new',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  CLOSED: 'closed'
};

export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

export const THEME = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F7FF',
    text: '#111827',
    subtleText: '#6B7280',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    success: '#10B981',
    error: '#EF4444',
    border: '#E5E7EB'
  },
  dark: {
    background: '#111827',
    surface: '#1F2937',
    text: '#F9FAFB',
    subtleText: '#D1D5DB',
    primary: '#6366F1',
    secondary: '#8B5CF6',
    success: '#10B981',
    error: '#EF4444',
    border: '#374151'
  }
};

export const DEFAULT_ICE_SERVERS = [
  {urls: 'stun:stun.l.google.com:19302'},
  {urls: 'stun:stun1.l.google.com:19302'}
];

const parseTurnServersFromEnv = () => {
  const raw = global?.process?.env?.P2P_TURN_ICE_SERVERS;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const TURN_ICE_SERVERS = (() => {
  if (Array.isArray(global?.__P2P_TURN_ICE_SERVERS__)) {
    return global.__P2P_TURN_ICE_SERVERS__;
  }
  return parseTurnServersFromEnv();
})();

export const ICE_SERVERS = [...DEFAULT_ICE_SERVERS, ...TURN_ICE_SERVERS];
