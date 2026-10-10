# Expense AI — Hindi-first voice finance assistant

A React + Vite expense tracker with a Gemini-powered Hindi/Hinglish voice parser. Transaction records are stored locally in the browser using IndexedDB/Dexie.

## Updated experience

- Home now opens with a financial overview dashboard.
- A compact animated microphone button sits in the top-right header.
- The developer-only Parser Lab / parse-testing screen has been removed from navigation and its UI code removed.
- Voice modal includes a Gemini-inspired animated listening/thinking orb and Hindi status copy.
- Spoken commands are sent to Gemini first; the local parser is retained as a fallback when the AI cannot understand the command or the API is unavailable.
- The backend parser understands expense, income, financial queries, and person-ledger commands using a structured JSON response.
- Spoken responses prefer an installed Hindi/India voice. Browser voices vary by device, so the same voice cannot be guaranteed on every phone/computer without a hosted text-to-speech provider.

## Run locally

### Frontend

```bash
npm install
```

Create a root `.env` file (never commit it) containing:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Then run:

```bash
npm run dev
```

### Backend

```bash
cd server
npm install
```

Create `server/.env` (never commit it) containing:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Then run:

```bash
npm start
```

The backend listens on `PORT` if the hosting provider sets it, or port `5000` locally.

## Deployment

- Set `VITE_API_BASE_URL` in the frontend hosting environment to the public base URL of the deployed backend, without `/api/parse` at the end.
- Set `GEMINI_API_KEY` only in the backend hosting environment. Do not prefix it with `VITE_` or expose it to the browser.
- Rebuild/redeploy the frontend after changing `VITE_API_BASE_URL`.
- Browser speech recognition and installed speech voices vary by browser/device. Microphone permission and a supported browser are required.

## Important note about data

Expense and income records are stored in this browser's local database. They do not automatically sync between devices. Use the app's backup/restore feature when moving records to another browser/device.
