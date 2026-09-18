import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  // Memoize WebView source so it ONLY changes when pdfDataUri changes.
  // Dynamic updates (page turn, zoom, stage mode) are pushed via injectJavaScript without reloading the WebView!
  const webViewSource = useMemo(() => {
    if (!pdfDataUri) return undefined;
    return { html: buildPdfViewerHtml(pdfDataUri) };
  }, [pdfDataUri]);

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

      {pdfDataUri && webViewSource ? (
        <WebView
          ref={webViewRef}
          source={webViewSource}
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

// Self-contained 100% offline HTML5 PDF.js / Choral Canvas Reader
// Constructed once per score to guarantee zero reloads during rehearsal & performance
function buildPdfViewerHtml(pdfDataUri: string): string {
  return `<!DOCTYPE html>
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
      overflow: hidden;
      background-color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      user-select: none;
      transition: background-color 0.25s ease;
    }
    #viewport {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }

    /* 1. Single Page View Mode: Dedicated Centered Container */
    #single-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      z-index: 10;
    }
    #single-page-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      border-radius: 8px;
      overflow: hidden;
      background-color: #FFFFFF;
      flex-shrink: 0 !important;
    }
    #single-canvas {
      display: block;
      margin: 0 auto;
      flex-shrink: 0 !important;
    }

    /* 2. Continuous Scroll View Mode: Native Block Container (Never compressed by Flexbox) */
    #scroll-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 16px 8px 80px 8px;
      box-sizing: border-box;
      display: none;
      z-index: 10;
    }
    .scroll-page-card {
      position: relative;
      display: block;
      margin: 0 auto 20px auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.16);
      border-radius: 8px;
      overflow: hidden;
      background-color: #FFFFFF;
      flex-shrink: 0 !important;
      box-sizing: border-box;
    }
    .scroll-page-card canvas {
      display: block;
      margin: 0 auto;
      flex-shrink: 0 !important;
    }
    .scroll-page-tag {
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
      color: #0D74CE;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      z-index: 200;
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

    <!-- Single Page Mode Container -->
    <div id="single-container">
      <div id="single-page-wrapper">
        <canvas id="single-canvas"></canvas>
      </div>

      <!-- Touch Navigation Zones -->
      <div id="zone-left" class="touch-zone" onclick="prevPage()"></div>
      <div id="zone-center" class="touch-zone" onclick="toggleControls()"></div>
      <div id="zone-right" class="touch-zone" onclick="nextPage()"></div>
    </div>

    <!-- Continuous Scroll Mode Container -->
    <div id="scroll-container" onclick="handleScrollContainerClick(event)"></div>
  </div>

  <script>
    let pdfDoc = null;
    let pageNum = 1;
    let totalPages = 1;
    let currentZoom = 1.0;
    let currentViewMode = 'single';
    let isStage = false;
    let isSepia = false;
    let scrollCards = {};
    let offscreenPages = {}; // p -> { canvas, displayW, displayH, width, height }
    let scrollTimeout = null;

    function sendRN(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function applyVisualFilters() {
      const viewport = document.getElementById('viewport');
      if (!viewport) return;
      viewport.className = isStage ? 'stage-mode' : (isSepia ? 'sepia-mode' : '');
      document.body.style.backgroundColor = isStage ? '#05070A' : (isSepia ? '#FAF5EA' : '#FFFFFF');
    }

    async function renderPageToOffscreen(p) {
      if (!pdfDoc || offscreenPages[p]) return offscreenPages[p];

      try {
        const page = await pdfDoc.getPage(p);
        const unscaled = page.getViewport({ scale: 1.0 });

        const availW = Math.max(window.innerWidth - 16, 100);
        const availH = Math.max(window.innerHeight - 16, 100);
        const scaleW = (availW / unscaled.width) * 0.98;
        const scaleH = (availH / unscaled.height) * 0.98;

        // In single mode fit both width & height; in scroll mode fit width
        const baseScale = (currentViewMode === 'single') ? Math.min(scaleW, scaleH) : scaleW;
        const finalScale = Math.min(Math.max(baseScale * currentZoom, 0.3), 3.0);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: finalScale * dpr });

        const displayW = Math.floor(viewport.width / dpr);
        const displayH = Math.floor(viewport.height / dpr);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const offCtx = offCanvas.getContext('2d');

        await page.render({
          canvasContext: offCtx,
          viewport: viewport
        }).promise;

        const record = {
          canvas: offCanvas,
          displayW: displayW,
          displayH: displayH,
          width: viewport.width,
          height: viewport.height,
        };

        offscreenPages[p] = record;
        return record;
      } catch (err) {
        console.warn('Error rendering offscreen page ' + p, err);
        return null;
      }
    }

    function blitSinglePage(p) {
      const rec = offscreenPages[p];
      if (!rec) return;

      const wrapper = document.getElementById('single-page-wrapper');
      const canvas = document.getElementById('single-canvas');
      if (!wrapper || !canvas) return;

      canvas.width = rec.width;
      canvas.height = rec.height;
      canvas.style.width = rec.displayW + 'px';
      canvas.style.height = rec.displayH + 'px';

      wrapper.style.width = rec.displayW + 'px';
      wrapper.style.height = rec.displayH + 'px';
      wrapper.style.minHeight = rec.displayH + 'px';

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, rec.width, rec.height);
      ctx.drawImage(rec.canvas, 0, 0);
    }

    function blitScrollCard(p) {
      const rec = offscreenPages[p];
      const cardItem = scrollCards[p];
      if (!rec || !cardItem) return;

      cardItem.canvas.width = rec.width;
      cardItem.canvas.height = rec.height;
      cardItem.canvas.style.width = rec.displayW + 'px';
      cardItem.canvas.style.height = rec.displayH + 'px';

      cardItem.card.style.width = rec.displayW + 'px';
      cardItem.card.style.height = (rec.displayH + 28) + 'px'; // +28px for page tag
      cardItem.card.style.minHeight = (rec.displayH + 28) + 'px';

      const ctx = cardItem.canvas.getContext('2d');
      ctx.clearRect(0, 0, rec.width, rec.height);
      ctx.drawImage(rec.canvas, 0, 0);
    }

    function updateViewMode(mode) {
      currentViewMode = mode;
      const singleContainer = document.getElementById('single-container');
      const scrollContainer = document.getElementById('scroll-container');

      if (currentViewMode === 'scroll') {
        singleContainer.style.display = 'none';
        scrollContainer.style.display = 'block';

        // Ensure all scroll cards have their content blitted
        for (let p = 1; p <= totalPages; p++) {
          if (offscreenPages[p]) {
            blitScrollCard(p);
          }
        }

        // Scroll to active page
        if (scrollCards[pageNum] && scrollCards[pageNum].card) {
          scrollCards[pageNum].card.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      } else {
        scrollContainer.style.display = 'none';
        singleContainer.style.display = 'flex';
        blitSinglePage(pageNum);
      }

      applyVisualFilters();
    }

    async function preloadAllPages() {
      const scrollContainer = document.getElementById('scroll-container');
      scrollContainer.innerHTML = '';
      scrollCards = {};
      offscreenPages = {};

      // 1. Build scroll cards in DOM
      for (let p = 1; p <= totalPages; p++) {
        const card = document.createElement('div');
        card.id = 'scroll-page-' + p;
        card.className = 'scroll-page-card';

        const canvas = document.createElement('canvas');
        canvas.id = 'scroll-canvas-' + p;
        card.appendChild(canvas);

        const tag = document.createElement('div');
        tag.className = 'scroll-page-tag';
        tag.innerText = 'Page ' + p + ' of ' + totalPages;
        card.appendChild(tag);

        scrollContainer.appendChild(card);

        scrollCards[p] = {
          card: card,
          canvas: canvas,
        };
      }

      // 2. Render initial active page immediately
      const rec = await renderPageToOffscreen(pageNum);
      const loader = document.getElementById('loading-indicator');
      if (loader) loader.style.display = 'none';

      blitSinglePage(pageNum);
      blitScrollCard(pageNum);
      updateViewMode(currentViewMode);

      // 3. Pre-render remaining pages in background
      for (let p = 1; p <= totalPages; p++) {
        if (p !== pageNum) {
          await renderPageToOffscreen(p);
          blitScrollCard(p);
        }
      }
    }

    function goToPage(n) {
      if (n < 1 || n > totalPages) return;
      pageNum = n;
      if (currentViewMode === 'scroll') {
        if (scrollCards[pageNum] && scrollCards[pageNum].card) {
          scrollCards[pageNum].card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        blitSinglePage(pageNum);
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

    function handleScrollContainerClick(e) {
      sendRN({ type: 'toggleControls' });
    }

    // Window resize observer
    window.addEventListener('resize', async function() {
      offscreenPages = {};
      await renderPageToOffscreen(pageNum);
      blitSinglePage(pageNum);
      blitScrollCard(pageNum);
      for (let p = 1; p <= totalPages; p++) {
        if (p !== pageNum) {
          await renderPageToOffscreen(p);
          blitScrollCard(p);
        }
      }
    });

    // Scroll position observer in scroll mode
    const scrollContainerElem = document.getElementById('scroll-container');
    scrollContainerElem.addEventListener('scroll', function() {
      if (currentViewMode !== 'scroll') return;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function() {
        const vTop = scrollContainerElem.scrollTop;
        const vMid = vTop + (scrollContainerElem.clientHeight / 2);
        let closestPage = pageNum;
        let minDiff = Infinity;

        for (let p = 1; p <= totalPages; p++) {
          const item = scrollCards[p];
          if (item && item.card) {
            const top = item.card.offsetTop;
            const center = top + (item.card.offsetHeight / 2);
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

    // Handle messages from React Native
    window.handleAppMessage = function(data) {
      try {
        if (data.type === 'updateProps') {
          if (data.stageMode !== undefined) isStage = data.stageMode;
          if (data.sepiaMode !== undefined) isSepia = data.sepiaMode;

          if (data.zoomScale !== undefined && Math.abs(data.zoomScale - currentZoom) > 0.05) {
            currentZoom = data.zoomScale;
            offscreenPages = {};
            renderPageToOffscreen(pageNum).then(() => {
              blitSinglePage(pageNum);
              blitScrollCard(pageNum);
              for (let p = 1; p <= totalPages; p++) {
                if (p !== pageNum) {
                  renderPageToOffscreen(p).then(() => blitScrollCard(p));
                }
              }
            });
          }

          if (data.viewMode !== undefined && data.viewMode !== currentViewMode) {
            updateViewMode(data.viewMode);
          }

          if (data.page && data.page !== pageNum && data.page >= 1 && data.page <= totalPages) {
            goToPage(data.page);
          }

          applyVisualFilters();
        }
      } catch (e) {
        console.warn('handleAppMessage error:', e);
      }
    };

    // Offline Choral Score Canvas Fallback Renderer (if data is corrupted)
    function renderOfflineChoralScoreFallback() {
      const loader = document.getElementById('loading-indicator');
      if (loader) loader.style.display = 'none';
      const singleContainer = document.getElementById('single-container');
      if (singleContainer) singleContainer.style.display = 'flex';
      const scrollContainer = document.getElementById('scroll-container');
      if (scrollContainer) scrollContainer.style.display = 'none';

      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(window.innerWidth * 0.94, 600);
      const h = w * 1.35;

      const wrapper = document.getElementById('single-page-wrapper');
      const cvs = document.getElementById('single-canvas');
      if (wrapper && cvs) {
        wrapper.style.width = w + 'px';
        wrapper.style.height = h + 'px';
        wrapper.style.minHeight = h + 'px';
        cvs.width = w * dpr;
        cvs.height = h * dpr;
        cvs.style.width = w + 'px';
        cvs.style.height = h + 'px';

        const ctx = cvs.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sheet Music', w / 2, 60);

        [130, 210, 290, 370].forEach((top) => {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(30, top + i * 8);
            ctx.lineTo(w - 30, top + i * 8);
            ctx.stroke();
          }
        });
      }

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
</html>`;
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
