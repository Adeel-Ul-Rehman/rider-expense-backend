import mongoose from "mongoose";
import DailyRecord from "../models/dailyRecordModels.js";
import MonthlySummary from "../models/monthlySummaryModels.js";
import userModel from "../models/userModels.js";

// Helper function to get current billing cycle (21st to 20th)
const getBillingCycle = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  let startDate, endDate;

  if (day >= 21) {
    // Current cycle started on 21st of current month
    startDate = new Date(year, month, 21);
    endDate = new Date(year, month + 1, 20);
  } else {
    // Current cycle started on 21st of previous month
    startDate = new Date(year, month - 1, 21);
    endDate = new Date(year, month, 20);
  }

  // Set times correctly
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);
  return { startDate, endDate };
};

// Helper function to calculate earnings for a cycle (for monthly summary)
const calculateCycleEarnings = (stats, user, include) => {
  let earnings = 0;
  if (include.includes("fixed_salary")) {
    earnings += user.fixedSalary;
  }
  if (include.includes("deliveries")) {
    earnings += stats.total_deliveries * 45;
  }
  if (include.includes("tips")) {
    earnings += stats.total_tips;
  }
  if (stats.days_off > 4) {
    const penalty = user.employmentType === "FullTimer" ? 1170 : 585;
    earnings -= (stats.days_off - 4) * penalty;
  }
  return earnings;
};

// Helper function to update monthly summary
const updateMonthlySummary = async (userId, startDate, endDate, include = ["fixed_salary", "deliveries", "tips"]) => {
  try {
    const user = await userModel.findById(userId);
    if (!user) throw new Error("User not found");

    const records = await DailyRecord.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total_deliveries: { $sum: "$deliveries" },
          total_tips: { $sum: "$tips" },
          total_expenses: { $sum: "$expenses" },
          days_off: {
            $sum: { $cond: [{ $eq: ["$work_status", "Off"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = records[0] || {
      total_deliveries: 0,
      total_tips: 0,
      total_expenses: 0,
      days_off: 0,
    };

    const total_earnings = calculateCycleEarnings(stats, user, include);
    const savings = total_earnings - stats.total_expenses;

    await MonthlySummary.findOneAndUpdate(
      { user_id: userId, start_date: startDate, end_date: endDate },
      {
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        total_earnings,
        total_tips: stats.total_tips,
        total_expenses: stats.total_expenses,
        savings,
        total_deliveries: stats.total_deliveries,
        days_off: stats.days_off,
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Update monthly summary error:", error);
    throw error;
  }
};

// Create daily record
export const createDailyRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const { date, work_status, deliveries, tips, expenses, day_quality } = req.body;

    // Validate inputs
    if (!date || !work_status) {
      return res.status(400).json({
        success: false,
        message: "Date and work status are required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const inputDate = new Date(date);
    inputDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const accountCreated = new Date(user.account_created_at);
    accountCreated.setUTCHours(0, 0, 0, 0);

    if (isNaN(inputDate.getTime()) || inputDate < accountCreated || inputDate > today) {
      return res.status(400).json({
        success: false,
        message: "Date must be between account creation and today",
      });
    }

    if (!["On", "Off"].includes(work_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid work status",
      });
    }

    const recordData = {
      user_id: userId,
      date: inputDate,
      work_status,
      deliveries: work_status === "Off" ? 0 : deliveries || 0,
      tips: work_status === "Off" ? 0 : tips || 0,
      expenses: work_status === "Off" ? 0 : expenses || 0,
      day_quality: work_status === "Off" ? null : day_quality || "Average",
    };

    if (work_status === "On" && !["Excellent", "VeryGood", "Good", "Average", "Bad", "VeryBad"].includes(recordData.day_quality)) {
      return res.status(400).json({
        success: false,
        message: "Invalid day quality for On status",
      });
    }

    if (recordData.deliveries < 0 || recordData.tips < 0 || recordData.expenses < 0) {
      return res.status(400).json({
        success: false,
        message: "Deliveries, tips, and expenses cannot be negative",
      });
    }

    try {
      const record = new DailyRecord(recordData);
      await record.save();

      const { startDate, endDate } = getBillingCycle();
      if (inputDate >= startDate && inputDate <= endDate) {
        await updateMonthlySummary(userId, startDate, endDate);
      }

      return res.status(201).json({
        success: true,
        message: "Daily record created successfully",
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Details for this date already submitted",
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Create daily record error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create daily record",
    });
  }
};

// Edit daily record
export const editDailyRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const recordId = req.params.id;
    const { date, work_status, deliveries, tips, expenses, day_quality } = req.body;

    const record = await DailyRecord.findById(recordId);
    if (!record || record.user_id.toString() !== userId) {
      return res.status(404).json({
        success: false,
        message: "Record not found or unauthorized",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const inputDate = new Date(date || record.date);
    inputDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const accountCreated = new Date(user.account_created_at);
    accountCreated.setUTCHours(0, 0, 0, 0);

    if (isNaN(inputDate.getTime()) || inputDate < accountCreated || inputDate > today) {
      return res.status(400).json({
        success: false,
        message: "Date must be between account creation and today",
      });
    }

    if (!["On", "Off"].includes(work_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid work status",
      });
    }

    const updatedData = {
      date: inputDate,
      work_status,
      deliveries: work_status === "Off" ? 0 : deliveries || 0,
      tips: work_status === "Off" ? 0 : tips || 0,
      expenses: work_status === "Off" ? 0 : expenses || 0,
      day_quality: work_status === "Off" ? null : day_quality || "Average",
    };

    if (work_status === "On" && !["Excellent", "VeryGood", "Good", "Average", "Bad", "VeryBad"].includes(updatedData.day_quality)) {
      return res.status(400).json({
        success: false,
        message: "Invalid day quality for On status",
      });
    }

    if (updatedData.deliveries < 0 || updatedData.tips < 0 || updatedData.expenses < 0) {
      return res.status(400).json({
        success: false,
        message: "Deliveries, tips, and expenses cannot be negative",
      });
    }

    // Check for date conflict with other records
    if (inputDate.getTime() !== record.date.getTime()) {
      const existingRecord = await DailyRecord.findOne({
        user_id: userId,
        date: inputDate,
        _id: { $ne: recordId },
      });
      if (existingRecord) {
        return res.status(409).json({
          success: false,
          message: "Details for this date already submitted",
        });
      }
    }

    await DailyRecord.findByIdAndUpdate(recordId, updatedData, { new: true });

    const { startDate, endDate } = getBillingCycle();
    if (inputDate >= startDate && inputDate <= endDate) {
      await updateMonthlySummary(userId, startDate, endDate);
    }

    return res.json({
      success: true,
      message: "Daily record updated successfully",
    });
  } catch (error) {
    console.error("Edit daily record error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update daily record",
    });
  }
};

// Delete daily record
export const deleteDailyRecord = async (req, res) => {
  try {
    const userId = req.userId;
    const recordId = req.params.id;

    const record = await DailyRecord.findById(recordId);
    if (!record || record.user_id.toString() !== userId) {
      return res.status(404).json({
        success: false,
        message: "Record not found or unauthorized",
      });
    }

    await DailyRecord.findByIdAndDelete(recordId);

    const { startDate, endDate } = getBillingCycle();
    if (record.date >= startDate && record.date <= endDate) {
      await updateMonthlySummary(userId, startDate, endDate);
    }

    return res.json({
      success: true,
      message: "Daily record deleted successfully",
    });
  } catch (error) {
    console.error("Delete daily record error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete daily record",
    });
  }
};

// Fetch daily records for current cycle
export const getDailyRecords = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = getBillingCycle();

    const records = await DailyRecord.find({
      user_id: userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    return res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("Get daily records error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily records",
    });
  }
};

// Fetch monthly summary
export const getMonthlySummary = async (req, res) => {
  try {
    const userId = req.userId;
    const { include } = req.query;
    const validComponents = ["fixed_salary", "deliveries", "tips"];
    const includeArray = include ? include.split(",").filter((comp) => validComponents.includes(comp)) : validComponents;

    if (includeArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one income component (fixed_salary, deliveries, tips) must be included",
      });
    }

    const { startDate, endDate } = getBillingCycle();

    const summary = await MonthlySummary.findOne({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
    });

    if (!summary) {
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const records = await DailyRecord.aggregate([
        {
          $match: {
            user_id: new mongoose.Types.ObjectId(userId),
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            total_deliveries: { $sum: "$deliveries" },
            total_tips: { $sum: "$tips" },
            total_expenses: { $sum: "$expenses" },
            days_off: {
              $sum: { $cond: [{ $eq: ["$work_status", "Off"] }, 1, 0] },
            },
          },
        },
      ]);

      const stats = records[0] || {
        total_deliveries: 0,
        total_tips: 0,
        total_expenses: 0,
        days_off: 0,
      };

      const total_earnings = calculateCycleEarnings(stats, user, includeArray);
      const savings = total_earnings - stats.total_expenses;

      return res.json({
        success: true,
        summary: {
          total_earnings,
          total_tips: stats.total_tips,
          total_expenses: stats.total_expenses,
          savings,
          total_deliveries: stats.total_deliveries,
          days_off: stats.days_off,
        },
      });
    }

    // If summary exists, recalculate earnings based on include filter
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const total_earnings = calculateCycleEarnings(summary, user, includeArray);
    const savings = total_earnings - summary.total_expenses;

    return res.json({
      success: true,
      summary: {
        total_earnings,
        total_tips: summary.total_tips,
        total_expenses: summary.total_expenses,
        savings,
        total_deliveries: summary.total_deliveries,
        days_off: summary.days_off,
      },
    });
  } catch (error) {
    console.error("Get monthly summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monthly summary",
    });
  }
};

// Fetch history summary
export const getHistoryRecords = async (req, res) => {
  try {
    const userId = req.userId;
    const { from_date, to_date, include } = req.query;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "From and to dates are required",
      });
    }

    const validComponents = ["deliveries", "tips"];
    const includeArray = include ? include.split(",").filter((comp) => validComponents.includes(comp)) : validComponents;

    if (includeArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one income component (deliveries, tips) must be included",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const accountCreated = new Date(user.account_created_at);
    accountCreated.setUTCHours(0, 0, 0, 0);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate < accountCreated || toDate > today || fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid date range",
      });
    }

    // Get records for each day in the range, including days with no records
    const allDays = [];
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      allDays.push(new Date(d));
    }

    const records = await DailyRecord.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          total_deliveries: { $sum: "$deliveries" },
          total_tips: { $sum: "$tips" },
          total_expenses: { $sum: "$expenses" },
          days_off: {
            $sum: { $cond: [{ $eq: ["$work_status", "Off"] }, 1, 0] },
          },
          dailyRecords: {
            $push: {
              date: "$date",
              deliveries: "$deliveries",
              tips: "$tips",
              expenses: "$expenses",
              work_status: "$work_status"
            }
          }
        },
      },
    ]);

    const stats = records[0] || {
      total_deliveries: 0,
      total_tips: 0,
      total_expenses: 0,
      days_off: 0,
      dailyRecords: []
    };

    // Fill in missing days with zero values
    const completeDailyRecords = allDays.map(day => {
      const record = stats.dailyRecords.find(r => 
        new Date(r.date).toDateString() === day.toDateString()
      );
      return record || {
        date: new Date(day),
        deliveries: 0,
        tips: 0,
        expenses: 0,
        work_status: "Off"
      };
    });

    let total_earnings = 0;
    if (includeArray.includes("deliveries")) {
      total_earnings += stats.total_deliveries * 45;
    }
    if (includeArray.includes("tips")) {
      total_earnings += stats.total_tips;
    }
    const savings = total_earnings - stats.total_expenses;

    return res.json({
      success: true,
      summary: {
        total_earnings,
        total_tips: stats.total_tips,
        total_expenses: stats.total_expenses,
        savings,
        total_deliveries: stats.total_deliveries,
        days_off: stats.days_off,
      },
      dailyRecords: completeDailyRecords
    });
  } catch (error) {
    console.error("Get history summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch history summary",
    });
  }
};