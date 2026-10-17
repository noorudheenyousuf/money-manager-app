const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Transaction type is required (income or expense)']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than zero']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  paymentMode: {
    type: String,
    enum: ['UPI', 'Cash', 'Card', 'Net Banking', 'Bank Transfer', 'Other'],
    default: 'UPI'
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Notes cannot exceed 200 characters'],
    default: ''
  },
  monthYear: {
    type: String, // e.g. '2026-10'
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Auto-populate monthYear before validation if not explicitly provided
TransactionSchema.pre('validate', function() {
  if (this.date) {
    const d = new Date(this.date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    this.monthYear = `${year}-${month}`;
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
