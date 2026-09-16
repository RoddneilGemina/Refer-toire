export type ViewMode = 'single' | 'scroll';

export type PaperTone = 'white' | 'sepia' | 'stage';

export interface PdfViewerProps {
  sourceUrl: string;
  localUri?: string;
  title?: string;
  composer?: string;
  voicing?: string;
  notes?: string;
  initialPage?: number;
  stageMode?: boolean; // When true, invert score to high contrast dark mode
  sepiaMode?: boolean; // When true, warm parchment tone
  viewMode?: ViewMode; // 'single' page or continuous 'scroll'
  zoomScale?: number; // Zoom multiplier (e.g. 1.0, 1.25, 1.5)
  onPageChange?: (page: number, totalPages: number) => void;
  onLoadSuccess?: (totalPages: number) => void;
  onError?: (errorMessage: string) => void;
  onToggleControls?: () => void;
}

export interface PdfDocumentInfo {
  numPages: number;
  fingerprint?: string;
}
