import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully!');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'auth',  // Specify database name in options
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,  // Fail fast if no connection
      socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
    });

    console.log('⌛ Connected to MongoDB...');
    
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);  // Exit with failure
  }
};

export default connectDB;