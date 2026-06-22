# פריסה ל-Vercel — CarHistoryIL

מדריך לפריסת CarHistoryIL ל-Vercel. הארכיטקטורה: SPA סטטי (Vite/React) + שרת
Express שמוגש כ-**Serverless Function**. ה-API מתחבר ל-`data.gov.il` בזמן ריצה.

---

## תקציר מהיר

```bash
npm i -g vercel       # פעם אחת
npm run web:build     # בונה את ה-SPA ל-public/
vercel                # פריסת preview
vercel --prod         # פריסת production
```

---

## 1. מבנה הפריסה

| חלק | איך נפרס ב-Vercel |
|---|---|
| SPA (web/) | נכסים סטטיים שנבנים ל-`public/` ומוגשים מ-CDN של Vercel |
| API (Express) | Serverless Function אחת ב-`api/index.ts` שעוטפת את `createServer()` |
| נתונים | נמשכים בזמן ריצה מ-`data.gov.il` (אין DB לפרוס) |

`createServer()` ב-[src/api/server.ts](src/api/server.ts) כבר מחזיר אפליקציית
Express — צריך רק לעטוף אותה כ-handler.

---

## 2. קבצים שצריך להוסיף

### `api/index.ts` — עוטף את Express כפונקציה

```ts
import { createServer } from "../src/api/server.js";

// Vercel מעביר (req, res) של Node ל-handler; Express הוא handler תקין כזה.
export default createServer();
```

### `vercel.json` — בנייה ונתב

```json
{
  "buildCommand": "npm run build && npm run web:build",
  "outputDirectory": "public",
  "functions": {
    "api/index.ts": { "maxDuration": 30 }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/health", "destination": "/api/index" }
  ]
}
```

> נתיבים שאינם `/api/*` או `/health` מוגשים כסטטי מתוך `public/` (כולל
> ה-SPA fallback ל-`index.html`), כך שה-client-side routing ממשיך לעבוד.

---

## 3. משתני סביבה (Vercel → Settings → Environment Variables)

כולם **אופציונליים** — בלעדיהם המערכת עובדת על נתוני data.gov.il בלבד.

| משתנה | למה |
|---|---|
| `CACHE_DISABLED=true` | **חובה ב-Serverless** — ראו §4 |
| `LIEN_PROVIDER_ENABLED` / `LIEN_VERIFY_ENDPOINT` / `LIEN_PROVIDER_API_KEY` | חיבור ספק שעבודים מורשה |
| `PRICING_PROVIDER_ENABLED` / `PRICING_ENDPOINT` / `PRICING_PROVIDER_API_KEY` / `PRICING_SOURCE_NAME` | חיבור מחירון מורשה (לוי יצחק וכד') |
| `HTTP_TIMEOUT_MS`, `HTTP_MAX_RETRIES` | כוונון עמידות הרשת |

---

## 4. שני דברים קריטיים בסביבת Serverless

ל-Vercel Functions יש מערכת קבצים **לקריאה בלבד** (פרט ל-`/tmp`) והן מריצות
תהליך קצר-מועד. שתי התאמות נדרשות:

### א. קאש (filesystem)

הקאש כותב כברירת מחדל ל-`.cache/` — לא ניתן ב-Vercel. אפשרויות:
- **הכי פשוט:** הגדירו `CACHE_DISABLED=true` (כל בקשה נמשכת טרי מ-data.gov.il).
- **חלופה:** הצביעו את הקאש ל-`/tmp` עם `CACHE_DIR=/tmp/cache` (נמחק בין
  הפעלות קרות — לא קאש אמיתי, אך לא נכשל).
- **לפרודקשן רציני:** החליפו את ה-cache adapter ב-Redis/Upstash.

> `CACHE_DISABLED` כבר נתמך ב-[src/core/cache.ts](src/core/cache.ts) — מספיק
> להגדיר את משתנה הסביבה, ללא שינוי קוד.

### ב. הפקת PDF (Playwright/Chromium)

נתיב `/api/vehicle/:plate/pdf` משתמש ב-Chromium מלא דרך Playwright — **לא ירוץ**
על פונקציית Vercel רגילה (הבינארי גדול מדי). שלוש אפשרויות:
1. **השאירו מושבת** — ה-SPA ימשיך לעבוד; כפתור ה-PDF פשוט יחזיר שגיאה ידידותית.
2. החליפו ל-`@sparticuz/chromium` + `playwright-core` (גרסה תואמת-serverless),
   והגדירו `maxDuration` גבוה יותר.
3. הריצו את הפקת ה-PDF כשירות נפרד (Render/Railway/Fly) ומשכו משם.

> ה-HTML של הדו"ח (`/api/vehicle/:plate/report`) עובד תמיד — אפשר גם "הדפס
> ל-PDF" מהדפדפן ללא Chromium בצד-שרת.

---

## 5. בנייה מקומית לפני פריסה (שפיות)

```bash
npm install
npm run build         # tsc → dist/  (אמור לעבור נקי)
npm test              # טסטים (ללא רשת)
npm run web:install   # תלויות ה-SPA
npm run web:build     # SPA → public/
```

אם כל אלה עוברים, הפריסה ל-Vercel אמורה להצליח.

---

## 6. פריסה

```bash
vercel          # קישור הפרויקט + preview deployment עם URL לבדיקה
vercel --prod   # production
```

לאחר הפריסה בדקו:
- `https://<your-app>.vercel.app/` — דף הבית של ה-SPA.
- `https://<your-app>.vercel.app/health` — `{ ok: true }`.
- `https://<your-app>.vercel.app/api/vehicle/66304902` — דו"ח JSON.

---

## 7. הערות

- **CI/CD:** חיבור ה-repo ל-Vercel מפעיל פריסה אוטומטית בכל `git push`. ברירת
  המחדל של ענף production היא `main`.
- **דומיין:** Vercel → Settings → Domains כדי לחבר דומיין מותאם.
- **אזורים:** מומלץ אזור קרוב לישראל (למשל `fra1`) לזמני תגובה טובים מול
  data.gov.il — מוגדר ב-`vercel.json` תחת `"regions": ["fra1"]`.
