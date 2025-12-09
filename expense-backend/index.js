// index.js
import express from 'express';
import cors from 'cors';
import sqlite3Import from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite3 = sqlite3Import.verbose();

const DB_FILE = path.join(__dirname, 'db.sqlite');
const MIGRATE_FILE = path.join(__dirname, 'migrate.sql');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ensure DB file exists and run migrations
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) return console.error('DB open error:', err);
  console.log('Connected to sqlite DB');
  if (!dbExists) {
    const sql = fs.readFileSync(MIGRATE_FILE, 'utf8');
    try {
      db.exec(sql);
      console.log('Migrations applied');
    } catch (err) {
      console.error('Migration error:', err);
    }
  }
});

// helper to run SQL with promise
const runAsync = (sql, params = []) => new Promise((res, rej) => {
  db.run(sql, params, function(err) {
    if (err) return rej(err);
    res({ lastID: this.lastID, changes: this.changes });
  });
});
const allAsync = (sql, params = []) => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows)));
});
const getAsync = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => (err ? rej(err) : res(row)));
});

// auth helpers
const createToken = (user) => jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing auth header' });
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid auth header' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// --- AUTH ROUTES ---
// signup
app.post('/auth/signup', async (req, res) => {
  console.log('Signup attempt:', req.body);
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { lastID } = await runAsync('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    const user = await getAsync('SELECT id, username FROM users WHERE id = ?', [lastID]);
    const token = createToken(user);
    res.json({ user, token });
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT') return res.status(400).json({ error: 'username already exists' });
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// login
app.post('/auth/login', async (req, res) => {
  console.log('Login attempt:', req.body);
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const userRow = await getAsync('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (!userRow) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const user = { id: userRow.id, username: userRow.username };
    const token = createToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- TRANSACTIONS CRUD (protected) ---
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, category, type } = req.query;
    let sql = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [userId];
    if (type && type !== 'all') { sql += ' AND type = ?'; params.push(type); }
    if (category && category !== 'all') { sql += ' AND category = ?'; params.push(category); }
    if (from) { sql += ' AND date >= ?'; params.push(from); }
    if (to) { sql += ' AND date <= ?'; params.push(to); }
    sql += ' ORDER BY date DESC, id DESC';
    const rows = await allAsync(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, amount, category, description, date } = req.body;
    if (!type || !amount || !date) return res.status(400).json({ error: 'type, amount and date are required' });
    const { lastID } = await runAsync(
      'INSERT INTO transactions (user_id, type, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, amount, description || '', category || '', date]
    );
    const t = await getAsync('SELECT * FROM transactions WHERE id = ?', [lastID]);
    res.status(201).json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const exists = await getAsync('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    if (!exists) return res.status(404).json({ error: 'Transaction not found' });
    const { type, amount, category, description, date } = req.body;
    await runAsync(
      'UPDATE transactions SET type = ?, amount = ?, description = ?, category = ?, date = ? WHERE id = ?',
      [type, amount, description || '', category || '', date, id]
    );
    const updated = await getAsync('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    await runAsync('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// summary endpoint
app.get('/api/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, category, type } = req.query;
    let where = 'user_id = ?';
    const params = [userId];
    if (type && type !== 'all') { where += ' AND type = ?'; params.push(type); }
    if (category && category !== 'all') { where += ' AND category = ?'; params.push(category); }
    if (from) { where += ' AND date >= ?'; params.push(from); }
    if (to) { where += ' AND date <= ?'; params.push(to); }

    const incomeRow = await getAsync(`SELECT IFNULL(SUM(amount),0) AS totalIncome FROM transactions WHERE ${where} AND type = 'income'`, params);
    const expenseRow = await getAsync(`SELECT IFNULL(SUM(amount),0) AS totalExpense FROM transactions WHERE ${where} AND type = 'expense'`, params);

    // breakdown by category (expenses)
    const breakdown = await allAsync(`SELECT category, IFNULL(SUM(amount),0) AS total FROM transactions WHERE ${where} AND type = 'expense' GROUP BY category`, params);

    res.json({
      totalIncome: incomeRow ? incomeRow.totalIncome : 0,
      totalExpense: expenseRow ? expenseRow.totalExpense : 0,
      byCategory: breakdown.reduce((acc, r) => { acc[r.category||'Uncategorized'] = r.total; return acc; }, {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute summary' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
