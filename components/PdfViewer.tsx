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
import { PDF_JS_CODE, PDF_WORKER_CODE } from '@/services/pdfEngineBundle';
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
      viewMode,
      page: initialPage,
    });
    webViewRef.current.injectJavaScript(`
      if (window.handleAppMessage) {
        window.handleAppMessage(${msg});
      }
      true;
    `);
  }, [stageMode, sepiaMode, zoomScale, viewMode, initialPage, pdfLoaded]);

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

  // Self-contained 100% offline HTML5 PDF.js / Choral Canvas Reader
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
      margin: 0;
      padding: 0;
      background-color: ${stageMode ? '#05070A' : sepiaMode ? '#FAF5EA' : '#FFFFFF'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background-color 0.25s ease;
      user-select: none;
    }
    #viewport {
      width: 100%;
      height: 100%;
      position: relative;
      overflow-x: hidden;
      overflow-y: ${viewMode === 'scroll' ? 'auto' : 'hidden'};
      -webkit-overflow-scrolling: touch;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #pages-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${viewMode === 'scroll' ? '16px 0 60px 0' : '0'};
      transition: filter 0.25s ease;
    }
    .page-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: ${viewMode === 'scroll' ? '0 auto 24px auto' : 'auto'};
      box-shadow: ${stageMode ? '0 8px 32px rgba(0,0,0,0.8)' : '0 4px 20px rgba(0,0,0,0.15)'};
      border-radius: 8px;
      overflow: hidden;
      background-color: #FFFFFF;
      transition: transform 0.2s ease;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
    }
    .page-tag {
      width: 100%;
      text-align: center;
      padding: 6px 0;
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      background-color: #F8FAFC;
      border-top: 1px solid #E2E8F0;
    }
    /* Touch Navigation Zones (Single Page Mode) */
    .touch-zone {
      position: fixed;
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
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: ${stageMode ? '#F59E0B' : '#0D74CE'};
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      z-index: 50;
      background: rgba(0,0,0,0.08);
      padding: 12px 22px;
      border-radius: 20px;
      pointer-events: none;
    }
  </style>
  <script>
    ${PDF_JS_CODE}
  </script>
  <script>
    try {
      const workerBlob = new Blob([${JSON.stringify(PDF_WORKER_CODE)}], { type: 'application/javascript' });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
    } catch (e) {
      console.warn('PDF.js worker blob initialization error:', e);
    }
  </script>
</head>
<body>
  <div id="viewport">
    <div id="loading-indicator">Opening Sheet Music...</div>
    <div id="pages-container"></div>

    <!-- Touch Navigation Zones (Single Page Mode) -->
    <div id="zone-left" class="touch-zone" onclick="prevPage()"></div>
    <div id="zone-center" class="touch-zone" onclick="toggleControls()"></div>
    <div id="zone-right" class="touch-zone" onclick="nextPage()"></div>
  </div>

  <script>
    let pdfDoc = null;
    let pageNum = ${initialPage};
    let totalPages = 1;
    let currentZoom = ${zoomScale};
    let currentViewMode = '${viewMode}';
    let isStage = ${stageMode};
    let isSepia = ${sepiaMode};
    let pageWrappers = {};
    let scrollTimeout = null;

    function sendRN(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function applyVisualFilters() {
      const container = document.getElementById('pages-container');
      if (!container) return;
      container.className = isStage ? 'stage-mode' : (isSepia ? 'sepia-mode' : '');
      document.body.style.backgroundColor = isStage ? '#05070A' : (isSepia ? '#FAF5EA' : '#FFFFFF');
    }

    async function renderPageCanvas(num) {
      const item = pageWrappers[num];
      if (!item || !pdfDoc || item.rendered) return;

      try {
        const page = await pdfDoc.getPage(num);
        const viewportWidth = window.innerWidth * 0.95;
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        let baseScale = (viewportWidth / unscaledViewport.width);
        baseScale = Math.min(Math.max(baseScale, 0.7), 2.5);
        const finalScale = baseScale * currentZoom;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: finalScale * dpr });

        item.canvas.width = viewport.width;
        item.canvas.height = viewport.height;
        item.canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
        item.canvas.style.height = Math.floor(viewport.height / dpr) + 'px';

        await page.render({
          canvasContext: item.ctx,
          viewport: viewport
        }).promise;

        item.rendered = true;
      } catch (err) {
        console.warn('Preload page error ' + num, err);
      }
    }

    function updateLayout() {
      const viewport = document.getElementById('viewport');
      const container = document.getElementById('pages-container');
      const zones = document.querySelectorAll('.touch-zone');

      if (currentViewMode === 'scroll') {
        viewport.style.overflowY = 'auto';
        viewport.style.overflowX = 'hidden';
        container.style.padding = '16px 0 60px 0';
        zones.forEach(z => z.style.display = 'none');

        for (let p = 1; p <= totalPages; p++) {
          if (pageWrappers[p]) {
            pageWrappers[p].wrapper.style.display = 'flex';
            pageWrappers[p].wrapper.style.margin = '0 auto 24px auto';
            if (pageWrappers[p].tag) pageWrappers[p].tag.style.display = 'block';
          }
        }
      } else {
        viewport.style.overflowY = 'hidden';
        viewport.style.overflowX = 'hidden';
        viewport.scrollTop = 0;
        container.style.padding = '0';
        zones.forEach(z => z.style.display = 'block');

        for (let p = 1; p <= totalPages; p++) {
          if (pageWrappers[p]) {
            pageWrappers[p].wrapper.style.display = (p === pageNum) ? 'flex' : 'none';
            pageWrappers[p].wrapper.style.margin = 'auto';
            if (pageWrappers[p].tag) pageWrappers[p].tag.style.display = 'none';
          }
        }
      }

      applyVisualFilters();
    }

    async function preloadAllPages() {
      const container = document.getElementById('pages-container');
      container.innerHTML = '';
      pageWrappers = {};

      for (let p = 1; p <= totalPages; p++) {
        const wrapper = document.createElement('div');
        wrapper.id = 'page-wrapper-' + p;
        wrapper.className = 'page-wrapper';

        const canvas = document.createElement('canvas');
        canvas.id = 'canvas-' + p;
        wrapper.appendChild(canvas);

        const tag = document.createElement('div');
        tag.className = 'page-tag';
        tag.innerText = 'Page ' + p + ' of ' + totalPages;
        wrapper.appendChild(tag);

        container.appendChild(wrapper);

        pageWrappers[p] = {
          wrapper: wrapper,
          canvas: canvas,
          ctx: canvas.getContext('2d'),
          tag: tag,
          rendered: false,
        };
      }

      updateLayout();

      // Priority render active page so sheet music is instantly readable
      await renderPageCanvas(pageNum);
      const loader = document.getElementById('loading-indicator');
      if (loader) loader.style.display = 'none';

      // Background pre-rendering of all remaining pages for 0ms instantaneous page switching
      for (let p = 1; p <= totalPages; p++) {
        if (p !== pageNum) {
          await renderPageCanvas(p);
        }
      }
    }

    function goToPage(n) {
      if (n < 1 || n > totalPages) return;
      pageNum = n;
      if (currentViewMode === 'scroll') {
        if (pageWrappers[pageNum]) {
          pageWrappers[pageNum].wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        updateLayout();
      }
      sendRN({ type: 'pageChange', page: pageNum, totalPages: totalPages });
    }

    function prevPage() {
      if (currentViewMode === 'scroll') return;
      if (pageNum <= 1) return;
      goToPage(pageNum - 1);
    }

    function nextPage() {
      if (currentViewMode === 'scroll') return;
      if (pageNum >= totalPages) return;
      goToPage(pageNum + 1);
    }

    function toggleControls() {
      sendRN({ type: 'toggleControls' });
    }

    // Scroll position observer to update page indicator during manual scrolling
    const viewportElem = document.getElementById('viewport');
    viewportElem.addEventListener('scroll', function() {
      if (currentViewMode !== 'scroll') return;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function() {
        const vTop = viewportElem.scrollTop;
        const vMid = vTop + (viewportElem.clientHeight / 2);
        let closestPage = pageNum;
        let minDiff = Infinity;

        for (let p = 1; p <= totalPages; p++) {
          const item = pageWrappers[p];
          if (item && item.wrapper) {
            const top = item.wrapper.offsetTop;
            const center = top + (item.wrapper.offsetHeight / 2);
            const diff = Math.abs(vMid - center);
            if (diff < minDiff) {
              minDiff = diff;
              closestPage = p;
            }
          }
        }

        if (closestPage !== pageNum) {
          pageNum = closestPage;
          sendRN({ type: 'pageChange', page: pageNum, totalPages: totalPages });
        }
      }, 60);
    }, { passive: true });

    window.handleAppMessage = function(data) {
      if (data.type === 'updateProps') {
        if (data.stageMode !== undefined) isStage = data.stageMode;
        if (data.sepiaMode !== undefined) isSepia = data.sepiaMode;
        if (data.zoomScale !== undefined && Math.abs(data.zoomScale - currentZoom) > 0.05) {
          currentZoom = data.zoomScale;
          for (let p = 1; p <= totalPages; p++) {
            if (pageWrappers[p]) pageWrappers[p].rendered = false;
          }
          renderPageCanvas(pageNum);
          for (let p = 1; p <= totalPages; p++) {
            if (p !== pageNum) renderPageCanvas(p);
          }
        }
        if (data.viewMode !== undefined && data.viewMode !== currentViewMode) {
          currentViewMode = data.viewMode;
          updateLayout();
          if (currentViewMode === 'scroll' && pageWrappers[pageNum]) {
            pageWrappers[pageNum].wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        if (data.page && data.page !== pageNum && data.page >= 1 && data.page <= totalPages) {
          pageNum = data.page;
          if (currentViewMode === 'scroll' && pageWrappers[pageNum]) {
            pageWrappers[pageNum].wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            updateLayout();
          }
        }
        applyVisualFilters();
      }
    };

    // Offline Choral Score Canvas Fallback Renderer (if data is corrupted)
    function renderOfflineChoralScoreFallback() {
      const loader = document.getElementById('loading-indicator');
      if (loader) loader.style.display = 'none';
      const container = document.getElementById('pages-container');
      container.innerHTML = '';
      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(window.innerWidth * 0.94, 600);
      const h = w * 1.35;

      const wrap = document.createElement('div');
      wrap.className = 'page-wrapper';
      const cvs = document.createElement('canvas');
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      cvs.style.width = w + 'px';
      cvs.style.height = h + 'px';
      wrap.appendChild(cvs);
      container.appendChild(wrap);

      const ctx = cvs.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#0D74CE';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText("${title}", 30, 45);

      ctx.fillStyle = '#475569';
      ctx.font = '12px sans-serif';
      ctx.fillText("${composer}  •  ${voicing}", 30, 68);

      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 80);
      ctx.lineTo(w - 30, 80);
      ctx.stroke();

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
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 14px serif';
        ctx.fillText(sIdx % 2 === 0 ? '𝄞' : '𝄢', 35, top + 24);

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
      });

      totalPages = 1;
      sendRN({ type: 'loaded', totalPages: 1 });
    }

    // Initialize PDF Document
    async function initPdf() {
      const rawData = "${pdfDataUri}";
      if (!rawData) return;

      try {
        if (window.pdfjsLib) {
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
          await preloadAllPages();
        } else {
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
          scrollEnabled={true}
          bounces={false}
          overScrollMode="never"
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
