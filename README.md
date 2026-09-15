# 🎶 Refer-toire

> **Choir Repertoire & Offline Sheet Music Sync Engine**  
> Built with Expo SDK 57, React Native, Expo Router, and TypeScript.

---

## 📖 Overview

**Refer-toire** is an offline-first mobile application designed specifically for choirs, choral societies, vocal ensembles, and church music programs. 

In choral environments, singers often rehearse in historic churches, cathedrals, or performance halls with weak or nonexistent cellular and Wi-Fi signals. Refer-toire solves this by tying singers to their ensemble via an **Access Code**. Upon entering the code, the app connects to that choir's repertoire instance, automatically downloads all sheet music PDFs to the device's local storage, and organizes the scores automatically by title, composer, voicing, and liturgical season.

---

## ✨ Core Features

### 1. 🔑 Access Code Authentication
- Music directors or choral librarians issue a simple code (e.g., `CANTATE-2026`, `CHORALE-LENT`).
- Entering the code authenticates the singer into that specific ensemble instance.
- Singers can easily switch between multiple choirs or seasons without losing offline data.

### 2. 📥 Automated Local PDF Sync Engine
- Built on modern `expo-file-system` and `@react-native-async-storage/async-storage`.
- Scores are downloaded directly to local storage (`FileSystem.documentDirectory`) upon login.
- Real-time download progress tracker (`X of Y scores synced`).
- Offline cache verification ensures scores are only downloaded when new or modified.
- Guaranteed 100% offline access in rehearsals and concert stages.

### 3. 🎼 Multi-Dimensional Automatic Sorting & Filtering
- **Title (A–Z / Z–A)**: Standard alphabetical choir library order.
- **Composer**: Smart sorting by composer surname (e.g. Mozart, Fauré, Palestrina, Byrd, Whitacre).
- **Voicing**: Auto-grouped by choral voicing:
  - `SATB`, `SATB div.`
  - `SSAA`, `SSA`
  - `TTBB`, `TTB`
  - `SAB`, `Two-Part`, `Unison`, `Solo & Choir`
- **Liturgical Season / Occasion**:
  - `Advent`, `Christmas`, `Epiphany`, `Lent`, `Holy Week`, `Easter`, `Pentecost`, `Ordinary Time`, `Evensong`, `Concert`, `General`
- **Voice Section Preference**: Set your voice part (e.g. *Soprano 1*, *Tenor 2*) to highlight relevant lines.
- **Instant Search**: Real-time filtering across titles, composers, arrangers, tags, and rehearsal notes.
- **Favorites / Rehearsal Bookmarks**: Star pieces currently under active rehearsal.

### 4. 📂 Concert Programs & Setlists
- Dedicated **Programs** tab containing ordered service folders and performance sequences (e.g. *Choral Evensong & Benediction*, *Tenebrae Good Friday Service*, *Spring Festival Masterworks*).
- Singers can step through pieces in the exact concert order during performances.

### 5. 📖 Stage-Ready Sheet Music Reader
- **Stage Mode**: Ultra-low-glare, high-contrast dark theme optimized for choir folders and dimmed stage lighting.
- **Conductor's Rehearsal Notes**: Displays tempo, key signature, translation, and specific director instructions.
- **External Export / Sharing**: One-tap export via `expo-sharing` to open scores in **forScore**, **MobileSheets**, AirDrop, or Print.

### 6. 💾 Storage Management
- Real-time disk space usage calculation.
- One-tap "Re-sync All" to fetch new additions from the director.
- Cache purge controls.

---

## 🚀 Quick Start & Testing

### Demo Access Codes
The app includes pre-configured choir instances with realistic choral repertoire for instant testing:

| Code | Ensemble Name | Program / Season | Scores Count |
| :--- | :--- | :--- | :--- |
| **`CANTATE-2026`** | **Cathedral Chamber Choir** | Season 2026 Masterworks & Evensong | 8 scores (Mozart, Fauré, Palestrina, Victoria, Whitacre, Stanford, Byrd, Tallis) |
| **`CHORALE-LENT`** | **St. Cecilia Chorale** | Lent, Holy Week & Tenebrae | 3 scores (Allegri *Miserere*, Lotti *Crucifixus*, Purcell) |
| **`VOICES-SPRING`** | **Vox Chamber Ensemble** | Spring Madrigals & Partsongs | 2 scores (Morley, Gibbons) |

*You can also enter any custom code matching the `[NAME-YEAR]` pattern (e.g. `CHORALE-2026`) to generate a new instance.*

---

## 🛠️ Project Structure

```text
Refer-toire/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab bar navigation (Repertoire, Programs, Ensemble)
│   │   ├── index.tsx        # Library screen with automatic sorting & search
│   │   ├── setlists.tsx     # Concert setlists & performance orders
│   │   └── settings.tsx     # Offline storage manager & choir profile
│   ├── (auth)/
│   ├── login.tsx            # Access code sign-in & demo choir selector
│   ├── score/[id].tsx       # Score viewer with Stage Mode & forScore export
│   ├── modal.tsx            # Information & instance overview modal
│   └── _layout.tsx          # Root layout & RepertoireProvider wrapper
├── components/
│   ├── Themed.tsx           # Dark/Light theme-aware components
│   └── useColorScheme.ts    # Color scheme detector
├── constants/
│   └── Colors.ts            # Choral palette, voicing badges, stage theme
├── context/
│   └── RepertoireContext.tsx # Unified React context for choir state & sync
├── services/
│   ├── instanceService.ts   # Choir instance metadata & demo instances
│   ├── downloadService.ts   # expo-file-system background PDF download manager
│   └── storageService.ts    # AsyncStorage persistence engine
├── types/
│   └── repertoire.ts        # TypeScript domain models
├── utils/
│   └── sorting.ts           # Multi-criterion sorting & filtering engine
├── app.json                 # Expo SDK 57 configuration
└── package.json             # Dependencies
```

---

## 💻 Running the App

### Prerequisites
- Node.js (v20+ recommended, v22 supported)
- npm or yarn

### Installation
```bash
npm install
```

### Start Development Server
```bash
npx expo start
```

- Press **`a`** to open on an Android emulator or connected device.
- Press **`i`** to open on iOS simulator (macOS required).
- Press **`w`** to open on the web browser.
- Scan the QR code with the **Expo Go** app on your physical mobile device.

---

## 📦 Tech Stack

- **Framework**: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- **Core**: React Native 0.86, React 19
- **Navigation**: Expo Router v4 (`expo-router`)
- **File System**: `expo-file-system` (modern `Paths`, `Directory`, `File` API)
- **Local Storage**: `@react-native-async-storage/async-storage`
- **Sharing**: `expo-sharing` (forScore / MobileSheets integration)
- **Icons**: `@expo/vector-icons` (Ionicons)
- **Language**: TypeScript 5.8+

---

## 📄 License
MIT License.
