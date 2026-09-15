import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { PdfViewerProps } from './PdfViewer.types';
import { ChoralPdfService } from '@/services/choralPdfService';

// On Web, require PdfViewerWeb dynamically
let PdfViewerWeb: React.ComponentType<PdfViewerProps> | null = null;
if (Platform.OS === 'web') {
  try {
    PdfViewerWeb = require('./PdfViewer.web').default;
  } catch (e) {
    console.warn('PdfViewer.web require warning:', e);
  }
}

// On Native (iOS & Android), import react-native-webview
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('react-native-webview require warning:', e);
  }
}

export default function PdfViewer(props: PdfViewerProps) {
  // If running on Web and Web component is available, delegate directly
  if (Platform.OS === 'web' && PdfViewerWeb) {
    return <PdfViewerWeb {...props} />;
  }

  const {
    sourceUrl,
    localUri,
    title = 'Sheet Music',
    composer,
    voicing,
    notes,
    stageMode = false,
    onLoadSuccess,
    onError,
  } = props;

  const [resolvedUri, setResolvedUri] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let uri = localUri || sourceUrl;
    if (ChoralPdfService.isPlaceholderUrl(uri)) {
      uri = ChoralPdfService.generateChoralScorePdfDataUri({
        title,
        composer,
        voicing: (voicing as any) || 'SATB',
        notes,
      });
    }
    setResolvedUri(uri);
  }, [sourceUrl, localUri, title, composer, voicing, notes]);

  // Stage mode CSS injection for native WebView
  const stageModeScript = stageMode
    ? `
      (function() {
        document.documentElement.style.backgroundColor = '#05070A';
        document.body.style.backgroundColor = '#05070A';
        document.body.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.15)';
      })();
      true;
    `
    : `
      (function() {
        document.documentElement.style.backgroundColor = '#FFFFFF';
        document.body.style.backgroundColor = '#FFFFFF';
        document.body.style.filter = 'none';
      })();
      true;
    `;

  if (!WebView) {
    return (
      <View style={[styles.container, { backgroundColor: stageMode ? '#05070A' : '#FFFFFF' }]}>
        <View style={styles.fallbackContainer}>
          <Text style={[styles.fallbackTitle, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            {title}
          </Text>
          <Text style={[styles.fallbackSub, { color: stageMode ? '#94A3B8' : '#64748B' }]}>
            Sheet Music Viewer (Offline Native Mode)
          </Text>
        </View>
      </View>
    );
  }

  // Source URI for Android (Google Docs viewer for remote URLs, direct for iOS or local)
  let webViewSource = { uri: resolvedUri };
  if (
    Platform.OS === 'android' &&
    resolvedUri.startsWith('http') &&
    !resolvedUri.startsWith('data:')
  ) {
    webViewSource = {
      uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(resolvedUri)}`,
    };
  }

  return (
    <View style={[styles.container, { backgroundColor: stageMode ? '#05070A' : '#FFFFFF' }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={stageMode ? '#F59E0B' : '#0D74CE'} />
          <Text style={[styles.loadingText, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            Opening Sheet Music...
          </Text>
        </View>
      )}

      <WebView
        source={webViewSource}
        style={{
          flex: 1,
          backgroundColor: stageMode ? '#05070A' : '#FFFFFF',
        }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        injectedJavaScript={stageModeScript}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          onLoadSuccess?.(props.initialPage || 1);
        }}
        onError={(syntheticEvent: any) => {
          setLoading(false);
          const { nativeEvent } = syntheticEvent;
          console.warn('Native WebView PDF Error:', nativeEvent);
          onError?.(nativeEvent.description || 'Failed to load PDF');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  fallbackSub: {
    fontSize: 14,
  },
});
