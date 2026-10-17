const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moneymanager';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection with Auto-reconnect
let isDbConnected = false;
mongoose.connect(MONGODB_URI)
  .then(() => {
    isDbConnected = true;
    console.log('✅ Connected to MongoDB successfully!');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    isDbConnected = false;
  });

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.warn('⚠️ MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  console.log('✅ MongoDB reconnected.');
});

// Helper: Format Date to YYYY-MM
function getMonthYearStr(date) {
  const d = date ? new Date(date) : new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}`;
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & Status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    databaseConnected: isDbConnected,
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  });
});

// 2. Get Transactions (with filtering)
app.get('/api/transactions', async (req, res) => {
  try {
    const { month, type, category, search, limit = 100 } = req.query;
    const filter = {};

    if (month && month !== 'all') {
      filter.monthYear = month;
    }
    if (type && ['income', 'expense'].includes(type)) {
      filter.type = type;
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (search && search.trim()) {
      filter.$or = [
        { notes: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
        { paymentMode: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const transactions = await Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
  }
});

// 3. Create Transaction
app.post('/api/transactions', async (req, res) => {
  try {
    let { type, amount, category, paymentMode, date, notes } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be either "income" or "expense"' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const txDate = date ? new Date(date) : new Date();
    const monthYear = getMonthYearStr(txDate);

    const transaction = new Transaction({
      type,
      amount: numAmount,
      category: category.trim(),
      paymentMode: paymentMode || 'UPI',
      date: txDate,
      notes: notes ? notes.trim() : '',
      monthYear
    });

    const saved = await transaction.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to create transaction', error: error.message });
  }
});

// 4. Update Transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, paymentMode, date, notes } = req.body;

    const updateData = {};
    if (type && ['income', 'expense'].includes(type)) updateData.type = type;
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
      }
      updateData.amount = numAmount;
    }
    if (category) updateData.category = category.trim();
    if (paymentMode) updateData.paymentMode = paymentMode;
    if (notes !== undefined) updateData.notes = notes.trim();
    if (date) {
      const txDate = new Date(date);
      updateData.date = txDate;
      updateData.monthYear = getMonthYearStr(txDate);
    }

    const updated = await Transaction.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to update transaction', error: error.message });
  }
});

// 5. Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Transaction.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, message: 'Transaction deleted successfully', data: deleted });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to delete transaction', error: error.message });
  }
});

// 6. Summary & Analytics (Key Requirement: Monthly Balance, Realtime Deduction)
app.get('/api/summary', async (req, res) => {
  try {
    const currentMonth = getMonthYearStr();
    const targetMonth = req.query.month || currentMonth;

    // Filter for the chosen month (or all)
    const matchStage = targetMonth === 'all' ? {} : { monthYear: targetMonth };

    const transactions = await Transaction.find(matchStage).sort({ date: 1 });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = { income: {}, expense: {} };
    const paymentModeTotals = {};
    const dailySpend = {};

    transactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
        categoryTotals.income[t.category] = (categoryTotals.income[t.category] || 0) + amt;
      } else if (t.type === 'expense') {
        totalExpense += amt;
        categoryTotals.expense[t.category] = (categoryTotals.expense[t.category] || 0) + amt;

        // Daily spending calculation
        const dayStr = new Date(t.date).toISOString().slice(0, 10);
        dailySpend[dayStr] = (dailySpend[dayStr] || 0) + amt;
      }

      // Payment mode breakdown
      paymentModeTotals[t.paymentMode] = (paymentModeTotals[t.paymentMode] || 0) + amt;
    });

    const balance = totalIncome - totalExpense;
    const spentPercentage = totalIncome > 0 ? Math.min(Math.round((totalExpense / totalIncome) * 100), 100) : 0;
    const remainingPercentage = totalIncome > 0 ? Math.max(Math.round((balance / totalIncome) * 100), 0) : 0;

    // Calculate days remaining in the target month (if it's the current month)
    const now = new Date();
    const [yStr, mStr] = targetMonth.split('-');
    const targetYear = parseInt(yStr, 10);
    const targetMonthNum = parseInt(mStr, 10);
    const daysInMonth = new Date(targetYear, targetMonthNum, 0).getDate();

    let daysLeft = daysInMonth;
    let safeDailyAllowance = 0;
    if (targetMonth === currentMonth) {
      daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
      if (balance > 0) {
        safeDailyAllowance = Math.round(balance / daysLeft);
      }
    } else {
      daysLeft = 0;
    }

    // Available Distinct Months list for month-switch selector
    const distinctMonths = await Transaction.distinct('monthYear');
    if (!distinctMonths.includes(currentMonth)) {
      distinctMonths.push(currentMonth);
    }
    distinctMonths.sort().reverse();

    res.json({
      success: true,
      data: {
        month: targetMonth,
        isCurrentMonth: targetMonth === currentMonth,
        totalIncome,
        totalExpense,
        balance,
        spentPercentage,
        remainingPercentage,
        daysInMonth,
        daysLeft,
        safeDailyAllowance,
        categoryTotals,
        paymentModeTotals,
        dailySpend,
        transactionCount: transactions.length,
        availableMonths: distinctMonths
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ success: false, message: 'Failed to generate summary', error: error.message });
  }
});

// 7. Get Available Months list
app.get('/api/months', async (req, res) => {
  try {
    const currentMonth = getMonthYearStr();
    const months = await Transaction.distinct('monthYear');
    if (!months.includes(currentMonth)) {
      months.push(currentMonth);
    }
    months.sort().reverse();
    res.json({ success: true, months });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch months', error: error.message });
  }
});

// 8. Export Transactions to CSV
app.get('/api/export/csv', async (req, res) => {
  try {
    const { month } = req.query;
    const filter = month && month !== 'all' ? { monthYear: month } : {};
    const transactions = await Transaction.find(filter).sort({ date: -1 });

    let csv = 'ID,Date,Type,Category,Amount(INR),PaymentMode,Notes,MonthYear\n';
    transactions.forEach(t => {
      const dStr = new Date(t.date).toISOString().slice(0, 10);
      const safeNotes = `"${(t.notes || '').replace(/"/g, '""')}"`;
      csv += `${t._id},${dStr},${t.type},${t.category},${t.amount},${t.paymentMode},${safeNotes},${t.monthYear}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=money-manager-${month || 'all'}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Export failed', error: error.message });
  }
});

// 9. Seed Sample Starter Data (Useful for instant evaluation)
app.post('/api/seed', async (req, res) => {
  try {
    const currentMonth = getMonthYearStr();
    const count = await Transaction.countDocuments();
    if (count > 0 && !req.query.force) {
      return res.json({ success: true, message: 'Database already has data. Add ?force=true to overwrite.' });
    }

    if (req.query.force) {
      await Transaction.deleteMany({});
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const sampleData = [
      {
        type: 'income',
        amount: 6200,
        category: 'Salary',
        paymentMode: 'Bank Transfer',
        date: yesterday,
        notes: 'October salary'
      },
      {
        type: 'expense',
        amount: 300,
        category: 'Transport',
        paymentMode: 'UPI',
        date: yesterday,
        notes: 'Transport'
      },
      {
        type: 'expense',
        amount: 200,
        category: 'Something else',
        paymentMode: 'UPI',
        date: yesterday,
        notes: 'Hadya'
      }
    ];

    for (let item of sampleData) {
      item.monthYear = getMonthYearStr(item.date);
    }

    const seeded = await Transaction.insertMany(sampleData);
    res.status(201).json({ success: true, message: 'Sample transactions seeded successfully', count: seeded.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to seed data', error: error.message });
  }
});

// Fallback route to serve index.html for client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Money Manager Server running on port ${PORT}`);
  console.log(`📱 App URL: http://localhost:${PORT}`);
});
