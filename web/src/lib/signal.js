const SIGNAL_PREFIX = 'p2pmsg://';

export const toSignalString = (payload) => {
  const serialized = JSON.stringify(payload);
  return `${SIGNAL_PREFIX}${encodeURIComponent(serialized)}`;
};

export const fromSignalString = (rawSignal) => {
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
};
