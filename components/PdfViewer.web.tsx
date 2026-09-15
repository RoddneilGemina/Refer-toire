import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Ensure PDF.js is loaded in the browser
async function ensurePdfJsLoaded(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="pdf.min.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).pdfjsLib));
      setTimeout(() => resolve((window as any).pdfjsLib || null), 2000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      resolve(lib);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [useNativeEmbed, setUseNativeEmbed] = useState<boolean>(false);
  const [resolvedUri, setResolvedUri] = useState<string>('');
  const [allPagesRendered, setAllPagesRendered] = useState<number[]>([]);

  // 1. Resolve source PDF (use genuine choral PDF if dummy or empty)
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

  // 2. Load PDF Document via PDF.js
  useEffect(() => {
    if (!resolvedUri) return;
    let isCancelled = false;

    async function loadPdf() {
      setLoading(true);
      setRenderError(null);

      try {
        const pdfjs = await ensurePdfJsLoaded();
        if (!pdfjs) {
          // If CDN blocked or offline, fallback to native browser object embed
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
        onLoadSuccess?.(count);
        setLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('PDF.js rendering notice:', err?.message || err);
        // Fallback to browser embed if PDF.js encountered CORS or parser issue
        setUseNativeEmbed(true);
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [resolvedUri, onLoadSuccess]);

  // Keep internal page state synchronized with initialPage prop
  useEffect(() => {
    if (initialPage >= 1 && initialPage <= totalPages) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, totalPages]);

  // 3. Render Current Page in Single-Page Mode
  const renderSinglePage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = containerRef.current
          ? containerRef.current.clientWidth - 40
          : 680;
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calculate auto-fit scale
        let baseScale = (containerWidth / unscaledViewport.width) * 0.95;
        baseScale = Math.min(Math.max(baseScale, 0.7), 2.2);

        const finalScale = baseScale * zoomScale;
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: finalScale * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (e: any) {
        console.warn('Page render error:', e?.message || e);
      }
    },
    [pdfDoc, zoomScale]
  );

  useEffect(() => {
    if (viewMode === 'single' && pdfDoc && !useNativeEmbed) {
      renderSinglePage(currentPage);
    }
  }, [viewMode, pdfDoc, currentPage, zoomScale, renderSinglePage, useNativeEmbed]);

  // 4. Render All Pages in Continuous Scroll Mode
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewMode !== 'scroll' || !pdfDoc || useNativeEmbed) return;
    let isCancelled = false;

    async function renderAllPages() {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      container.innerHTML = ''; // Clear existing

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
    }

    renderAllPages();

    return () => {
      isCancelled = true;
    };
  }, [viewMode, pdfDoc, totalPages, zoomScale, stageMode, sepiaMode, useNativeEmbed]);

  // 5. Bluetooth Foot Pedal and Keyboard Page Turns
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling on Space or Arrow keys
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        goToNextPage();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Home') {
        goToPage(1);
      } else if (e.key === 'End') {
        goToPage(totalPages);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    const valid = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(valid);
    onPageChange?.(valid, totalPages);
  };

  const goToPrevPage = () => {
    goToPage(currentPage - 1);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  // Canvas CSS filter style
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
      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={stageMode ? '#F59E0B' : '#0D74CE'} />
          <Text style={[styles.loadingTitle, { color: stageMode ? '#E2E8F0' : '#1E293B' }]}>
            Loading Sheet Music...
          </Text>
          <Text style={[styles.loadingSubtitle, { color: stageMode ? '#94A3B8' : '#64748B' }]}>
            {title} {composer ? `• ${composer}` : ''}
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

      {/* Single Page Canvas View */}
      {viewMode === 'single' && !loading && !renderError && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 8px 80px',
            maxWidth: '100%',
          }}>
          {/* Main Sheet Music Canvas */}
          <div
            style={{
              position: 'relative',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: stageMode
                ? '0 8px 30px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.2s ease',
              backgroundColor: stageMode ? '#0A0E17' : '#FFFFFF',
            }}>
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                borderRadius: '12px',
                transition: 'filter 0.3s ease',
                ...getCanvasFilter(),
              }}
            />

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
                    backgroundColor: stageMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)',
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
              onClick={onToggleControls}
              title="Toggle Fullscreen Controls"
              style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                width: '50%',
                height: '100%',
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
                    backgroundColor: stageMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)',
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
