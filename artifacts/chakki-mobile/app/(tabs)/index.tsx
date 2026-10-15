import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, {
  type WebViewErrorEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import colors from '@/constants/colors';

const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim() ?? '';
const normalizedWebAppUrl = configuredDomain
  ? `${configuredDomain.startsWith('http') ? configuredDomain : `https://${configuredDomain}`}`.replace(/\/+$/, '')
  : '';

// Release builds must load the HTTPS production site. Refuse insecure HTTP
// URLs so an APK cannot silently ship with a non-production/unsafe endpoint.
const webAppUrl = normalizedWebAppUrl.startsWith('https://')
  ? `${normalizedWebAppUrl}/`
  : '';

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function isExternalAction(url: string): boolean {
  return /^(whatsapp:|https:\/\/wa\.me\/|tel:|mailto:)/i.test(url);
}

export default function ChakkiWebShell() {
  const webViewRef = useRef<WebView>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const origin = useMemo(() => getOrigin(webAppUrl), []);

  const reload = useCallback(() => {
    setLoadError(null);
    setIsLoading(true);
    setWebViewKey((key) => key + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (webViewRef.current?.canGoBack()) {
            webViewRef.current.goBack();
            return true;
          }
          return false;
        },
      );

      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    if (!webAppUrl) {
      setLoadError(
        'Production testing domain is missing from this build.',
      );
    }
  }, []);

  const handleNavigation = useCallback(
    (request: WebViewNavigation) => {
      if (isExternalAction(request.url)) {
        Linking.openURL(request.url).catch(() => undefined);
        return false;
      }

      return request.url.startsWith(`${origin}/`) || request.url === origin;
    },
    [origin],
  );

  const handleError = useCallback((event: WebViewErrorEvent) => {
    setIsLoading(false);
    setLoadError(
      event.nativeEvent.description ||
        'Chakki Manager load nahi ho paaya.',
    );
  }, []);

  if (!webAppUrl || loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.errorCard}>
          <View style={styles.iconCircle}>
            <Feather name="wifi-off" size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Chakki Manager</Text>
          <Text style={styles.body}>
            {loadError ||
              'Production testing URL is not configured.'}
          </Text>
          <Text style={styles.hint}>
            Build ko production domain ke saath dobara package karein.
            Localhost ya preview URL supported nahi hai.
          </Text>
          {webAppUrl ? (
            <Pressable
              accessibilityRole="button"
              testID="retry-web-app"
              onPress={reload}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="refresh-cw" size={17} color={colors.primaryForeground} />
              <Text style={styles.retryText}>Dobara try karein</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: webAppUrl }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        onShouldStartLoadWithRequest={handleNavigation}
        onLoadStart={() => {
          setLoadError(null);
          setIsLoading(true);
        }}
        onLoadEnd={() => setIsLoading(false)}
        onError={handleError}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chakki Manager load ho raha hai…</Text>
          </View>
        )}
        startInLoadingState
      />
      {isLoading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  errorCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.light.background,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    marginBottom: 18,
    borderRadius: 30,
    backgroundColor: colors.light.accent,
  },
  title: {
    color: colors.light.foreground,
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    textAlign: 'center',
  },
  body: {
    maxWidth: 320,
    marginTop: 12,
    color: colors.light.foreground,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  hint: {
    maxWidth: 330,
    marginTop: 10,
    color: colors.light.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.primaryForeground,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  pressed: {
    opacity: 0.78,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.light.background,
  },
  loadingText: {
    color: colors.light.mutedForeground,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
});
