import express from "express";
import {
  createDailyRecord,
  editDailyRecord,
  deleteDailyRecord,
  getDailyRecords,
  getMonthlySummary,
  getHistoryRecords,
} from "../controllers/dailyRecordController.js";
import userAuth from "../middleware/userAuth.js";

const dailyRecordRouter = express.Router();

dailyRecordRouter.post("/record", userAuth, createDailyRecord);
dailyRecordRouter.put("/record/:id", userAuth, editDailyRecord);
dailyRecordRouter.delete("/record/:id", userAuth, deleteDailyRecord);
dailyRecordRouter.get("/records", userAuth, getDailyRecords);
dailyRecordRouter.get("/monthly-summary", userAuth, getMonthlySummary);
dailyRecordRouter.get("/history", userAuth, getHistoryRecords);

export default dailyRecordRouter;