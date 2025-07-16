import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    maxlength: [20, "Name must be 20 characters or less"],
    match: [/^[a-zA-Z0-9\s]+$/, "Name can only contain alphabets, numbers, or spaces"]
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  verifyOtp: { type: String, default: '' },
  verifyOtpExpireAt: { type: Number, default: 0 },
  isAccountVerified: { type: Boolean, default: false },
  resetOtp: { type: String, default: '' },
  resetOtpExpireAt: { type: Number, default: 0 },
  employmentType: {
    type: String,
    enum: ['PartTimer', 'FullTimer'],
    required: true
  },
  fixedSalary: {
    type: Number
  },
  account_created_at: {
    type: Date,
    default: Date.now
  },
  profilePicture: {
    type: String,
    default: null // Base64 string for profile picture
  }
});

userSchema.pre("save", function (next) {
  if (this.isNew && !this.fixedSalary) {
    this.fixedSalary = this.employmentType === "FullTimer" ? 37000 : 18500;
  }
  next();
});

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;