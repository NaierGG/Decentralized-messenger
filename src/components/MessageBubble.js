import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {MESSAGE_STATUS} from '../utils/constants';
import {useTheme} from '../context/ThemeContext';

const StatusIcon = ({status, color}) => {
  if (status === MESSAGE_STATUS.READ) {
    return <MaterialIcons name="done-all" size={12} color={color} />;
  }
  if (status === MESSAGE_STATUS.SENT) {
    return <MaterialIcons name="check" size={12} color={color} />;
  }
  if (status === MESSAGE_STATUS.SENDING) {
    return <MaterialIcons name="schedule" size={12} color={color} />;
  }
  if (status === MESSAGE_STATUS.FAILED) {
    return <MaterialIcons name="error-outline" size={12} color={color} />;
  }
  return null;
};

const MessageBubble = ({message}) => {
  const {colors, typography, spacing} = useTheme();
  const isOutgoing = message.direction === 'outgoing';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          maxWidth: '86%',
          marginBottom: spacing.sm + 2
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
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 2
        },
        bubbleOutgoing: {
          backgroundColor: colors.primary,
          borderTopRightRadius: 7
        },
        bubbleIncoming: {
          backgroundColor: colors.surface01,
          borderTopLeftRadius: 7,
          borderWidth: 1,
          borderColor: colors.border
        },
        text: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular)
        },
        textOutgoing: {
          color: colors.onPrimary
        },
        textIncoming: {
          color: colors.textPrimary
        },
        metaRow: {
          marginTop: spacing.xxs,
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
          ...typography.textStyle(typography.size.xs - 2, typography.weight.semibold),
          color: colors.textMuted
        }
      }),
    [colors, spacing, typography]
  );

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
        {isOutgoing ? <StatusIcon status={message.status} color={colors.textMuted} /> : null}
      </View>
    </View>
  );
};

export default MessageBubble;
