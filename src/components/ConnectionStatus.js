import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {CONNECTION_STATES} from '../utils/constants';

const COLORS = {
  connected: '#10B981',
  connecting: '#F59E0B',
  failed: '#EF4444',
  disconnected: '#64748B'
};

const metaByState = (state) => {
  if (state === CONNECTION_STATES.CONNECTED) {
    return {label: 'P2P Connected', color: COLORS.connected};
  }
  if (state === CONNECTION_STATES.CONNECTING) {
    return {label: 'Connecting', color: COLORS.connecting};
  }
  if (state === CONNECTION_STATES.FAILED) {
    return {label: 'Failed', color: COLORS.failed};
  }
  return {label: 'Disconnected', color: COLORS.disconnected};
};

const ConnectionStatus = ({state}) => {
  const meta = metaByState(state);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, {backgroundColor: meta.color}]} />
      <Text style={[styles.label, {color: meta.color}]}>{meta.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 11,
    fontWeight: '700'
  }
});

export default ConnectionStatus;
