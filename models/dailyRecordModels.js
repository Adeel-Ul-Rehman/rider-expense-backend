import mongoose from "mongoose";

const dailyRecordSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  work_status: {
    type: String,
    enum: ["On", "Off"],
    required: true,
  },
  deliveries: {
    type: Number,
    default: 0,
    min: [0, "Deliveries cannot be negative"],
  },
  tips: {
    type: Number,
    default: 0,
    min: [0, "Tips cannot be negative"],
  },
  expenses: {
    type: Number,
    default: 0,
    min: [0, "Expenses cannot be negative"],
  },
  day_quality: {
    type: String,
    enum: ["Excellent", "VeryGood", "Good", "Average", "Bad", "VeryBad", null],
    default: function () {
      return this.work_status === "On" ? "Average" : null;
    },
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

// Unique index to prevent duplicate entries for the same user and date
dailyRecordSchema.index({ user_id: 1, date: 1 }, { unique: true });

// Update `updated_at` on save
dailyRecordSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const DailyRecord = mongoose.models.DailyRecord || mongoose.model("DailyRecord", dailyRecordSchema);

export default DailyRecord;