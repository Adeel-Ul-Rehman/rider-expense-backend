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

// ✅ CORS configuration
app.use(
  cors({
    origin: [
      "https://riderexpense.free.nf",   // Your production frontend
      "http://riderexpense.free.nf",
      "http://localhost:5173"           // Local dev
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Handle preflight requests
app.options("*", cors());

// Middlewares
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// Test route
app.get("/", (req, res) => {
  res.send("Backend is live!");
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/daily", dailyRecordRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

// Connect DB and start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () =>
      console.log(`✅ Server running on port ${port}`)
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
