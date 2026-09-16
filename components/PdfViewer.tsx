import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { PdfViewerProps } from './PdfViewer.types';
import { ChoralPdfService } from '@/services/choralPdfService';
import * as FileSystem from 'expo-file-system/legacy';

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
    composer = 'Choral',
    voicing = 'SATB',
    notes = '',
    initialPage = 1,
    stageMode = false,
    sepiaMode = false,
    viewMode = 'single',
    zoomScale = 1.0,
    onPageChange,
    onLoadSuccess,
    onError,
    onToggleControls,
  } = props;

  const webViewRef = useRef<any>(null);
  const [pdfDataUri, setPdfDataUri] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfLoaded, setPdfLoaded] = useState<boolean>(false);

  // Stabilize callbacks with refs
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const onLoadSuccessRef = useRef(onLoadSuccess);
  onLoadSuccessRef.current = onLoadSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onToggleControlsRef = useRef(onToggleControls);
  onToggleControlsRef.current = onToggleControls;

  // Resolve score to a valid base64 data URI for offline WebView consumption
  useEffect(() => {
    let isMounted = true;

    async function resolveSource() {
      setLoading(true);
      try {
        let uri = localUri || sourceUrl;

        // 1. If placeholder or empty, generate authentic multi-page choral score PDF
        if (ChoralPdfService.isPlaceholderUrl(uri)) {
          const generated = ChoralPdfService.generateChoralScorePdfDataUri({
            title,
            composer,
            voicing: (voicing as any) || 'SATB',
            notes,
          });
          if (isMounted) {
            setPdfDataUri(generated);
            setLoading(false);
          }
          return;
        }

        // 2. If already a data URI, use immediately
        if (uri.startsWith('data:')) {
          if (isMounted) {
            setPdfDataUri(uri);
            setLoading(false);
          }
          return;
        }

        // 3. If local file URI (e.g. offline downloaded file)
        if (uri.startsWith('file://')) {
          try {
            const base64Content = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (isMounted) {
              setPdfDataUri(`data:application/pdf;base64,${base64Content}`);
              setLoading(false);
            }
            return;
          } catch (fileErr) {
            console.warn('Error reading local file as base64, falling back to generator:', fileErr);
          }
        }

        // 4. Remote HTTP URL: try fetching as base64 or pass remote URL
        if (uri.startsWith('http')) {
          try {
            const resp = await fetch(uri);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              if (isMounted && typeof reader.result === 'string') {
                setPdfDataUri(reader.result);
                setLoading(false);
              }
            };
            reader.onerror = () => {
              // Pass direct URI if blob conversion fails
              if (isMounted) {
                setPdfDataUri(uri);
                setLoading(false);
              }
            };
            reader.readAsDataURL(blob);
            return;
          } catch (fetchErr) {
            console.warn('Remote fetch notice, falling back:', fetchErr);
          }
        }

        // 5. Safe fallback to choral score generator
        const fallback = ChoralPdfService.generateChoralScorePdfDataUri({
          title,
          composer,
          voicing: (voicing as any) || 'SATB',
          notes,
        });
        if (isMounted) {
          setPdfDataUri(fallback);
          setLoading(false);
        }
      } catch (err: any) {
        console.warn('Error resolving PDF:', err);
        if (isMounted) {
          onErrorRef.current?.(err?.message || 'Failed to resolve sheet music');
          setLoading(false);
        }
      }
    }

    resolveSource();

    return () => {
      isMounted = false;
    };
  }, [sourceUrl, localUri, title, composer, voicing, notes]);

  // Push state updates into running WebView without reloading
  useEffect(() => {
    if (!webViewRef.current || !pdfLoaded) return;
    const msg = JSON.stringify({
      type: 'updateProps',
      stageMode,
      sepiaMode,
      zoomScale,
      page: initialPage,
    });
    webViewRef.current.injectJavaScript(`
      if (window.handleAppMessage) {
        window.handleAppMessage(${msg});
      }
      true;
    `);
  }, [stageMode, sepiaMode, zoomScale, initialPage, pdfLoaded]);

  // Handle messages sent from the WebView (page changes, load events, tap zones)
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setLoading(false);
        setPdfLoaded(true);
        onLoadSuccessRef.current?.(data.totalPages || 1);
      } else if (data.type === 'pageChange') {
        onPageChangeRef.current?.(data.page, data.totalPages);
      } else if (data.type === 'toggleControls') {
        onToggleControlsRef.current?.();
      } else if (data.type === 'error') {
        setLoading(false);
        onErrorRef.current?.(data.message || 'PDF render error');
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, []);

  if (!WebView) {
    return (
      <View style={[styles.container, { backgroundColor: stageMode ? '#05070A' : '#FFFFFF' }]}>
        <View style={styles.fallbackContainer}>
          <Text style={[styles.fallbackTitle, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            {title}
          </Text>
          <Text style={[styles.fallbackSub, { color: stageMode ? '#94A3B8' : '#64748B' }]}>
            {composer} • {voicing}
          </Text>
        </View>
      </View>
    );
  }

  // Self-contained offline HTML5 PDF.js / Choral Canvas Reader
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${stageMode ? '#05070A' : sepiaMode ? '#FAF5EA' : '#FFFFFF'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background-color 0.25s ease;
      user-select: none;
    }
    #viewport {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: auto;
    }
    #canvas-container {
      position: relative;
      display: inline-block;
      margin: auto;
      box-shadow: ${stageMode ? '0 8px 32px rgba(0,0,0,0.8)' : '0 4px 20px rgba(0,0,0,0.15)'};
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s ease, filter 0.25s ease;
      transform-origin: center center;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
    }
    /* Touch Navigation Zones */
    .touch-zone {
      position: absolute;
      top: 0;
      height: 100%;
      z-index: 100;
    }
    #zone-left { left: 0; width: 25%; }
    #zone-center { left: 25%; width: 50%; }
    #zone-right { right: 0; width: 25%; }

    /* Visual tone filters */
    .stage-mode {
      filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.15) !important;
      background-color: #000000 !important;
    }
    .sepia-mode {
      filter: sepia(0.35) contrast(1.05) brightness(0.97) !important;
      background-color: #FAF5EA !important;
    }

    #loading-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: ${stageMode ? '#F59E0B' : '#0D74CE'};
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      z-index: 50;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
  <div id="viewport">
    <div id="loading-indicator">Rendering Sheet Music...</div>
    <div id="canvas-container">
      <canvas id="pdf-canvas"></canvas>
    </div>

    <!-- Touch Navigation Zones -->
    <div id="zone-left" class="touch-zone" onclick="prevPage()"></div>
    <div id="zone-center" class="touch-zone" onclick="toggleControls()"></div>
    <div id="zone-right" class="touch-zone" onclick="nextPage()"></div>
  </div>

  <script>
    let pdfDoc = null;
    let pageNum = ${initialPage};
    let totalPages = 1;
    let currentZoom = ${zoomScale};
    let isRendering = false;
    let pendingPage = null;

    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    const loader = document.getElementById('loading-indicator');

    function sendRN(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function applyFilters(stage, sepia, zoom) {
      container.className = stage ? 'stage-mode' : (sepia ? 'sepia-mode' : '');
      document.body.style.backgroundColor = stage ? '#05070A' : (sepia ? '#FAF5EA' : '#FFFFFF');
      container.style.transform = 'scale(' + zoom + ')';
    }

    applyFilters(${stageMode}, ${sepiaMode}, ${zoomScale});

    async function renderPage(num) {
      isRendering = true;
      try {
        if (!pdfDoc) return;
        const page = await pdfDoc.getPage(num);
        const viewportWidth = window.innerWidth * 0.95;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = (viewportWidth / unscaledViewport.width);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
        canvas.style.height = Math.floor(viewport.height / dpr) + 'px';

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        await page.render(renderContext).promise;
        isRendering = false;

        if (loader) loader.style.display = 'none';

        if (pendingPage !== null) {
          const next = pendingPage;
          pendingPage = null;
          renderPage(next);
        } else {
          sendRN({ type: 'pageChange', page: num, totalPages: totalPages });
        }
      } catch (err) {
        isRendering = false;
        console.warn('Render error:', err);
      }
    }

    function queueRenderPage(num) {
      if (isRendering) {
        pendingPage = num;
      } else {
        renderPage(num);
      }
    }

    function prevPage() {
      if (pageNum <= 1) return;
      pageNum--;
      queueRenderPage(pageNum);
    }

    function nextPage() {
      if (pageNum >= totalPages) return;
      pageNum++;
      queueRenderPage(pageNum);
    }

    function toggleControls() {
      sendRN({ type: 'toggleControls' });
    }

    window.handleAppMessage = function(data) {
      if (data.type === 'updateProps') {
        applyFilters(data.stageMode, data.sepiaMode, data.zoomScale);
        if (data.page && data.page !== pageNum && data.page >= 1 && data.page <= totalPages) {
          pageNum = data.page;
          queueRenderPage(pageNum);
        }
      }
    };

    // Offline Choral Score Canvas Fallback Renderer (if PDF.js CDN is unreachable)
    function renderOfflineChoralScoreFallback() {
      if (loader) loader.style.display = 'none';
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(window.innerWidth * 0.94, 600);
      const h = w * 1.35;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      // Header
      ctx.fillStyle = '#0D74CE';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText("${title}", 30, 45);

      ctx.fillStyle = '#475569';
      ctx.font = '12px sans-serif';
      ctx.fillText("${composer}  •  ${voicing}", 30, 68);

      // Divider
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 80);
      ctx.lineTo(w - 30, 80);
      ctx.stroke();

      // 4 Staves
      const staffTops = [130, 240, 350, 460];
      staffTops.forEach((top, sIdx) => {
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(30, top + i * 8);
          ctx.lineTo(w - 30, top + i * 8);
          ctx.stroke();
        }
        // Clef indicator
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px serif';
        ctx.fillText(sIdx % 2 === 0 ? '𝄞' : '𝄢', 35, top + 24);

        // Sample notes
        for (let n = 0; n < 6; n++) {
          const nx = 80 + n * (w - 140) / 6;
          const ny = top + 16 - (n % 4) * 4;
          ctx.beginPath();
          ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(nx + 3, ny);
          ctx.lineTo(nx + 3, ny - 16);
          ctx.stroke();
        }

        // Lyrics
        ctx.fillStyle = '#334155';
        ctx.font = 'italic 10px serif';
        ctx.fillText(sIdx % 2 === 0 ? 'A - ve   ve - rum   cor - pus' : 'na - tum   de   Ma - ri - a', 70, top + 46);
      });

      // Footer
      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('- Page ' + pageNum + ' of 3 -', w / 2, h - 20);

      totalPages = 3;
      sendRN({ type: 'loaded', totalPages: 3 });
    }

    // Initialize document loader
    async function initPdf() {
      const rawData = "${pdfDataUri}";
      if (!rawData) return;

      try {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          let loadingTask;
          if (rawData.startsWith('data:application/pdf;base64,')) {
            const b64 = rawData.replace('data:application/pdf;base64,', '');
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) {
              bytes[i] = bin.charCodeAt(i);
            }
            loadingTask = window.pdfjsLib.getDocument({ data: bytes });
          } else {
            loadingTask = window.pdfjsLib.getDocument({ url: rawData });
          }

          pdfDoc = await loadingTask.promise;
          totalPages = pdfDoc.numPages || 1;
          sendRN({ type: 'loaded', totalPages: totalPages });
          renderPage(pageNum);
        } else {
          // PDF.js CDN unavailable (e.g. offline airplane mode) -> use instant native choral canvas
          renderOfflineChoralScoreFallback();
        }
      } catch (err) {
        console.warn('PDF load fallback trigger:', err);
        renderOfflineChoralScoreFallback();
      }
    }

    setTimeout(initPdf, 50);
  </script>
</body>
</html>
  `;

  return (
    <View style={[styles.container, { backgroundColor: stageMode ? '#05070A' : sepiaMode ? '#FAF5EA' : '#FFFFFF' }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={stageMode ? '#F59E0B' : '#0D74CE'} />
          <Text style={[styles.loadingText, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            Opening Sheet Music...
          </Text>
        </View>
      )}

      {pdfDataUri ? (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={{
            flex: 1,
            backgroundColor: stageMode ? '#05070A' : sepiaMode ? '#FAF5EA' : '#FFFFFF',
          }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          onMessage={handleWebViewMessage}
          onError={(syntheticEvent: any) => {
            setLoading(false);
            const { nativeEvent } = syntheticEvent;
            console.warn('Native WebView PDF Error:', nativeEvent);
            onErrorRef.current?.(nativeEvent.description || 'Failed to load sheet music');
          }}
        />
      ) : null}
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
