import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PdfViewerProps } from './PdfViewer.types';
import { ChoralPdfService } from '@/services/choralPdfService';

import { PDF_JS_CODE, PDF_WORKER_CODE } from '@/services/pdfEngineBundle';

// Ensure PDF.js is loaded in the browser locally and 100% offline
async function ensurePdfJsLoaded(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  try {
    // 1. Evaluate bundled offline PDF.js code directly (zero network / CDN reliance)
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = PDF_JS_CODE;
    document.head.appendChild(script);

    const lib = (window as any).pdfjsLib;
    if (lib) {
      // 2. Set worker to in-memory Blob URL for 100% offline worker thread
      const blob = new Blob([PDF_WORKER_CODE], { type: 'application/javascript' });
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      return lib;
    }
  } catch (e) {
    console.warn('Bundled PDF.js initialization notice:', e);
  }

  return (window as any).pdfjsLib || null;
}

export default function PdfViewerWeb({
  sourceUrl,
  localUri,
  title = 'Sheet Music',
  composer,
  voicing,
  notes,
  initialPage = 1,
  stageMode = false,
  sepiaMode = false,
  viewMode = 'single',
  zoomScale = 1.0,
  onPageChange,
  onLoadSuccess,
  onError,
  onToggleControls,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement>>({});
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const renderVersionRef = useRef<number>(0);

  // Stabilize callbacks to prevent unnecessary effect re-runs
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const onLoadSuccessRef = useRef(onLoadSuccess);
  onLoadSuccessRef.current = onLoadSuccess;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onToggleControlsRef = useRef(onToggleControls);
  onToggleControlsRef.current = onToggleControls;

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [loading, setLoading] = useState<boolean>(true);
  const [preloadProgress, setPreloadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 1,
  });
  const [renderError, setRenderError] = useState<string | null>(null);
  const [useNativeEmbed, setUseNativeEmbed] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: 650,
    height: 900,
  });
  const [windowDimensions, setWindowDimensions] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight : 1000,
  });

  // Track window resize to re-scale sheet music appropriately without reloading document
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: any = null;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setWindowDimensions({ w: window.innerWidth, h: window.innerHeight });
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  // 1. Resolve source PDF data URI deterministically via useMemo
  const resolvedUri = useMemo(() => {
    let uri = localUri || sourceUrl;
    if (ChoralPdfService.isPlaceholderUrl(uri)) {
      uri = ChoralPdfService.generateChoralScorePdfDataUri({
        title,
        composer,
        voicing: (voicing as any) || 'SATB',
        notes,
      });
    }
    return uri || '';
  }, [sourceUrl, localUri, title, composer, voicing, notes]);

  // 2. Load PDF Document via PDF.js ONLY once per resolvedUri
  useEffect(() => {
    if (!resolvedUri) return;
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setRenderError(null);

      try {
        const pdfjs = await ensurePdfJsLoaded();
        if (!pdfjs) {
          setUseNativeEmbed(true);
          setLoading(false);
          return;
        }

        let loadingTask: any;
        if (resolvedUri.startsWith('data:application/pdf;base64,')) {
          const rawBase64 = resolvedUri.replace('data:application/pdf;base64,', '');
          const binaryStr = atob(rawBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          loadingTask = pdfjs.getDocument({ data: bytes });
        } else {
          loadingTask = pdfjs.getDocument({
            url: resolvedUri,
            withCredentials: false,
          });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        const count = doc.numPages || 1;
        setTotalPages(count);
        setPreloadProgress({ current: 0, total: count });
        onLoadSuccessRef.current?.(count);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('PDF.js rendering notice:', err?.message || err);
        setUseNativeEmbed(true);
        setLoading(false);
        onErrorRef.current?.(err?.message || 'Failed to load PDF document');
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [resolvedUri]);

  // Synchronize active page from parent prop without triggering re-load
  useEffect(() => {
    if (initialPage >= 1 && initialPage <= totalPages && initialPage !== currentPageRef.current) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, totalPages]);

  // 3. Preload the ENTIRE document upfront into persistent canvas elements
  // All pages are completely rendered in advance before dismissing the loading state.
  // Once loaded, clicking Next / Prev is an instantaneous 0ms swap of pre-rendered canvases.
  useEffect(() => {
    if (!pdfDoc || useNativeEmbed) return;

    renderVersionRef.current += 1;
    const currentVersion = renderVersionRef.current;
    let isCancelled = false;
    renderedPagesRef.current.clear();

    // Helper: wait for canvas element to be mounted in DOM
    async function waitForCanvas(p: number, maxWaitMs = 2000): Promise<HTMLCanvasElement | null> {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        if (canvasRefs.current[p]) return canvasRefs.current[p];
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return canvasRefs.current[p] || null;
    }

    async function renderPageToCanvas(pageNum: number) {
      if (isCancelled || currentVersion !== renderVersionRef.current) return;
      const canvas = await waitForCanvas(pageNum);
      if (!canvas || isCancelled || currentVersion !== renderVersionRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled || currentVersion !== renderVersionRef.current) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = containerRef.current
          ? Math.max(containerRef.current.clientWidth - 32, 200)
          : 680;
        const containerHeight = containerRef.current
          ? Math.max(containerRef.current.clientHeight - 60, 200)
          : 900;
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calculate auto-fit scale considering BOTH width and height so sheet music is never clipped
        const scaleW = (containerWidth / unscaledViewport.width) * 0.98;
        const scaleH = (containerHeight / unscaledViewport.height) * 0.98;
        let baseScale = Math.min(scaleW, scaleH);
        baseScale = Math.min(Math.max(baseScale, 0.4), 2.5);

        const finalScale = baseScale * zoomScale;
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: finalScale * dpr });

        const displayWidth = Math.floor(viewport.width / dpr);
        const displayHeight = Math.floor(viewport.height / dpr);

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        if (pageNum === 1) {
          setPageSize({ width: displayWidth, height: displayHeight });
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        renderedPagesRef.current.add(pageNum);
      } catch (err: any) {
        console.warn(`Error pre-rendering page ${pageNum}:`, err?.message || err);
      }
    }

    async function preRenderAllPages() {
      // Pre-render Page 1 first to set container layout dimensions immediately
      await renderPageToCanvas(1);
      if (!isCancelled && currentVersion === renderVersionRef.current) {
        setPreloadProgress({ current: 1, total: totalPages });
      }

      // Pre-render all subsequent pages in advance
      for (let p = 2; p <= totalPages; p++) {
        if (isCancelled || currentVersion !== renderVersionRef.current) break;
        await renderPageToCanvas(p);
        if (!isCancelled && currentVersion === renderVersionRef.current) {
          setPreloadProgress({ current: p, total: totalPages });
        }
      }

      // Mark document as completely preloaded
      if (!isCancelled && currentVersion === renderVersionRef.current) {
        setLoading(false);
      }
    }

    preRenderAllPages();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, totalPages, zoomScale, useNativeEmbed, windowDimensions]);

  // 4. Render Continuous Scroll Mode
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfDoc || useNativeEmbed) return;
    let isCancelled = false;

    async function renderAllPagesForScroll() {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      container.innerHTML = '';

      const containerWidth = containerRef.current
        ? containerRef.current.clientWidth - 40
        : 680;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

      for (let p = 1; p <= totalPages; p++) {
        if (isCancelled) break;

        const page = await pdfDoc.getPage(p);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        let baseScale = (containerWidth / unscaledViewport.width) * 0.95;
        baseScale = Math.min(Math.max(baseScale, 0.7), 2.2);
        const finalScale = baseScale * zoomScale;
        const viewport = page.getViewport({ scale: finalScale * dpr });

        const pageWrapper = document.createElement('div');
        pageWrapper.dataset.page = String(p);
        pageWrapper.id = `web-pdf-page-${p}`;
        pageWrapper.style.margin = '16px 0';
        pageWrapper.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
        pageWrapper.style.borderRadius = '8px';
        pageWrapper.style.overflow = 'hidden';
        pageWrapper.style.position = 'relative';

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        canvas.style.display = 'block';

        if (stageMode) {
          canvas.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.15)';
        } else if (sepiaMode) {
          canvas.style.filter = 'sepia(0.35) contrast(1.05) brightness(0.97)';
        }

        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }

      // Scroll to initial page if specified
      if (initialPage > 1 && !isCancelled) {
        const targetEl = container.querySelector(`[data-page="${initialPage}"]`) as HTMLElement;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    renderAllPagesForScroll();

    return () => {
      isCancelled = true;
    };
  }, [viewMode, pdfDoc, totalPages, zoomScale, stageMode, sepiaMode, useNativeEmbed, initialPage]);

  // Track active page during continuous vertical scrolling
  useEffect(() => {
    if (viewMode !== 'scroll' || !containerRef.current) return;
    const container = containerRef.current;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const pageEls = container.querySelectorAll('[data-page]');
        const scrollThreshold = container.scrollTop + container.clientHeight * 0.35;
        let detectedPage = 1;

        pageEls.forEach((el: any) => {
          const pageNum = parseInt(el.dataset.page || '1', 10);
          if (el.offsetTop <= scrollThreshold) {
            detectedPage = pageNum;
          }
        });

        if (detectedPage !== currentPageRef.current) {
          setCurrentPage(detectedPage);
          onPageChangeRef.current?.(detectedPage, totalPagesRef.current);
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  // 5. Bluetooth Foot Pedal and Keyboard Page Turns
  const goToPage = useCallback((page: number) => {
    const valid = Math.min(Math.max(1, page), totalPagesRef.current);
    if (valid !== currentPageRef.current) {
      setCurrentPage(valid);
      onPageChangeRef.current?.(valid, totalPagesRef.current);
    }
  }, []);

  const goToPrevPage = useCallback(() => {
    goToPage(currentPageRef.current - 1);
  }, [goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(currentPageRef.current + 1);
  }, [goToPage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        goToPage(currentPageRef.current + 1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        goToPage(currentPageRef.current - 1);
      } else if (e.key === 'Home') {
        goToPage(1);
      } else if (e.key === 'End') {
        goToPage(totalPagesRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPage]);

  // Canvas CSS filter style (instant GPU accelerated inversion, no re-render needed)
  const getCanvasFilter = () => {
    if (stageMode) {
      return {
        filter: 'invert(1) hue-rotate(180deg) brightness(0.95) contrast(1.15)',
        backgroundColor: '#000000',
      };
    }
    if (sepiaMode) {
      return {
        filter: 'sepia(0.35) contrast(1.05) brightness(0.97)',
        backgroundColor: '#FAF5EA',
      };
    }
    return {
      filter: 'none',
      backgroundColor: '#FFFFFF',
    };
  };

  // 6. Native Browser Object / Iframe Embed Fallback
  if (useNativeEmbed) {
    return (
      <View style={[styles.container, { backgroundColor: stageMode ? '#05070A' : '#F1F5F9' }]}>
        <View style={styles.nativeEmbedHeader}>
          <Text style={[styles.nativeEmbedText, { color: stageMode ? '#94A3B8' : '#475569' }]}>
            Viewing via Native Browser PDF Engine
          </Text>
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => setUseNativeEmbed(false)}>
            <Ionicons name="sparkles-outline" size={14} color="#0D74CE" />
            <Text style={styles.switchModeBtnText}>Try High-Res Canvas</Text>
          </TouchableOpacity>
        </View>

        <div style={{ flex: 1, width: '100%', height: '100%' }}>
          <object
            data={resolvedUri}
            type="application/pdf"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              filter: stageMode
                ? 'invert(0.9) hue-rotate(180deg) contrast(1.1)'
                : 'none',
            }}>
            <iframe
              src={resolvedUri}
              title={title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />
          </object>
        </div>
      </View>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        overflow: 'auto',
        backgroundColor: stageMode ? '#05070A' : '#F8FAFC',
        transition: 'background-color 0.25s ease',
      }}>
      {/* Pre-loading Full Document Overlay */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={stageMode ? '#F59E0B' : '#0D74CE'} />
          <Text style={[styles.loadingTitle, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            Pre-loading Sheet Music...
          </Text>
          <Text style={[styles.loadingSubtitle, { color: stageMode ? '#94A3B8' : '#64748B' }]}>
            {preloadProgress.total > 1
              ? `Buffering page ${preloadProgress.current} of ${preloadProgress.total}`
              : title}
          </Text>
        </View>
      )}

      {/* Render Error */}
      {renderError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={36} color="#EF4444" />
          <Text style={styles.errorTitle}>Could Not Render PDF</Text>
          <Text style={styles.errorSub}>{renderError}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => setUseNativeEmbed(true)}>
            <Text style={styles.errorRetryText}>Open with Browser PDF Engine</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single Page Mode: GPU Texture-Preserved Layered Canvas Stack */}
      {/* ALL pages are already rendered in advance and stay resident in GPU memory */}
      {/* Page turning is a 0ms instantaneous cut without layout shifts, crossfades, or flickers */}
      {viewMode === 'single' && !renderError && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 8px 80px',
            maxWidth: '100%',
            opacity: loading ? 0 : 1,
            transition: 'opacity 0.2s ease',
          }}>
          {/* Main Sheet Music Stack Container */}
          <div
            style={{
              position: 'relative',
              width: `${pageSize.width}px`,
              height: `${pageSize.height}px`,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: stageMode
                ? '0 8px 30px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.06)',
              backgroundColor: stageMode ? '#0A0E17' : '#FFFFFF',
            }}>
            {/* Preloaded Page Canvases: All exist permanently in DOM */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const isActive = p === currentPage;

              return (
                <div
                  key={p}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isActive ? 1 : 0,
                    visibility: isActive ? 'visible' : 'hidden',
                    pointerEvents: isActive ? 'auto' : 'none',
                    zIndex: isActive ? 2 : 1,
                  }}>
                  <canvas
                    ref={(el) => {
                      if (el) canvasRefs.current[p] = el;
                    }}
                    style={{
                      display: 'block',
                      borderRadius: '12px',
                      ...getCanvasFilter(),
                    }}
                  />
                </div>
              );
            })}

            {/* Left Touch / Click Zone: Previous Page */}
            <div
              onClick={goToPrevPage}
              title="Previous Page (Left Arrow / Foot Pedal)"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '25%',
                height: '100%',
                zIndex: 10,
                cursor: currentPage > 1 ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: '14px',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                background:
                  'linear-gradient(to right, rgba(0,0,0,0.08), transparent)',
              }}
              onMouseEnter={(e) => {
                if (currentPage > 1) e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0';
              }}>
              {currentPage > 1 && (
                <div
                  style={{
                    backgroundColor: stageMode
                      ? 'rgba(30, 41, 59, 0.85)'
                      : 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}>
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={stageMode ? '#F8FAFC' : '#1E293B'}
                  />
                </div>
              )}
            </div>

            {/* Center Touch / Click Zone: Toggle Controls */}
            <div
              onClick={() => onToggleControlsRef.current?.()}
              title="Toggle Fullscreen Controls"
              style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                width: '50%',
                height: '100%',
                zIndex: 10,
                cursor: 'default',
              }}
            />

            {/* Right Touch / Click Zone: Next Page */}
            <div
              onClick={goToNextPage}
              title="Next Page (Right Arrow / Foot Pedal)"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '25%',
                height: '100%',
                zIndex: 10,
                cursor: currentPage < totalPages ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '14px',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                background:
                  'linear-gradient(to left, rgba(0,0,0,0.08), transparent)',
              }}
              onMouseEnter={(e) => {
                if (currentPage < totalPages) e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0';
              }}>
              {currentPage < totalPages && (
                <div
                  style={{
                    backgroundColor: stageMode
                      ? 'rgba(30, 41, 59, 0.85)'
                      : 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={stageMode ? '#F8FAFC' : '#1E293B'}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Continuous Scroll View */}
      {viewMode === 'scroll' && !loading && !renderError && (
        <div
          ref={scrollContainerRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 8px 80px',
            width: '100%',
          }}
        />
      )}
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 400,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  loadingSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 350,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  errorRetryBtn: {
    backgroundColor: '#0D74CE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  errorRetryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  nativeEmbedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  nativeEmbedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(13, 116, 206, 0.1)',
  },
  switchModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D74CE',
  },
});
