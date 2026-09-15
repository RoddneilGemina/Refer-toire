# 🎶 Refer-toire

> **Modern Choral Repertoire Manager & Offline Sheet Music Sync Engine**  
> Built with Expo SDK 57, React Native, Expo Router, Mozilla PDF.js, Supabase, and TypeScript.

---

## 📖 Overview

**Refer-toire** is an offline-first mobile and desktop-web application designed specifically for choirs, choral societies, vocal ensembles, and church music programs.

In choral performance environments, singers frequently rehearse in historic stone cathedrals, sanctuaries, or backstage staging halls with weak or non-existent Wi-Fi and cellular reception. Refer-toire solves this by pairing singers to their ensemble via an **Access Code**. Upon verification against the database, the app syncs the ensemble's repertoire manifest, downloads all high-resolution sheet music PDFs to local storage, and presents scores with an interactive, stage-ready sheet music reader.

---

## ✨ Key Features

### 1. 🔑 Access Code Verification & Instant Sync
- **Code-Based Authentication**: Choristers connect using an ensemble access code without needing personal email accounts or complex logins.
- **Database Verification**: Checks whether the ensemble code exists in the Supabase backend. Invalid codes trigger an immediate alert, while valid codes instantly download and cache all active sheet music files for offline access.
- **Multi-Ensemble Switching**: Seamlessly disconnect or switch between different choirs, seasons, and projects while retaining cached scores.
- **Role-Based Permissions**: Directors and admins can upload new sheet music, create ensembles, and manage repertoire; choristers receive an optimized reading and rehearsal experience.

### 2. 🎼 High-DPI Sheet Music PDF Viewer
- **Mozilla PDF.js Engine**: High-fidelity canvas rendering powered by PDF.js with native `devicePixelRatio` scaling for crisp stave lines, notes, and lyrics.
- **Single Page & Continuous Scroll**: Toggle between standard single-page turns (ideal for music stands) and continuous vertical scrolling.
- **🎭 Concert Hall Stage Mode**: Inverts sheet music to high-contrast white & gold notation on an ultra-dark background (`#05070A`) to eliminate face glare and preserve night vision in dimmed performance halls.
- **☀️ Sepia Warm Tone**: Eye-friendly parchment tone for reduced fatigue during long evening rehearsals.
- **🔍 Precision Zoom Stepper**: Zoom in (+), zoom out (-), and reset (100%) scaling from 60% to 250%.
- **📱 Touch Page Turn Zones**: Tap the left 25% of the score to turn back, tap the right 25% to turn forward, or tap the center to toggle distraction-free fullscreen view.
- **🦶 Bluetooth Foot Pedal & Keyboard Navigation**: Hands-free page turns via Bluetooth foot pedals (PageFlip, AirTurn) or standard keys (`ArrowLeft`/`ArrowRight`, `PageUp`/`PageDown`, `Spacebar`).
- **🌐 Universal Fallback**: Seamless fallback to native browser PDF engines on Web and hardware-accelerated `react-native-webview` on iOS/Android.

### 3. 📝 Conductor's Rehearsal Notes & Voicing
- **Voice Part Highlighting**: Set your personal voice part (e.g., *Soprano 1*, *Alto*, *Tenor 2*, *Bass*) in Settings to see section highlights across scores.
- **Collapsible Notes Drawer**: Access director instructions, translation notes, tempo markings, and key signatures directly within the score viewer.
- **External Export**: One-tap export via `expo-sharing` to open PDFs in **forScore**, **MobileSheets**, AirDrop, or Print.

### 4. 📤 File-First Sheet Music Uploads
- **Streamlined Upload Workflow**: Tapping "+ Upload PDF" immediately launches the native device file chooser (`expo-document-picker`). The upload modal only presents after a PDF is selected.
- **Auto-Title Extraction**: Cleans filename conventions (e.g., `Ave_Verum_Corpus.pdf` → `Ave Verum Corpus`) to minimize typing.
- **Supabase Cloud Storage**: Uploads PDFs to the Supabase `scores` bucket and registers metadata in PostgreSQL with real-time sync to all choristers.

### 5. 📚 Multi-Dimensional Library Sorting
- **Alphabetical Title Sorting**: Clean A–Z and Z–A library views.
- **Composer Sorting**: Smart grouping by composer surname (e.g., Mozart, Fauré, Palestrina, Byrd, Whitacre).
- **Choral Voicings**: Filter by `SATB`, `SATB div.`, `SSAA`, `SSA`, `TTBB`, `TTB`, `SAB`, `Two-Part`, or `Unison`.
- **Liturgical Seasons**: Categorize by `Advent`, `Christmas`, `Epiphany`, `Lent`, `Holy Week`, `Easter`, `Pentecost`, `Ordinary Time`, `Evensong`, `Concert`, or `General`.
- **Instant Search & Favorites**: Real-time filtering across titles, composers, arrangers, tags, and rehearsal bookmarks.

---

## 🛠️ Project Structure

```text
Refer-toire/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar navigation (Repertoire, Programs, Settings)
│   │   ├── index.tsx             # Main repertoire library, sorting, and search
│   │   ├── setlists.tsx          # Concert setlists and performance orders
│   │   └── settings.tsx          # Offline cache manager, voice part preference, sign-out
│   ├── score/
│   │   └── [id].tsx              # Interactive score viewer with Stage Mode & zoom
│   ├── +html.tsx                 # Web static root with preloaded PDF.js runtime
│   ├── login.tsx                 # Access code verification and group creation
│   ├── modal.tsx                 # Ensemble overview modal
│   └── _layout.tsx               # Root layout & RepertoireProvider context
├── components/
│   ├── PdfViewer.tsx             # Universal / Native PDF viewer component
│   ├── PdfViewer.web.tsx         # High-DPI canvas PDF.js viewer for Web
│   ├── PdfViewer.types.ts        # Viewer props, paper tones, and view mode types
│   ├── UploadScoreModal.tsx      # File-first upload dialog with metadata inputs
│   └── Themed.tsx                # Theme-aware layout components
├── context/
│   └── RepertoireContext.tsx     # Global React context for ensemble data and sync
├── services/
│   ├── databaseService.ts        # Supabase PostgreSQL queries and score uploads
│   ├── downloadService.ts        # Offline PDF download and storage management
│   ├── storageService.ts         # Local AsyncStorage persistence
│   ├── instanceService.ts        # Ensemble instance configurations
│   └── choralPdfService.ts       # Authentic choral PDF generator & URI resolver
├── types/
│   └── repertoire.ts             # Domain models (ScoreItem, Instance, Voicing, Season)
├── supabase/
│   └── schema.sql                # PostgreSQL database schema & storage bucket config
├── .env.example                  # Environment variable template
├── app.json                      # Expo SDK 57 configuration
└── package.json                  # Dependencies and build scripts
```

---

## 💻 Getting Started

### Prerequisites
- **Node.js**: v20+ recommended
- **npm** or **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RoddneilGemina/Refer-toire.git
   cd Refer-toire
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env` and configure your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Start the development server**:
   ```bash
   npm run start
   ```

   - Press **`w`** to open in your web browser.
   - Press **`a`** to launch on an Android emulator / device.
   - Press **`i`** to launch on an iOS simulator (macOS required).
   - Scan the QR code with **Expo Go** on your physical mobile device.

---

## 🌿 Branching Strategy

The repository follows a clean two-branch deployment model:

| Branch | Purpose | Tracking |
| :--- | :--- | :--- |
| **`prod`** | Production-ready, stable releases deployed to users. | `origin/prod` |
| **`dev`** | Active feature development and ongoing integration. | `origin/dev` |

To switch branches:
```bash
# Work on development
git checkout dev

# Switch to production
git checkout prod
```

---

## 📦 Tech Stack

- **Platform**: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- **Frontend**: React Native 0.86, React 19, TypeScript
- **Navigation**: Expo Router v4 (`expo-router`)
- **PDF Rendering**: Mozilla PDF.js (`pdfjs-dist` CDN runtime) & `react-native-webview`
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL & Storage)
- **Local Storage**: `@react-native-async-storage/async-storage` & `expo-file-system`
- **Sharing & Device APIs**: `expo-sharing`, `expo-document-picker`
- **Icons**: `@expo/vector-icons` (Ionicons)

---

## 📄 License

This project is licensed under the MIT License.
