// ========================================================
// CashFlow - Core Application Controller (3-Tab Architecture)
// ========================================================

const CATEGORIES = {
  income: [
    { name: 'Salary', icon: '💼' },
    { name: 'Freelance', icon: '💻' },
    { name: 'Business', icon: '🏢' },
    { name: 'Investment', icon: '📈' },
    { name: 'Rental', icon: '🏠' },
    { name: 'Hadya / Gift', icon: '✨' },
    { name: 'Other Income', icon: '➕' }
  ],
  expense: [
    { name: 'Transport', icon: '🛺' },
    { name: 'Food & Dining', icon: '🍔' },
    { name: 'Groceries', icon: '🛒' },
    { name: 'Rent & Housing', icon: '🏠' },
    { name: 'Bills & Utilities', icon: '💡' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Health & Medical', icon: '💊' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Something else', icon: '✨' },
    { name: 'Other', icon: '📦' }
  ]
};

// Global App State
const state = {
  currentMonth: getCurrentMonthStr(),
  availableMonths: [],
  transactions: [],
  summary: null,
  activeTab: 'balance', // 'balance' | 'spending' | 'summary'
  filterCategory: 'all',
  searchQuery: '',
  modalType: 'expense',
  editingTxId: null,
  pendingDeleteId: null,
  balanceMode: localStorage.getItem('cashflow_balance_mode') || 'month' // 'month' | 'total'
};

// ========================================================
// UTILITIES & HELPERS
// ========================================================

function getCurrentMonthStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function formatRupees(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN');
}

function getMonthYearFormatted(myStr, format = 'long') {
  const [y, m] = (myStr || state.currentMonth).split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  if (format === 'short') {
    const monthShort = d.toLocaleDateString('en-IN', { month: 'short' });
    const yearShort = String(d.getFullYear()).slice(-2);
    return `${monthShort} ${yearShort}`;
  }
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getCategoryIcon(type, categoryName) {
  const list = CATEGORIES[type] || CATEGORIES.expense;
  const match = list.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  if (match) return match.icon;
  if (categoryName && categoryName.toLowerCase().includes('transport')) return '🛺';
  if (categoryName && categoryName.toLowerCase().includes('salary')) return '💼';
  if (categoryName && categoryName.toLowerCase().includes('hadya')) return '✨';
  return type === 'income' ? '💰' : '📦';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// ========================================================
// DATA REFRESH & API CALLS
// ========================================================

async function refreshAllData() {
  await Promise.all([
    fetchSummary(),
    fetchTransactions()
  ]);

  renderHeader();
  renderBalanceView();
  renderSpendingView();
  renderSummaryView();

  const incomeModal = document.getElementById('income-entries-modal');
  if (incomeModal && !incomeModal.classList.contains('hidden')) {
    renderIncomeModalList();
    const sum = state.summary || { totalIncome: 0 };
    const totalVal = document.getElementById('income-modal-total-val');
    if (totalVal) totalVal.textContent = formatRupees(sum.totalIncome);
  }
}
window.refreshAllData = refreshAllData;

async function fetchSummary() {
  try {
    const res = await fetch(`/api/summary?month=${state.currentMonth}`);
    const data = await res.json();
    if (data.success) {
      state.summary = data.data;
      if (data.data.availableMonths) {
        state.availableMonths = data.data.availableMonths;
      }
      localStorage.setItem(`cashflow_summary_${state.currentMonth}`, JSON.stringify(state.summary));
    }
  } catch (err) {
    const cached = localStorage.getItem(`cashflow_summary_${state.currentMonth}`) || localStorage.getItem(`dhandost_summary_${state.currentMonth}`);
    if (cached) state.summary = JSON.parse(cached);
  }
}

async function fetchTransactions() {
  try {
    let url = `/api/transactions?month=${state.currentMonth}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      state.transactions = data.data;
      localStorage.setItem(`cashflow_txs_${state.currentMonth}`, JSON.stringify(state.transactions));
    }
  } catch (err) {
    const cached = localStorage.getItem(`cashflow_txs_${state.currentMonth}`) || localStorage.getItem(`dhandost_txs_${state.currentMonth}`);
    if (cached) state.transactions = JSON.parse(cached);
  }
}

// ========================================================
// 1. RENDER HEADER
// ========================================================

function renderHeader() {
  const sum = state.summary || { balance: 0, cumulativeBalance: 0, previousBalance: 0 };
  const monthLong = getMonthYearFormatted(state.currentMonth, 'long').toUpperCase();
  const monthShort = getMonthYearFormatted(state.currentMonth, 'short');
  const isTotal = state.balanceMode === 'total';

  const totalInHand = sum.cumulativeBalance !== undefined 
    ? sum.cumulativeBalance 
    : (sum.balance + (sum.previousBalance || 0));
  const displayVal = isTotal ? totalInHand : sum.balance;

  // Header Title & Balance
  document.getElementById('header-balance-label').textContent = isTotal 
    ? 'TOTAL BALANCE · IN HAND' 
    : `BALANCE · ${monthLong}`;
  
  const headerValEl = document.getElementById('header-balance-val');
  headerValEl.textContent = formatRupees(displayVal);
  if (displayVal < 0) {
    headerValEl.classList.add('text-danger');
  } else {
    headerValEl.classList.remove('text-danger');
  }

  // Month Navigator Pill `< Oct 26 >`
  document.getElementById('current-month-display').textContent = monthShort;

  // Month dropdown options
  const select = document.getElementById('month-picker-select');
  if (select) {
    if (!state.availableMonths.includes(state.currentMonth)) {
      state.availableMonths.unshift(state.currentMonth);
    }
    select.innerHTML = state.availableMonths.map(my => {
      const label = getMonthYearFormatted(my, 'long');
      return `<option value="${my}" ${my === state.currentMonth ? 'selected' : ''}>${label}</option>`;
    }).join('');
  }
}

// ========================================================
// 2. RENDER TAB 1: BALANCE (Photo 1 Reference)
// ========================================================

function renderBalanceView() {
  const sum = state.summary || {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    previousBalance: 0,
    cumulativeBalance: 0,
    allTimeBalance: 0,
    spentPercentage: 0,
    safeDailyAllowance: 0,
    daysLeft: 0,
    isCurrentMonth: true
  };

  const monthLong = getMonthYearFormatted(state.currentMonth, 'long');
  const isTotal = state.balanceMode === 'total';

  const totalInHand = sum.cumulativeBalance !== undefined 
    ? sum.cumulativeBalance 
    : (sum.balance + (sum.previousBalance || 0));
  const displayBalance = isTotal ? totalInHand : sum.balance;

  // Focused Big Window ("MONEY LEFT" or "TOTAL BALANCE")
  const heroCardTag = document.getElementById('hero-card-tag');
  if (heroCardTag) {
    heroCardTag.textContent = isTotal ? 'TOTAL BALANCE (IN HAND)' : 'MONEY LEFT';
  }

  const heroBalanceEl = document.getElementById('hero-balance-val');
  heroBalanceEl.textContent = formatRupees(displayBalance);
  if (displayBalance < 0) {
    heroBalanceEl.classList.add('text-danger');
  } else {
    heroBalanceEl.classList.remove('text-danger');
  }

  document.getElementById('hero-month-sub').textContent = isTotal 
    ? 'Total in hand' 
    : monthLong;

  // Update Toggle Button label & active state
  const toggleBtn = document.getElementById('toggle-balance-mode-btn');
  const toggleLabel = document.getElementById('balance-mode-label');
  if (toggleBtn && toggleLabel) {
    if (isTotal) {
      toggleLabel.textContent = 'Month Balance';
      toggleBtn.classList.add('active-total');
      toggleBtn.title = 'Switch back to this month\'s balance';
    } else {
      toggleLabel.textContent = 'Total Balance';
      toggleBtn.classList.remove('active-total');
      toggleBtn.title = 'Switch to total money in hand across all months';
    }
  }

  // Carryover Note Footnote
  const carryoverNote = document.getElementById('hero-carryover-note');
  const carryoverText = document.getElementById('hero-carryover-text');
  const prevBal = sum.previousBalance || 0;
  if (carryoverNote && carryoverText) {
    if (isTotal) {
      carryoverNote.classList.remove('hidden');
      if (prevBal !== 0) {
        carryoverText.innerHTML = `Includes <strong>${formatRupees(prevBal)}</strong> saved from previous months + <strong>${formatRupees(sum.balance)}</strong> this month`;
      } else {
        carryoverText.innerHTML = `All previous months' balance included (${formatRupees(displayBalance)} total in hand)`;
      }
    } else {
      carryoverNote.classList.add('hidden');
    }
  }

  // Progress Bar
  const spentPct = sum.totalIncome > 0 ? Math.min(sum.spentPercentage, 100) : 0;
  document.getElementById('hero-progress-fill').style.width = `${spentPct}%`;
  document.getElementById('hero-spent-summary-text').textContent = 
    `${formatRupees(sum.totalExpense)} spent of ${formatRupees(sum.totalIncome)} income · ${spentPct}%`;

  // Dual Stat Cards (Income In / Spent Out)
  document.getElementById('hero-income-val').textContent = formatRupees(sum.totalIncome);
  document.getElementById('hero-expense-val').textContent = formatRupees(sum.totalExpense);

  // Daily Allowance Footnote
  const allowanceNote = document.getElementById('hero-daily-allowance-note');
  if (sum.isCurrentMonth && sum.daysLeft > 0) {
    allowanceNote.style.display = 'block';
    document.getElementById('hero-daily-allowance-val').textContent = formatRupees(sum.safeDailyAllowance);
    document.getElementById('hero-days-left-val').textContent = sum.daysLeft;
  } else {
    allowanceNote.style.display = 'none';
  }

  // Welcome Income Prompt Banner
  const banner = document.getElementById('first-income-banner');
  if (sum.totalIncome === 0) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  // Recent Activity List (Top 3)
  renderRecentActivityList();

  // Where it went preview
  renderWhereItWentPreview(sum);
}

// Toggle between Month Balance and Total Balance
function toggleBalanceMode(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  state.balanceMode = state.balanceMode === 'month' ? 'total' : 'month';
  localStorage.setItem('cashflow_balance_mode', state.balanceMode);

  renderHeader();
  renderBalanceView();

  const isTotal = state.balanceMode === 'total';
  if (window.showToast) {
    window.showToast(isTotal ? 'Switched to Total Balance in Hand' : 'Switched to This Month\'s Balance', 'info');
  }
}
window.toggleBalanceMode = toggleBalanceMode;

function renderRecentActivityList() {
  const container = document.getElementById('recent-activity-list');
  if (!container) return;

  if (!state.transactions || state.transactions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 18px 0; color: var(--text-dim); font-size: 0.85rem;">
        No activity yet for this month. Tap <b>+ Add expense</b> or <b>+ Add income</b> above.
      </div>
    `;
    return;
  }

  const topRecent = state.transactions.slice(0, 3);
  container.innerHTML = topRecent.map(t => {
    const isIncome = t.type === 'income';
    const icon = getCategoryIcon(t.type, t.category);
    const title = t.notes || t.category;
    const sub = t.notes ? `${t.category} · ${formatDateDisplay(t.date)}` : formatDateDisplay(t.date);
    const amountStr = `${isIncome ? '+' : '-'}${formatRupees(t.amount)}`;

    if (isIncome) {
      // Income entry on Overview page: Clean display without edit/delete buttons, tapping opens Income/Salary Entries
      return `
        <div class="activity-item tx-row-item" onclick="openIncomeEntriesModal()" style="cursor: pointer;" title="Tap to view & edit income/salary entries">
          <div class="activity-item-left">
            <div class="activity-icon-bubble">${icon}</div>
            <div class="activity-item-info">
              <span class="activity-item-title">${escapeHtml(title)}</span>
              <span class="activity-item-sub">${escapeHtml(sub)}</span>
            </div>
          </div>
          <div class="tx-row-right">
            <span class="activity-item-amount income">${amountStr}</span>
          </div>
        </div>
      `;
    }

    // Expense / Spent entry on Overview page: has edit and delete buttons
    return `
      <div class="activity-item tx-row-item">
        <div class="activity-item-left" onclick="openEditModal('${t._id}')" style="cursor: pointer;" title="Tap to edit">
          <div class="activity-icon-bubble">${icon}</div>
          <div class="activity-item-info">
            <span class="activity-item-title">${escapeHtml(title)}</span>
            <span class="activity-item-sub">${escapeHtml(sub)}</span>
          </div>
        </div>
        <div class="tx-row-right">
          <span class="activity-item-amount expense">${amountStr}</span>
          <div class="tx-action-group">
            <button class="tx-action-btn tx-edit-btn" onclick="openEditModal('${t._id}')" title="Edit spent entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="tx-action-btn tx-trash-btn" onclick="confirmDeleteTx('${t._id}')" title="Delete spent entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderWhereItWentPreview(sum) {
  const container = document.getElementById('where-it-went-preview');
  if (!container) return;

  const expenses = sum.categoryTotals?.expense || {};
  const entries = Object.entries(expenses).sort((a, b) => b[1] - a[1]).slice(0, 2);

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-dim); font-size: 0.82rem; padding: 4px 0;">
        No spendings recorded yet.
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(([cat, amt]) => {
    const icon = getCategoryIcon('expense', cat);
    return `
      <div class="activity-item">
        <div class="activity-item-left">
          <div class="activity-icon-bubble">${icon}</div>
          <div class="activity-item-info">
            <span class="activity-item-title">${escapeHtml(cat)}</span>
          </div>
        </div>
        <span class="activity-item-amount expense">${formatRupees(amt)}</span>
      </div>
    `;
  }).join('');
}

// ========================================================
// 3. RENDER TAB 2: SPENDING (Photo 2 Reference)
// ========================================================

function renderSpendingView() {
  const sum = state.summary || { totalExpense: 0 };
  const monthLong = getMonthYearFormatted(state.currentMonth, 'long').toUpperCase();

  // Big Window: Total Spent
  document.getElementById('spending-header-tag').textContent = `TOTAL SPENT · ${monthLong}`;
  document.getElementById('spending-total-val').textContent = formatRupees(sum.totalExpense);

  const expenseTxList = state.transactions.filter(t => t.type === 'expense');
  document.getElementById('spending-entries-count').textContent = `${expenseTxList.length} entries`;

  // Render Filter Chips
  renderSpendingCategoryChips(expenseTxList);

  // Render Grouped Transactions by Date
  renderGroupedSpendingList(expenseTxList);
}

function renderSpendingCategoryChips(expenseList) {
  const container = document.getElementById('spending-category-chips');
  if (!container) return;

  const cats = new Set();
  expenseList.forEach(t => cats.add(t.category));

  let html = `
    <button class="chip-pill ${state.filterCategory === 'all' ? 'active' : ''}" 
            onclick="setTxCategoryFilter('all')">
      All
    </button>
  `;

  cats.forEach(cat => {
    const icon = getCategoryIcon('expense', cat);
    const isActive = state.filterCategory === cat;
    html += `
      <button class="chip-pill ${isActive ? 'active' : ''}" 
              onclick="setTxCategoryFilter('${escapeHtml(cat)}')">
        ${icon} ${escapeHtml(cat)}
      </button>
    `;
  });

  container.innerHTML = html;
}

function setTxCategoryFilter(cat) {
  state.filterCategory = cat;
  renderSpendingView();
}

function renderGroupedSpendingList(expenseList) {
  const container = document.getElementById('spending-grouped-list');
  if (!container) return;

  // Apply Search & Category Filters
  let filtered = expenseList;
  if (state.filterCategory !== 'all') {
    filtered = filtered.filter(t => t.category.toLowerCase() === state.filterCategory.toLowerCase());
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    filtered = filtered.filter(t => 
      (t.notes || '').toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-dim); font-size: 0.88rem;">
        No spending entries found for this criteria.
      </div>
    `;
    return;
  }

  // Group by Date Heading (e.g. TODAY, YESTERDAY, 12 OCT 2026)
  const groups = {};
  filtered.forEach(t => {
    const groupKey = getDateGroupTitle(t.date);
    if (!groups[groupKey]) {
      groups[groupKey] = { title: groupKey, items: [], total: 0 };
    }
    groups[groupKey].items.push(t);
    groups[groupKey].total += t.amount;
  });

  let html = '';
  Object.values(groups).forEach(g => {
    html += `
      <div class="date-group-card">
        <div class="date-group-header">
          <span class="date-group-title">${g.title}</span>
          <span class="date-group-total">${formatRupees(g.total)}</span>
        </div>
        <div class="date-group-items">
    `;

    g.items.forEach(t => {
      const icon = getCategoryIcon('expense', t.category);
      const title = t.notes || t.category;
      const sub = t.category;

      html += `
        <div class="tx-row-item">
          <div class="activity-item-left" onclick="openEditModal('${t._id}')" style="cursor: pointer;" title="Tap to edit">
            <div class="activity-icon-bubble">${icon}</div>
            <div class="activity-item-info">
              <span class="activity-item-title">${escapeHtml(title)}</span>
              <span class="activity-item-sub">${escapeHtml(sub)}</span>
            </div>
          </div>
          <div class="tx-row-right">
            <span class="activity-item-amount expense">-${formatRupees(t.amount)}</span>
            <div class="tx-action-group">
              <button class="tx-action-btn tx-edit-btn" onclick="openEditModal('${t._id}')" title="Edit spent entry">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="tx-action-btn tx-trash-btn" onclick="confirmDeleteTx('${t._id}')" title="Delete spent entry">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function getDateGroupTitle(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ========================================================
// 4. RENDER TAB 3: SUMMARY (Photo 3 Reference)
// ========================================================

function renderSummaryView() {
  const sum = state.summary || {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    categoryTotals: { income: {}, expense: {} }
  };

  const monthLong = getMonthYearFormatted(state.currentMonth, 'long').toUpperCase();

  // Big Window: Month Total
  document.getElementById('summary-header-tag').textContent = `MONTH TOTAL · ${monthLong}`;
  document.getElementById('summary-balance-val').innerHTML = 
    `${formatRupees(sum.balance)} <span class="amount-sub-badge">LEFT</span>`;

  // Carryover & Total in hand
  const summaryCarryoverEl = document.getElementById('summary-carryover-stat');
  const summaryTotalInHandEl = document.getElementById('summary-total-in-hand-val');
  const summaryPrevCarryoverEl = document.getElementById('summary-prev-carryover-val');
  const prevBal = sum.previousBalance || 0;
  const totalInHand = sum.cumulativeBalance !== undefined ? sum.cumulativeBalance : (sum.balance + prevBal);

  if (summaryCarryoverEl && summaryTotalInHandEl && summaryPrevCarryoverEl) {
    if (prevBal !== 0) {
      summaryCarryoverEl.classList.remove('hidden');
      summaryTotalInHandEl.textContent = formatRupees(totalInHand);
      summaryPrevCarryoverEl.textContent = formatRupees(prevBal);
    } else {
      summaryCarryoverEl.classList.add('hidden');
    }
  }

  document.getElementById('summary-came-in-val').textContent = formatRupees(sum.totalIncome);
  document.getElementById('summary-went-out-val').textContent = formatRupees(sum.totalExpense);

  // Render White "Where the money went" Pie Chart Card
  renderPieChartCard(sum);

  // Render Detailed Category Breakdown List
  renderCategoryBreakdownList(sum);

  // Render Income This Month List
  renderIncomeBreakdownList(sum);
}

function renderPieChartCard(sum) {
  const expenses = sum.categoryTotals?.expense || {};
  const entries = Object.entries(expenses).sort((a, b) => b[1] - a[1]);

  const monthLong = getMonthYearFormatted(state.currentMonth, 'long');
  const totalExp = sum.totalExpense || 0;

  document.getElementById('chart-white-subtitle').textContent = 
    `${monthLong} · ${formatRupees(totalExp)} across ${entries.length} categories`;

  const pieContainer = document.getElementById('pie-chart-container');
  const legendContainer = document.getElementById('pie-chart-legend');

  if (entries.length === 0 || totalExp === 0) {
    pieContainer.innerHTML = `
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="20" />
      </svg>
    `;
    legendContainer.innerHTML = '<span style="color: #6b7280; font-size: 0.8rem;">No expenses recorded</span>';
    return;
  }

  // Slice Colors (Matching Screenshot 3: Blue, Green, Yellow/Orange, Purple, Pink)
  const sliceColors = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Generate SVG Pie/Donut Chart
  let cumulativeAngle = 0;
  let svgPaths = '';
  let legendHtml = '';

  entries.forEach(([cat, amt], idx) => {
    const fraction = amt / totalExp;
    const angle = fraction * 360;
    const color = sliceColors[idx % sliceColors.length];
    const pct = Math.round(fraction * 100);

    // Calculate arc coordinates on 100x100 SVG
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startX = 50 + 40 * Math.cos(Math.PI * (startAngle - 90) / 180);
    const startY = 50 + 40 * Math.sin(Math.PI * (startAngle - 90) / 180);
    const endX = 50 + 40 * Math.cos(Math.PI * (endAngle - 90) / 180);
    const endY = 50 + 40 * Math.sin(Math.PI * (endAngle - 90) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    if (entries.length === 1) {
      svgPaths = `<circle cx="50" cy="50" r="40" fill="${color}" />`;
    } else {
      svgPaths += `
        <path d="M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z" fill="${color}" />
      `;
    }

    legendHtml += `
      <div class="legend-row">
        <div class="legend-color-dot" style="background: ${color};"></div>
        <span>${escapeHtml(cat)} · ${pct}%</span>
      </div>
    `;
  });

  pieContainer.innerHTML = `
    <svg width="120" height="120" viewBox="0 0 100 100">
      ${svgPaths}
      <circle cx="50" cy="50" r="14" fill="#ffffff" />
    </svg>
  `;

  legendContainer.innerHTML = legendHtml;
}

function renderCategoryBreakdownList(sum) {
  const container = document.getElementById('summary-category-breakdown-list');
  if (!container) return;

  const expenses = sum.categoryTotals?.expense || {};
  const entries = Object.entries(expenses).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">No expenses recorded</span>';
    return;
  }

  const totalExp = sum.totalExpense || 1;
  const barColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

  container.innerHTML = entries.map(([cat, amt], idx) => {
    const icon = getCategoryIcon('expense', cat);
    const pct = Math.round((amt / totalExp) * 100);
    const count = state.transactions.filter(t => t.type === 'expense' && t.category === cat).length;
    const color = barColors[idx % barColors.length];

    return `
      <div class="cat-row">
        <div class="cat-row-top">
          <div class="cat-row-left">
            <span style="font-size: 1.1rem;">${icon}</span>
            <div>
              <span class="cat-row-name">${escapeHtml(cat)}</span>
              <span class="cat-row-entries">${count} ${count === 1 ? 'entry' : 'entries'}</span>
            </div>
          </div>
          <div class="cat-row-right">
            <span class="cat-row-amount">${formatRupees(amt)}</span>
            <span class="cat-row-pct">${pct}%</span>
          </div>
        </div>
        <div class="cat-progress-track">
          <div class="cat-progress-bar" style="width: ${pct}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderIncomeBreakdownList(sum) {
  const container = document.getElementById('summary-income-breakdown-list');
  if (!container) return;

  const incomeTxList = state.transactions.filter(t => t.type === 'income');

  if (incomeTxList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 16px 0; color: var(--text-dim); font-size: 0.85rem;">
        No income recorded for this month.
        <div style="margin-top: 8px;">
          <button class="btn btn-sm btn-primary" onclick="openAddModal('income')">+ Add Income</button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = incomeTxList.map(t => {
    const icon = getCategoryIcon('income', t.category);
    const title = t.notes || t.category;
    const sub = t.notes ? `${t.category} · ${formatDateDisplay(t.date)}` : formatDateDisplay(t.date);

    return `
      <div class="activity-item tx-row-item" onclick="openIncomeEntriesModal()" style="cursor: pointer;" title="Tap to manage income entries">
        <div class="activity-item-left">
          <div class="activity-icon-bubble">${icon}</div>
          <div class="activity-item-info">
            <span class="activity-item-title">${escapeHtml(title)}</span>
            <span class="activity-item-sub">${escapeHtml(sub)}</span>
          </div>
        </div>
        <div class="tx-row-right">
          <span class="activity-item-amount income">+${formatRupees(t.amount)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ========================================================
// 5. TAB SWITCHING (Balance, Spending, Summary)
// ========================================================

function switchTab(tabName) {
  state.activeTab = tabName;

  // Toggle view elements
  document.querySelectorAll('.app-view').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.add('active');

  // Toggle bottom nav icons
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabName === 'spending') {
    renderSpendingView();
  } else if (tabName === 'summary') {
    renderSummaryView();
  } else {
    renderBalanceView();
  }
}
window.switchTab = switchTab;

// Month Navigation
function changeMonth(delta) {
  const [y, m] = state.currentMonth.split('-');
  const dateObj = new Date(parseInt(y), parseInt(m) - 1 + delta, 1);
  const newY = dateObj.getFullYear();
  const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
  state.currentMonth = `${newY}-${newM}`;

  if (!state.availableMonths.includes(state.currentMonth)) {
    state.availableMonths.unshift(state.currentMonth);
    state.availableMonths.sort().reverse();
  }

  refreshAllData();
}

// ========================================================
// 6. ADD / EDIT TRANSACTION MODALS
// ========================================================

function openAddModal(type = 'expense') {
  state.editingTxId = null;
  state.modalType = type;

  document.getElementById('modal-title').textContent = type === 'income' ? 'Add Income' : 'Add Expense';
  document.getElementById('form-submit-btn').textContent = type === 'income' ? 'Save Income' : 'Save Expense';
  document.getElementById('form-tx-id').value = '';
  document.getElementById('form-amount').value = '';
  document.getElementById('form-notes').value = '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('form-date').value = today;

  setModalType(type);
  document.getElementById('tx-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-amount').focus(), 150);
}
window.openAddModal = openAddModal;

function openEditModal(id) {
  const tx = state.transactions.find(t => t._id === id);
  if (!tx) {
    showToast('Transaction not found', 'danger');
    return;
  }

  state.editingTxId = id;
  state.modalType = tx.type;

  document.getElementById('modal-title').textContent = tx.type === 'income' ? 'Edit Income' : 'Edit Expense';
  document.getElementById('form-submit-btn').textContent = tx.type === 'income' ? 'Update Income' : 'Update Expense';
  document.getElementById('form-tx-id').value = tx._id;
  document.getElementById('form-amount').value = tx.amount;
  document.getElementById('form-notes').value = tx.notes || '';

  const txDate = new Date(tx.date);
  const yyyy = txDate.getFullYear();
  const mm = String(txDate.getMonth() + 1).padStart(2, '0');
  const dd = String(txDate.getDate()).padStart(2, '0');
  document.getElementById('form-date').value = `${yyyy}-${mm}-${dd}`;

  const radios = document.getElementsByName('paymentMode');
  for (let r of radios) {
    if (r.value === (tx.paymentMode || 'UPI')) r.checked = true;
  }

  setModalType(tx.type, tx.category);
  document.getElementById('tx-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-amount').focus(), 150);
}
window.openEditModal = openEditModal;

function closeTxModal() {
  document.getElementById('tx-modal').classList.add('hidden');
}
window.closeTxModal = closeTxModal;

// ========================================================
// INCOME & SALARY ENTRIES MODAL (When clicking main balance / income)
// ========================================================

function openIncomeEntriesModal() {
  const sum = state.summary || { totalIncome: 0 };
  const monthLong = getMonthYearFormatted(state.currentMonth, 'long');

  const monthSub = document.getElementById('income-modal-month-sub');
  const totalVal = document.getElementById('income-modal-total-val');
  if (monthSub) monthSub.textContent = monthLong;
  if (totalVal) totalVal.textContent = formatRupees(sum.totalIncome);

  renderIncomeModalList();
  document.getElementById('income-entries-modal').classList.remove('hidden');
}
window.openIncomeEntriesModal = openIncomeEntriesModal;

function closeIncomeEntriesModal() {
  document.getElementById('income-entries-modal').classList.add('hidden');
}
window.closeIncomeEntriesModal = closeIncomeEntriesModal;

function renderIncomeModalList() {
  const container = document.getElementById('income-modal-list');
  if (!container) return;

  const incomeTxList = state.transactions.filter(t => t.type === 'income');
  const monthLong = getMonthYearFormatted(state.currentMonth, 'long');

  if (incomeTxList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 0; color: var(--text-dim); font-size: 0.88rem;">
        No income or salary entries recorded for ${monthLong}.
      </div>
    `;
    return;
  }

  container.innerHTML = incomeTxList.map(t => {
    const icon = getCategoryIcon('income', t.category);
    const title = t.notes || t.category;
    const sub = t.notes ? `${t.category} · ${formatDateDisplay(t.date)}` : formatDateDisplay(t.date);

    return `
      <div class="activity-item tx-row-item">
        <div class="activity-item-left" onclick="closeIncomeEntriesModal(); openEditModal('${t._id}')" style="cursor: pointer;" title="Tap to edit">
          <div class="activity-icon-bubble">${icon}</div>
          <div class="activity-item-info">
            <span class="activity-item-title">${escapeHtml(title)}</span>
            <span class="activity-item-sub">${escapeHtml(sub)}</span>
          </div>
        </div>
        <div class="tx-row-right">
          <span class="activity-item-amount income">+${formatRupees(t.amount)}</span>
          <div class="tx-action-group">
            <button class="tx-action-btn tx-edit-btn" onclick="closeIncomeEntriesModal(); openEditModal('${t._id}')" title="Edit income entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="tx-action-btn tx-trash-btn" onclick="closeIncomeEntriesModal(); confirmDeleteTx('${t._id}')" title="Delete income entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setModalType(type, selectedCategory = null) {
  state.modalType = type;

  const btnIncome = document.getElementById('tab-btn-income');
  const btnExpense = document.getElementById('tab-btn-expense');
  const submitBtn = document.getElementById('form-submit-btn');

  if (type === 'income') {
    btnIncome.classList.add('active');
    btnExpense.classList.remove('active');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = state.editingTxId ? 'Update Income' : 'Save Income';
  } else {
    btnExpense.classList.add('active');
    btnIncome.classList.remove('active');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = state.editingTxId ? 'Update Expense' : 'Save Expense';
  }

  const categorySelect = document.getElementById('form-category');
  const chipsRow = document.getElementById('category-chips-row');
  const catList = CATEGORIES[type] || CATEGORIES.expense;

  categorySelect.innerHTML = catList.map(c => 
    `<option value="${c.name}">${c.icon} ${c.name}</option>`
  ).join('');

  if (selectedCategory) {
    categorySelect.value = selectedCategory;
  }

  chipsRow.innerHTML = catList.map(c => `
    <button type="button" class="chip-btn ${categorySelect.value === c.name ? 'selected' : ''}" 
            onclick="selectCategoryChip('${c.name}')">
      ${c.icon} ${c.name}
    </button>
  `).join('');
}
window.setModalType = setModalType;

function selectCategoryChip(catName) {
  const select = document.getElementById('form-category');
  select.value = catName;
  document.querySelectorAll('#category-chips-row .chip-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.textContent.includes(catName));
  });
}
window.selectCategoryChip = selectCategoryChip;

async function handleTxSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('form-tx-id').value;
  const amount = parseFloat(document.getElementById('form-amount').value);
  const category = document.getElementById('form-category').value;
  const date = document.getElementById('form-date').value;
  const notes = document.getElementById('form-notes').value;
  
  let paymentMode = 'UPI';
  const selectedMode = document.querySelector('input[name="paymentMode"]:checked');
  if (selectedMode) paymentMode = selectedMode.value;

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount', 'danger');
    return;
  }

  const payload = {
    type: state.modalType,
    amount,
    category,
    paymentMode,
    date,
    notes
  };

  try {
    const res = await fetch(id ? `/api/transactions/${id}` : '/api/transactions', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(
        id ? 'Transaction updated!' : 
        (state.modalType === 'income' ? `Income of ${formatRupees(amount)} added!` : `Expense of ${formatRupees(amount)} added!`),
        'success'
      );
      closeTxModal();
      await refreshAllData();
    } else {
      showToast(data.message || 'Operation failed', 'danger');
    }
  } catch (err) {
    showToast('Server connection failed', 'danger');
  }
}
window.handleTxSubmit = handleTxSubmit;

// Delete Transactions
function confirmDeleteTx(id) {
  state.pendingDeleteId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}
window.confirmDeleteTx = confirmDeleteTx;

function closeDeleteModal() {
  state.pendingDeleteId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}
window.closeDeleteModal = closeDeleteModal;

async function executeDeleteTx() {
  if (!state.pendingDeleteId) return;
  try {
    const res = await fetch(`/api/transactions/${state.pendingDeleteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Transaction deleted', 'success');
      closeDeleteModal();
      await refreshAllData();
    }
  } catch (err) {
    showToast('Failed to delete transaction', 'danger');
  }
}

// Floating Action Button
function openFabMenu() {
  document.getElementById('fab-menu').classList.remove('hidden');
}
window.openFabMenu = openFabMenu;

function closeFabMenu() {
  document.getElementById('fab-menu').classList.add('hidden');
}
window.closeFabMenu = closeFabMenu;

// Search in Spending View
function clearSearch() {
  const input = document.getElementById('tx-search-input');
  input.value = '';
  state.searchQuery = '';
  document.getElementById('tx-search-clear').classList.add('hidden');
  renderSpendingView();
}
window.clearSearch = clearSearch;

function exportCsv() {
  window.location.href = `/api/export/csv?month=${state.currentMonth}`;
}
window.exportCsv = exportCsv;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// ========================================================
// INITIALIZATION
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Month Navigator
  document.getElementById('prev-month-btn').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month-btn').addEventListener('click', () => changeMonth(1));
  document.getElementById('month-picker-select').addEventListener('change', (e) => {
    state.currentMonth = e.target.value;
    refreshAllData();
  });

  // Delete Action
  document.getElementById('confirm-delete-btn').addEventListener('click', executeDeleteTx);

  // Search in Spending
  const searchInput = document.getElementById('tx-search-input');
  const searchClear = document.getElementById('tx-search-clear');
  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    searchClear.classList.toggle('hidden', !val);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = val;
      renderSpendingView();
    }, 200);
  });

  // Category select sync
  document.getElementById('form-category').addEventListener('change', (e) => {
    selectCategoryChip(e.target.value);
  });

  // Escape key support
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTxModal();
      closeDeleteModal();
      closeFabMenu();
      closeIncomeEntriesModal();
    }
  });

  refreshAllData();
});
