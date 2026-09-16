import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkService } from '@/services/networkService';

type BannerStatus = 'hidden' | 'offline' | 'restored';

export default function NetworkStatusBar() {
  const [status, setStatus] = useState<BannerStatus>(() => {
    return NetworkService.isOnline() ? 'hidden' : 'offline';
  });
  const fadeAnim = useRef(new Animated.Value(NetworkService.isOnline() ? 0 : 1)).current;
  const hideTimerRef = useRef<any>(null);
  const prevOnlineRef = useRef<boolean>(NetworkService.isOnline());

  useEffect(() => {
    const unsubscribe = NetworkService.subscribe((isOnline) => {
      const wasOnline = prevOnlineRef.current;
      prevOnlineRef.current = isOnline;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      if (!isOnline) {
        // Lost internet -> pop up grey banner with offline mode
        setStatus('offline');
        fadeAnim.setValue(1);
      } else if (wasOnline === false && isOnline === true) {
        // Regained internet -> turn into green, say "Connection Restored", then fade out
        setStatus('restored');
        fadeAnim.setValue(1);

        hideTimerRef.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              setStatus('hidden');
            }
          });
        }, 2200);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [fadeAnim]);

  if (status === 'hidden') {
    return null;
  }

  const isOffline = status === 'offline';
  const backgroundColor = isOffline ? '#4B5563' : '#16A34A'; // Sleek grey vs vibrant green
  const iconName = isOffline ? 'cloud-offline-outline' : 'checkmark-circle-outline';
  const label = isOffline ? 'Offline Mode' : 'Connection Restored';

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor,
          opacity: fadeAnim,
        },
      ]}>
      <Ionicons name={iconName} size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
      <Text style={styles.bannerText}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
