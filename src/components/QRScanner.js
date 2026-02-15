import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {useTheme} from '../context/ThemeContext';

const QRScanner = ({onRead}) => {
  const {colors, spacing, typography} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          marginTop: spacing.sm,
          borderRadius: spacing.sm,
          overflow: 'hidden',
          backgroundColor: colors.surface02,
          borderWidth: 1,
          borderColor: colors.border
        },
        title: {
          paddingHorizontal: spacing.sm,
          paddingTop: spacing.xs,
          ...typography.textStyle(typography.size.sm, typography.weight.semibold),
          color: colors.textPrimary
        },
        caption: {
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.xs,
          ...typography.textStyle(typography.size.xs, typography.weight.regular),
          color: colors.textSecondary
        },
        marker: {
          borderColor: colors.primary
        },
        camera: {
          height: 260
        },
        container: {
          alignItems: 'stretch'
        }
      }),
    [colors, spacing, typography]
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>QR 스캐너</Text>
      <Text style={styles.caption}>프레임 안에 연결 코드를 맞춰 주세요</Text>
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
};

export default QRScanner;
