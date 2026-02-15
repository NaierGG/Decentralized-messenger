import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {CONNECTION_STATES} from '../utils/constants';
import {useTheme} from '../context/ThemeContext';

const metaByState = (state, colors) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return {label: '온라인', color: colors.online};
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return {label: '연결 중', color: colors.connecting};
  }
  if (state === CONNECTION_STATES.FAILED) {
    return {label: '오류', color: colors.error};
  }
  return {label: '오프라인', color: colors.offline};
};

const ConnectionStatus = ({state}) => {
  const {colors, typography} = useTheme();
  const meta = metaByState(state, colors);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center'
        },
        dot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          marginRight: 5
        },
        label: {
          ...typography.textStyle(typography.size.xs - 1, typography.weight.semibold)
        }
      }),
    [typography]
  );

  return (
    <View style={styles.row}>
      <View style={[styles.dot, {backgroundColor: meta.color}]} />
      <Text style={[styles.label, {color: meta.color}]}>{meta.label}</Text>
    </View>
  );
};

export default ConnectionStatus;
