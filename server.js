import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoute.js";
import userRouter from "./routes/userRoute.js";
import dailyRecordRouter from "./routes/dailyRecordRoutes.js";

const app = express();
const port = process.env.PORT || 4000;
connectDB();

const allowedOrigins = ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' })); // Increased to handle base64 images
app.use(express.urlencoded({ extended: true, limit: '2mb' })); // Increased to handle base64 images
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/daily", dailyRecordRouter);

app.listen(port, () => {
  console.log(`Server Started on Port ${port}`);
});