# Hall Pass

Classroom hall pass check-in/out tracking, built for a whole building to
share one deployment. Each teacher gets their own profile, roster, and
settings — no forking, no per-classroom Firebase project.

React + TypeScript + Vite, deployed to GitHub Pages via GitHub Actions,
backed by a single Firebase Realtime Database.

## How it's organized

- `/` — a picker listing every teacher profile. Tap one to open their menu,
  or "+ Add teacher" to create a new one (no PIN — anyone can add a
  profile from here by design; see `src/firebase/teachers.ts`).
- `/t/:teacherId` — that teacher's menu: Scanner, Dashboard, Analytics,
  Roster Editor.
- Firebase data lives under `teachers/{teacherId}/{roster,students,logs}`,
  plus a top-level `directory/` (the picker's list) and `config/pin` (one
  PIN shared by every teacher's Scanner — for leaving the kiosk and
  changing the student-out limit, not for the picker or editor).

## Setup

### 1. Create a Firebase project

- Go to [console.firebase.google.com](https://console.firebase.google.com)
- Add project → name it anything → click through
- Build → Realtime Database → Create database → choose a region → start in
  test mode
- Project settings → General → Your apps → Add app → Web → register it and
  copy the config values (you'll need these in step 3)

### 2. Set Firebase security rules

- Realtime Database → Rules tab → replace everything with the contents of
  `firebase.rules.json` in this repo → Publish

This keeps the same fully-open read/write the original single-teacher
version used — there's no Firebase Authentication here, PINs are a UI gate
only, not a database-level one. If you want real access control later,
that's the place to add it.

### 3. Add repo secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add one
secret per Firebase config value:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

(No PIN secrets needed — the PIN lives in Firebase now, at `config/pin`,
and defaults to `0244` until you change it from the app.)

### 4. Enable GitHub Pages

- Repo → Settings → Pages → Source → GitHub Actions → Save
- Push to `main` to trigger the first deploy (`.github/workflows/deploy.yml`
  is already set up for this)
- Your app will be live at `https://YOUR-USERNAME.github.io/hallpass/`

If your repo name isn't `hallpass`, update the `basename="/hallpass"` in
`src/App.tsx` and the `base` in `vite.config.ts` to match.

### 5. Add your first teacher

- Open your deployed app → tap "+ Add teacher" → enter a name → you're
  dropped into that teacher's menu automatically
- Roster Editor → "Upload Excel or CSV roster" → export your class roster
  from PowerSchool as Excel → upload → confirm

### 6. Set up an iPad kiosk

- Open Safari on the iPad → go to your app URL
- Tap Share → Add to Home Screen → Add
- Open from the home screen icon (runs fullscreen, no browser bar)
- From the picker, tap the right teacher → Scanner → tap Schedule → set the
  correct day/period
- Students tap their name to check in and out

## Local development

```
npm install
cp .env.example .env    # fill in your Firebase config values
npm run dev
```

## Migrating existing data

If you're standing this up from an existing flat (pre-multi-teacher)
Firebase database — one that still has top-level `roster/`, `students/`,
`logs/` nodes — `scripts/migrate-to-teachers.mjs` will copy that into a new
teacher profile without touching or deleting the original data:

```
npm run migrate -- --id your-id --name "Your Name"
```

It reads your Firebase connection info from `.env` at the repo root.

## Privacy note

Only student first names are stored — no IDs, grades, or identifying
information. Trip data includes timestamps and durations only. All data
lives in your own Firebase project. Consider making this repo private
before sharing the URL with administration.
