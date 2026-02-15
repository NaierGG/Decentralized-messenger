import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MESSAGE_STATUS} from '../utils/constants';

const COLORS = {
  incoming: '#1E1C3A',
  outgoing: '#6764F2',
  incomingText: '#E2E8F0',
  outgoingText: '#FFFFFF',
  muted: '#97A2B8'
};

const statusIcon = (status) => {
  if (status === MESSAGE_STATUS.READ) {
    return 'vv';
  }
  if (status === MESSAGE_STATUS.SENT) {
    return 'v';
  }
  if (status === MESSAGE_STATUS.SENDING) {
    return '...';
  }
  if (status === MESSAGE_STATUS.FAILED) {
    return '!';
  }
  return '';
};

const MessageBubble = ({message}) => {
  const isOutgoing = message.direction === 'outgoing';
  return (
    <View style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}>
      <View
        style={[
          styles.bubble,
          isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming
        ]}>
        <Text style={[styles.text, isOutgoing ? styles.textOutgoing : styles.textIncoming]}>
          {message.text}
        </Text>
      </View>

      <View style={[styles.metaRow, isOutgoing ? styles.metaRowOutgoing : styles.metaRowIncoming]}>
        <Text style={styles.metaText}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        {isOutgoing ? <Text style={styles.metaText}>{statusIcon(message.status)}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    maxWidth: '86%',
    marginBottom: 14
  },
  rowOutgoing: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  rowIncoming: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start'
  },
  bubble: {
    borderRadius: 19,
    paddingHorizontal: 13,
    paddingVertical: 10
  },
  bubbleOutgoing: {
    backgroundColor: COLORS.outgoing,
    borderTopRightRadius: 7
  },
  bubbleIncoming: {
    backgroundColor: COLORS.incoming,
    borderTopLeftRadius: 7
  },
  text: {
    fontSize: 14,
    lineHeight: 20
  },
  textOutgoing: {
    color: COLORS.outgoingText
  },
  textIncoming: {
    color: COLORS.incomingText
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaRowOutgoing: {
    justifyContent: 'flex-end'
  },
  metaRowIncoming: {
    justifyContent: 'flex-start'
  },
  metaText: {
    marginHorizontal: 2,
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600'
  }
});

export default MessageBubble;
