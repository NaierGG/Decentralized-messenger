const SIGNAL_PREFIX = 'p2pmsg://';

class SignalingService {
  toQrString(payload) {
    const serialized = JSON.stringify(payload);
    return `${SIGNAL_PREFIX}${encodeURIComponent(serialized)}`;
  }

  fromQrString(rawSignal) {
    if (!rawSignal || typeof rawSignal !== 'string') {
      throw new Error('Invalid signal payload');
    }

    const trimmed = rawSignal.trim();
    const encoded = trimmed.startsWith(SIGNAL_PREFIX)
      ? trimmed.slice(SIGNAL_PREFIX.length)
      : trimmed;

    try {
      return JSON.parse(decodeURIComponent(encoded));
    } catch (error) {
      throw new Error('Failed to decode signal payload');
    }
  }

  isSignal(rawSignal) {
    if (!rawSignal || typeof rawSignal !== 'string') {
      return false;
    }
    return rawSignal.startsWith(SIGNAL_PREFIX) || rawSignal.startsWith('{');
  }
}

export default new SignalingService();
