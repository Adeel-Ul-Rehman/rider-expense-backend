import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoute.js";
import userRouter from "./routes/userRoute.js";
import dailyRecordRouter from "./routes/dailyRecordRoutes.js";

const app = express();
const port = process.env.PORT || 4000;

// ==================
// Security & Middlewares
// ==================
app.use(helmet());

const allowedOrigins = [
  "http://localhost:5173",
  "https://riderexpense.free.nf" // ✅ your deployed frontend
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // ✅ Needed for cookies across domains
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// ==================
// Rate Limiting
// ==================
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, try again later."
}));

// ==================
// Routes
// ==================
app.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({
    message: "Backend is live!",
    db: dbStatus
  });
});

app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/daily", dailyRecordRouter);

// ==================
// Error Handler
// ==================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// ==================
// Start Server
// ==================
const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();