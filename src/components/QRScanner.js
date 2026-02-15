import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';

const COLORS = {
  surface: '#111022',
  border: 'rgba(255,255,255,0.2)',
  text: '#E2E8F0',
  muted: '#94A3B8',
  primary: '#6764F2'
};

const QRScanner = ({onRead}) => (
  <View style={styles.wrapper}>
    <Text style={styles.title}>QR Scanner</Text>
    <Text style={styles.caption}>Align offer/answer QR in frame</Text>
    <QRCodeScanner
      onRead={({data}) => onRead(data)}
      topContent={<View />}
      bottomContent={<View />}
      fadeIn={false}
      reactivate={false}
      showMarker
      markerStyle={styles.marker}
      cameraStyle={styles.camera}
      containerStyle={styles.container}
    />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  title: {
    paddingHorizontal: 12,
    paddingTop: 10,
    color: COLORS.text,
    fontWeight: '700'
  },
  caption: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    color: COLORS.muted,
    fontSize: 12
  },
  marker: {
    borderColor: COLORS.primary
  },
  camera: {
    height: 260
  },
  container: {
    alignItems: 'stretch'
  }
});

export default QRScanner;
