import mongoose from "mongoose";

const monthlySummarySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  start_date: {
    type: Date,
    required: true,
  },
  end_date: {
    type: Date,
    required: true,
  },
  total_earnings: {
    type: Number,
    required: true,
  },
  total_tips: {
    type: Number,
    required: true,
  },
  total_expenses: {
    type: Number,
    required: true,
  },
  savings: {
    type: Number,
    required: true,
  },
  total_deliveries: {
    type: Number,
    required: true,
  },
  days_off: {
    type: Number,
    required: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast retrieval
monthlySummarySchema.index({ user_id: 1, start_date: 1, end_date: 1 }, { unique: true });

// Update `updated_at` on save
monthlySummarySchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const MonthlySummary = mongoose.models.MonthlySummary || mongoose.model("MonthlySummary", monthlySummarySchema);

export default MonthlySummary;