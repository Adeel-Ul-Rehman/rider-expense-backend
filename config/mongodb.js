import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "auth",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    mongoose.connection.on("connected", () => {
      console.log("Database is connected!");
    });
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.log("Database disconnected");
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err; // Re-throw to be caught in server.js
  }
};

export default connectDB;