import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Wallet, Plus, Filter, TrendingUp, TrendingDown, DollarSign, LogOut, User, Trash2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investment', 'Gift', 'Other Income'],
  expense: ['Food', 'Transport', 'Housing', 'Entertainment', 'Healthcare', 'Shopping', 'Utilities', 'Other Expense']
};

// Simple hash function for password hashing (not cryptographically secure - use backend for production)
const hashPassword = (password) => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

// Validate input to prevent XSS
const sanitizeInput = (input) => {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 50);
};

// Safe JSON parse
const safeJsonParse = (json, fallback = null) => {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.error('JSON parse error:', err);
    return fallback;
  }
};

export default function ExpenseTracker() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [transactions, setTransactions] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filters, setFilters] = useState({ type: 'all', category: 'all', startDate: '', endDate: '' });

  const [newTransaction, setNewTransaction] = useState({
    type: 'expense',
    amount: '',
    category: 'Food',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

 useEffect(() => {
  const load = async () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("username");

    if (!token || !user) return;

    setCurrentUser(user);
    setIsLoggedIn(true);

    try {
      const res = await fetch("http://localhost:4000/api/transactions", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to load:", err);
    }
  };

  load();
}, []);



  const saveTransactions = (txns) => {
  if (!currentUser) return;
  localStorage.setItem(`transactions_${currentUser}`, JSON.stringify(txns));
};


 const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) return alert("Enter username and password");

  try {
    // Try login first
    let res = await fetch("http://localhost:4000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: loginForm.username,
        password: loginForm.password
      })
    });

    let data = await res.json();

    if (!res.ok) {
      // If login fails, try signup
      res = await fetch("http://localhost:4000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });
      data = await res.json();

      if (!res.ok) {
        alert("Signup failed: " + (data.error || "Unknown error"));
        return;
      }
    }

    // Save token + username
    if (!data.token || !data.user) {
      alert("Login response missing token or user data");
      console.error("Response:", data);
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.user.username);

    setCurrentUser(data.user.username);
    setIsLoggedIn(true);

  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed: " + (err.message || "Network error - is the backend running?"));
  }
};


  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setTransactions([]);
    setLoginForm({ username: '', password: '' });
  };

  const handleAddTransaction = async () => {
  const token = localStorage.getItem("token");

  if (!newTransaction.amount) return alert("Enter amount");

  const body = {
    type: newTransaction.type,
    amount: parseFloat(newTransaction.amount),
    description: newTransaction.description,
    category: newTransaction.category,
    date: newTransaction.date
  };

  try {
    const res = await fetch("http://localhost:4000/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const created = await res.json();

    if (res.ok) {
      setTransactions(prev => [created, ...prev]);
      setShowAddForm(false);

      setNewTransaction({
        type: "expense",
        amount: "",
        category: "Food",
        description: "",
        date: new Date().toISOString().split("T")[0]
      });
    } else {
      alert(created.error);
    }

  } catch (err) {
    console.error(err);
  }
};


  const handleDeleteTransaction = async (id) => {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`http://localhost:4000/api/transactions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  } catch (err) {
    console.error(err);
  }
};


  const filteredTransactions = transactions.filter(t => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;
    if (filters.category !== 'all' && t.category !== filters.category) return false;
    if (filters.startDate && t.date < filters.startDate) return false;
    if (filters.endDate && t.date > filters.endDate) return false;
    return true;
  });

  const summary = filteredTransactions.reduce((acc, t) => {
    if (t.type === 'income') {
      acc.totalIncome += t.amount;
    } else {
      acc.totalExpense += t.amount;
      acc.byCategory[t.category] = (acc.byCategory[t.category] || 0) + t.amount;
    }
    return acc;
  }, { totalIncome: 0, totalExpense: 0, byCategory: {} });

  const pieData = Object.entries(summary.byCategory).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2))
  }));

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-3 rounded-full">
              <Wallet className="text-white" size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Finance Tracker</h1>
          <p className="text-center text-gray-600 mb-6">Secure login to manage your finances</p>

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                id="username"
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                aria-label="Username input"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                aria-label="Password input"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
              />
            </div>
            <button
              onClick={handleLogin}
              aria-label="Login or sign up button"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Login / Sign Up
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-4">
            New users will be automatically registered
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Wallet className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Finance Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <User size={20} />
              <span className="font-medium">{currentUser}</span>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Logout button"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100">Total Income</span>
              <TrendingUp size={24} />
            </div>
            <div className="text-3xl font-bold">${summary.totalIncome.toFixed(2)}</div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-100">Total Expenses</span>
              <TrendingDown size={24} />
            </div>
            <div className="text-3xl font-bold">${summary.totalExpense.toFixed(2)}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100">Balance</span>
              <DollarSign size={24} />
            </div>
            <div className="text-3xl font-bold">${(summary.totalIncome - summary.totalExpense).toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                aria-label={showAddForm ? 'Close add transaction form' : 'Open add transaction form'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                <span>Add Transaction</span>
              </button>
            </div>

            {showAddForm && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newTransaction.type}
                      onChange={(e) => setNewTransaction({
                        ...newTransaction,
                        type: e.target.value,
                        category: CATEGORIES[e.target.value][0]
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newTransaction.category}
                      onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIES[newTransaction.type].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTransaction}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Transaction
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={18} className="text-gray-600" />
                <span className="font-medium text-gray-700">Filters</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({...filters, type: e.target.value})}
                  aria-label="Filter by transaction type"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  aria-label="Filter by category"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {[...CATEGORIES.income, ...CATEGORIES.expense].map((cat, idx) => (
                    <option key={`${cat}-${idx}`} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  aria-label="Filter start date"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  aria-label="Filter end date"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transactions found. Add your first transaction!
                </div>
              ) : (
                filteredTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {t.type === 'income' ? (
                          <TrendingUp className="text-green-600" size={20} />
                        ) : (
                          <TrendingDown className="text-red-600" size={20} />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{t.category}</div>
                        <div className="text-sm text-gray-500">{t.date}</div>
                        {t.description && <div className="text-sm text-gray-600">{t.description}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-lg font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        aria-label={`Delete transaction for ${t.category}`}
                        title="Delete transaction"
                        className="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Expense Breakdown</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No expense data to display
              </div>
            )}
            <div className="mt-4 space-y-2">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-800">${item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}