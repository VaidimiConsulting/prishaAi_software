# Prisha Interiors — Calculator + AI Design Studio (ek hi app)

Ek `backend/` (Node.js) aur ek `frontend/` (React). Ek server, ek port, ek deploy.

| Page | Address |
|---|---|
| Price Calculator | `/` |
| AI Design Studio | `/studio/` |
| Admin (rates) | `/admin` |

## Computer par chalana
Node.js 18 ya naya chahiye (https://nodejs.org). MySQL chalu hona chahiye (calculator ke liye).

**Windows:** `START-SOFTWARE.bat` par double-click. Pehli baar khud install karta hai, phir browser khulta hai.
**Mac/Linux:** `bash start-software.sh`

Window band mat karna. Browser: http://localhost:3001

**Code badalte waqt (developer mode, hot-reload):** `npm run setup` (ek baar), phir `npm run dev` → http://localhost:5173 (studio: `/studio/`).
Frontend ka code badlo to live/production ke liye `npm run build` dobara chalana padega.

## Settings (`backend/.env`)
Ek hi file me sab hai: MySQL, admin password, email, OpenAI key, Google login. Sample: `backend/.env.example`.
`.env` kisi ko share/upload mat karna.

## Calculator aur Studio kaise jude hain
- Studio me image par **gol tick** dabao → us image par **"Get price estimate"** → calculator khulta hai, pehle page par wo image "Decorative Wall — Your AI Design" card ban jati hai.
- Studio ke sidebar me **Price Calculator** button: seedha calculator.
- Calculator me **"Decorative Wall — Design it with AI"** card: Studio kholta hai.
- Kitchen / Wardrobe / Wooden Door ka poora calculator pehle jaisa hi hai.
- **Decorative Wall ke rates:** `/admin` → category "Decorative Wall (AI design)" → Budget/Premium/Luxury (per sqft = wall length x height). Rate daalne tak is category ka price nahi aata.
- Quote PDF me AI image page 2 par lagti hai, aur admin email me attach hoti hai.

## Live (server par) karna
1. Hosting me Node.js app banao (cPanel: "Setup Node.js App"), root = is folder, startup file = `backend/server.js`.
2. `backend/.env` me asli values; `NODE_ENV=production`.
3. `npm run setup` aur `npm run build` (ya build wala `backend/public` folder sath me hai).
4. HTTPS zaroori hai (Google login, camera, mic ke liye).
5. Google login ke liye Google Console me apna domain "Authorized JavaScript origin" me daalo.
6. Backup: `backend/data/` (AI Studio ke users, history, images) aur MySQL database.

## Dhyan rakhne wali baat
AI Studio public hone par har image banane se aapke OpenAI account se paisa kategi.
