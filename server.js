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

// Define allowed origins for CORS
const allowedOrigins = [
  "https://riderexpense.free.nf", // Production frontend
  "http://localhost:5173"         // Local development
];

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Postman, curl) or from allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Explicitly allow methods
    allowedHeaders: ["Content-Type", "Authorization"],    // Allow necessary headers
  })
);

// Handle CORS preflight requests explicitly
app.options("*", cors());

// Middleware for parsing JSON and URL-encoded data
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
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB(); // Wait for MongoDB connection
    app.listen(port, () => {
      console.log(`Server Started on Port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();