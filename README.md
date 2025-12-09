# Expense Tracker — Local Run Instructions

Requirements
- Node.js (LTS, e.g. 18.x or 20.x)
- npm (comes with Node)
- Git (optional)
- A terminal (Command Prompt, PowerShell, or Git Bash)

Quick start (Windows)
1. Unzip the project and open a terminal.

Backend (API)
2. Open a terminal and go to backend folder:
   cd <path-to-project>\backend
3. Install dependencies:
   npm install
4. (Optional) If you included db.sqlite, skip to step 6.
   To create DB and apply migrations:
   npm run start   # index.js will detect migrate.sql and create db.sqlite automatically
5. If you have `seed.sql` and want seeded data:
   (a) stop server (Ctrl+C)
   (b) run: node run-seed.js   # OR run sqlite3 db.sqlite < seed.sql (if sqlite installed)
6. Server will listen on port 4000 by default:
   http://localhost:4000
   - If you changed port, set PORT env var before starting:
     set PORT=4000
     set JWT_SECRET=your_secret_here

Frontend (UI)
7. Open a second terminal and go to frontend:
   cd <path-to-project>\frontend
8. Install dependencies:
   npm install
9. Set API URL env for local testing (optional — default is http://localhost:4000):
   (Windows PowerShell)
   $env:VITE_API_URL="http://localhost:4000"
   Then run:
   npm run dev
10. Open the app:
    http://localhost:5173

Demo credentials (if seeded)
- Username: demo
- Password: demo123

Notes
- The backend uses SQLite (db.sqlite). If you included db.sqlite, the DB will already contain sample data.
- If interviewer runs into PowerShell execution-policy errors running npm scripts, ask them to use Command Prompt (cmd) instead or run:
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
- If ports 4000 / 5173 are taken, set PORT and VITE_API_URL accordingly.
