import React, {useMemo} from 'react';
import {Image, Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {MESSAGE_STATUS} from '../utils/constants';
import {useTheme} from '../context/ThemeContext';

const formatDuration = (ms) => {
  const totalSec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

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

const MessageBubble = ({
  message,
  currentUserId,
  onReact,
  onOpenReactionPicker
}) => {
  const {colors, typography, spacing} = useTheme();
  const isOutgoing = message.direction === 'outgoing';
  const isAttachment = message.type === 'attachment' && message.attachment;
  const isAudioAttachment = isAttachment && message.attachment.type === 'audio';

  const reactionEntries = useMemo(
    () =>
      Object.entries(message?.reactions || {})
        .filter(([, actors]) => Array.isArray(actors) && actors.length > 0)
        .sort((a, b) => b[1].length - a[1].length),
    [message?.reactions]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          maxWidth: '79%',
          marginBottom: spacing.xs + 2
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
          borderRadius: 20,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 1
        },
        bubbleOutgoing: {
          backgroundColor: colors.primary,
          borderBottomRightRadius: 8,
          borderTopRightRadius: 14
        },
        bubbleIncoming: {
          backgroundColor: colors.surface02,
          borderBottomLeftRadius: 8,
          borderTopLeftRadius: 14,
          borderWidth: 1,
          borderColor: colors.border
        },
        text: {
          ...typography.textStyle(typography.size.sm, typography.weight.regular),
          lineHeight: 19
        },
        textOutgoing: {
          color: colors.onPrimary
        },
        textIncoming: {
          color: colors.textPrimary
        },
        metaRow: {
          marginTop: 2,
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
          ...typography.textStyle(typography.size.xs - 3, typography.weight.semibold),
          color: colors.textMuted
        },
        expiryMeta: {
          marginLeft: spacing.xxs + 1,
          flexDirection: 'row',
          alignItems: 'center'
        },
        expiryText: {
          marginLeft: 2,
          ...typography.textStyle(typography.size.xs - 3, typography.weight.semibold),
          color: colors.textMuted
        },
        attachmentCard: {
          minWidth: 200
        },
        attachmentImage: {
          width: 210,
          height: 144,
          borderRadius: 12,
          backgroundColor: colors.surface03
        },
        attachmentFileRow: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        attachmentAudioCard: {
          minWidth: 210,
          borderRadius: 12,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderWidth: 1,
          borderColor: isOutgoing ? colors.onPrimary : colors.border,
          backgroundColor: isOutgoing ? 'transparent' : colors.surface01
        },
        attachmentAudioTop: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        attachmentAudioDuration: {
          marginLeft: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.semibold),
          color: isOutgoing ? colors.onPrimary : colors.textSecondary
        },
        attachmentFileTextWrap: {
          marginLeft: spacing.xs,
          flex: 1
        },
        attachmentFileName: {
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: isOutgoing ? colors.onPrimary : colors.textPrimary
        },
        attachmentFileUrl: {
          marginTop: 1,
          ...typography.textStyle(typography.size.xs - 1, typography.weight.regular),
          color: isOutgoing ? colors.onPrimary : colors.textSecondary
        },
        attachmentCaption: {
          marginTop: spacing.xxs + 1,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: isOutgoing ? colors.onPrimary : colors.textSecondary
        },
        reactionRow: {
          marginTop: spacing.xxs + 2,
          flexDirection: 'row',
          flexWrap: 'wrap'
        },
        reactionRowOutgoing: {
          justifyContent: 'flex-end'
        },
        reactionRowIncoming: {
          justifyContent: 'flex-start'
        },
        reactionChip: {
          minHeight: 24,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface01,
          paddingVertical: 2,
          paddingHorizontal: spacing.xs - 1,
          marginTop: spacing.xxs,
          marginRight: spacing.xxs,
          flexDirection: 'row',
          alignItems: 'center'
        },
        reactionChipSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.surface02
        },
        reactionEmoji: {
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          marginRight: 4
        },
        reactionCount: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold),
          color: colors.textSecondary
        },
        reactionCountSelected: {
          color: colors.textPrimary
        }
      }),
    [colors, isOutgoing, spacing, typography]
  );

  const onOpenAttachment = () => {
    let url = String(message?.attachment?.url || '').trim();
    if (!url) {
      return;
    }
    if (!/^(https?:|file:|content:|data:)/i.test(url)) {
      url = `file://${url}`;
    }
    Linking.openURL(url).catch(() => null);
  };

  return (
    <View style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}>
      <TouchableOpacity
        activeOpacity={isAttachment ? 0.85 : 0.95}
        onPress={isAttachment ? onOpenAttachment : undefined}
        onLongPress={
          onOpenReactionPicker ? () => onOpenReactionPicker(message) : undefined
        }
        delayLongPress={170}
        style={[
          styles.bubble,
          isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming
        ]}>
        {isAttachment ? (
          <View style={styles.attachmentCard}>
            {message.attachment.type === 'image' ? (
              <Image
                source={{uri: message.attachment.url}}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            ) : isAudioAttachment ? (
              <View style={styles.attachmentAudioCard}>
                <View style={styles.attachmentAudioTop}>
                  <MaterialIcons
                    name="play-circle-filled"
                    size={20}
                    color={isOutgoing ? colors.onPrimary : colors.primary}
                  />
                  <Text numberOfLines={1} style={styles.attachmentFileName}>
                    {message.attachment.name || 'Voice message'}
                  </Text>
                </View>
                <Text style={styles.attachmentAudioDuration}>
                  {formatDuration(message.attachment.durationMs || 0)}
                </Text>
              </View>
            ) : (
              <View style={styles.attachmentFileRow}>
                <MaterialIcons
                  name="insert-drive-file"
                  size={18}
                  color={isOutgoing ? colors.onPrimary : colors.textPrimary}
                />
                <View style={styles.attachmentFileTextWrap}>
                  <Text numberOfLines={1} style={styles.attachmentFileName}>
                    {message.attachment.name || 'Attachment file'}
                  </Text>
                  <Text numberOfLines={1} style={styles.attachmentFileUrl}>
                    {message.attachment.url}
                  </Text>
                </View>
              </View>
            )}
            {message.text ? (
              <Text style={styles.attachmentCaption}>{message.text}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.text, isOutgoing ? styles.textOutgoing : styles.textIncoming]}>
            {message.text}
          </Text>
        )}
      </TouchableOpacity>

      {reactionEntries.length ? (
        <View
          style={[
            styles.reactionRow,
            isOutgoing ? styles.reactionRowOutgoing : styles.reactionRowIncoming
          ]}>
          {reactionEntries.map(([emoji, actors]) => {
            const selected = Boolean(currentUserId && actors.includes(currentUserId));
            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionChip, selected && styles.reactionChipSelected]}
                onPress={onReact ? () => onReact(message.id, emoji) : undefined}
                disabled={!onReact}
                accessibilityRole="button"
                accessibilityLabel={`리액션 ${emoji}`}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text
                  style={[
                    styles.reactionCount,
                    selected && styles.reactionCountSelected
                  ]}>
                  {actors.length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.metaRow, isOutgoing ? styles.metaRowOutgoing : styles.metaRowIncoming]}>
        <Text style={styles.metaText}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        {message.expiresAt ? (
          <View style={styles.expiryMeta}>
            <MaterialIcons name="timer" size={10} color={colors.textMuted} />
            <Text style={styles.expiryText}>자동 삭제</Text>
          </View>
        ) : null}
        {isOutgoing ? <StatusIcon status={message.status} color={colors.textMuted} /> : null}
      </View>
    </View>
  );
};

export default MessageBubble;
