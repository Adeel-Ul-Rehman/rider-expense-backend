import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import transporter from "../config/nodemailer.js";
import userModel from "../models/userModels.js";
import nodemailer from "nodemailer";
import { Buffer } from "buffer";

export const register = async (req, res) => {
  try {
    // Handle potential text/plain content-type
    let requestBody = req.body;
    if (typeof req.body === "string") {
      try {
        requestBody = JSON.parse(req.body);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format in request body",
        });
      }
    }

    const { name, email, password, employmentType } = requestBody;

    // Validate required fields
    if (!name || !email || !password || !employmentType) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: name, email, password, employmentType",
      });
    }

    // Validate name: max 20 characters, only alphabets, numbers, and spaces
    if (name.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Name must be 20 characters or less",
      });
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        message: "Name can only contain alphabets, numbers, or spaces",
      });
    }

    // Validate password: min 8 characters, at least one alphabet and one number
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one alphabet and one number",
      });
    }

    // Validate employmentType
    if (!["PartTimer", "FullTimer"].includes(employmentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employmentType. Must be 'PartTimer' or 'FullTimer'",
      });
    }

    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      if (existingUser.isAccountVerified) {
        return res.status(409).json({
          success: false,
          message: "User already exists with this email",
        });
      } else {
        // Update unverified user with new OTP and fields
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpiry = Date.now() + 3600000; // 1 hour

        existingUser.verifyOtp = otp;
        existingUser.verifyOtpExpireAt = otpExpiry;
        // Update password if provided
        if (password) {
          existingUser.password = await bcrypt.hash(password, 10);
        }
        // Update name and employmentType if provided
        if (name) existingUser.name = name;
        if (employmentType) {
          existingUser.employmentType = employmentType;
          existingUser.fixedSalary = employmentType === "FullTimer" ? 37000 : 18500;
        }

        await existingUser.save();

        // Generate JWT token
        const token = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        // Set HTTP-only cookie
        res.cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Send OTP email
        try {
          const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: `Welcome to Domino's Rider Expense Family!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="padding: 20px; border: 2px solid #006491; border-radius: 8px;">
                  <h1 style="color: #E31837; text-align: center;">Domino's Rider Expense</h1>
                  <p>Dear ${name},</p>
                  <p>We're thrilled to have you join our team of dedicated riders with email: <strong>${email}</strong>!</p>
                  
                  <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #E31837; margin-top: 0;">Email Verification OTP</h3>
                    <p style="font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 15px 0; color: #E31837;">
                      ${otp}
                    </p>
                    <p style="color: #777;">This OTP is valid for 1 hour.</p>
                  </div>

                  <p>Please verify your email address to complete your registration.</p>
                  
                  <div style="text-align: center; margin: 20px 0;">
                    <a href="mailto:dominoriderexpense@gmail.com" style="display: inline-block; padding: 10px 20px; background: #fff; border: 2px solid #006491; color: #006491; text-decoration: none; border-radius: 5px; font-weight: bold; transition: all 0.3s;">Contact Support</a>
                  </div>

                  <p>Best regards,<br>Adeel Ul Rehman 😇<br>The Domino's Rider Team</p>
                  
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                    <p>Need help? <a href="mailto:dominoriderexpense@gmail.com" style="color: #006491; text-decoration: none;">Contact our support team</a></p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>© ${new Date().getFullYear()} Domino's Rider Expense System. All rights reserved.</p>
                  </div>
                </div>
              </div>
            `,
            text: `
Welcome to Domino's Rider Expense Family!

Dear ${name},

We're thrilled to have you join our team of dedicated riders with email: ${email}!

Email Verification OTP: ${otp}
This OTP is valid for 1 hour.

Please verify your email address to complete your registration.

Need help? Contact: dominoriderexpense@gmail.com

Best regards,
Adeel Ul Rehman 😇
The Domino's Rider Team

If you didn't request this, please ignore this email.
© ${new Date().getFullYear()} Domino's Rider Expense System.
            `
          };

          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          return res.status(500).json({
            success: false,
            message: "User updated but failed to send OTP email",
            error: process.env.NODE_ENV === "development" ? emailError.message : undefined,
          });
        }

        return res.status(200).json({
          success: true,
          message: "New verification OTP sent to email.",
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
          },
        });
      }
    }

    // Create new user
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = Date.now() + 3600000; // 1 hour
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new userModel({
      name,
      email,
      password: hashedPassword,
      employmentType,
      verifyOtp: otp,
      verifyOtpExpireAt: otpExpiry,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Set HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Send welcome email with OTP
    try {
      const mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: email,
        subject: `Welcome to Domino's Rider Expense Family!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="padding: 20px; border: 2px solid #006491; border-radius: 8px;">
              <h1 style="color: #E31837; text-align: center;">Domino's Rider Expense</h1>
              <p>Dear ${name},</p>
              <p>We're thrilled to have you join our team of dedicated riders with email: <strong>${email}</strong>!</p>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <h3 style="color: #E31837; margin-top: 0;">Email Verification OTP</h3>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 15px 0; color: #E31837;">
                  ${otp}
                </p>
                <p style="color: #777;">This OTP is valid for 1 hour.</p>
              </div>

              <p>Please verify your email address to complete your registration.</p>
              
              <div style="text-align: center; margin: 20px 0;">
                <a href="mailto:dominoriderexpense@gmail.com" style="display: inline-block; padding: 10px 20px; background: #fff; border: 2px solid #006491; color: #006491; text-decoration: none; border-radius: 5px; font-weight: bold; transition: all 0.3s;">Contact Support</a>
              </div>

              <p>Best regards,<br>Adeel Ul Rehman 😇<br>The Domino's Rider Team</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
                <p>Need help? <a href="mailto:dominoriderexpense@gmail.com" style="color: #006491; text-decoration: none;">Contact our support team</a></p>
                <p>If you didn't request this, please ignore this email.</p>
                <p>© ${new Date().getFullYear()} Domino's Rider Expense System. All rights reserved.</p>
              </div>
            </div>
          </div>
        `,
        text: `
Welcome to Domino's Rider Expense Family!

Dear ${name},

We're thrilled to have you join our team of dedicated riders with email: ${email}!

Email Verification OTP: ${otp}
This OTP is valid for 1 hour.

Please verify your email address to complete your registration.

Need help? Contact: dominoriderexpense@gmail.com

Best regards,
Adeel Ul Rehman 😇
The Domino's Rider Team

If you didn't request this, please ignore this email.
© ${new Date().getFullYear()} Domino's Rider Expense System.
            `
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      return res.status(500).json({
        success: false,
        message: "User created but failed to send OTP email",
        error: process.env.NODE_ENV === "development" ? emailError.message : undefined,
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Verification OTP sent to email.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({
        success: false,
        message: "User ID and OTP are required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.verifyOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.verifyOtpExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    user.isAccountVerified = true;
    user.verifyOtp = undefined;
    user.verifyOtpExpireAt = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
};

export const login = async (req, res) => {
  try {
    // Handle potential text/plain content-type
    let requestBody = req.body;
    if (typeof req.body === "string") {
      try {
        requestBody = JSON.parse(req.body);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON format",
        });
      }
    }

    const { email, password } = requestBody;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isAccountVerified) {
      return res.status(401).json({
        success: false,
        message: "Sign up again and verify your email to login",
      });
    }

    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Email verification OTP
export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isAccountVerified) {
      return res.json({
        success: false,
        message: "Account is already verified",
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 3600000; // 1 hour
    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: `Account Verification OTP`,
      text: `Your OTP is ${otp}. Valid for 1 hour.`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      message: "Verification OTP sent to email",
    });
  } catch (error) {
    console.error("OTP send error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Check authentication status
export const isAuthenticated = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select('-password -verifyOtp -resetOtp');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        employmentType: user.employmentType,
        isAccountVerified: user.isAccountVerified
      }
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication check failed",
    });
  }
};

// Password reset OTP
export const sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.isAccountVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email first"
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 600000; // 10 minutes
    await user.save();

    const mailOptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: `🔐 Domino's Rider Password Reset Verification`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="padding: 20px; border: 2px solid #006491; border-radius: 8px;">
            <h1 style="color: #E31837; text-align: center;">Domino's Rider Expense</h1>
            <p>Dear ${user.name},</p>
            <p>We received a request to reset your password for your Domino's Rider Expense account with email: <strong>${email}</strong>.</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
              <h3 style="color: #E31837; margin-top: 0;">Password Reset OTP</h3>
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 15px 0; color: #E31837;">
                ${otp}
              </p>
              <p style="color: #777;">This OTP is valid for 10 minutes.</p>
            </div>

            <p>Please enter this OTP in the app to proceed with resetting your password.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="mailto:dominoriderexpense@gmail.com" style="display: inline-block; padding: 10px 20px; background: #fff; border: 2px solid #006491; color: #006491; text-decoration: none; border-radius: 5px; font-weight: bold; transition: all 0.3s;">Contact Support</a>
            </div>

            <p>Best regards,<br>Adeel Ul Rehman 😇<br>The Domino's Rider Team</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center;">
              <p>Need help? <a href="mailto:dominoriderexpense@gmail.com" style="color: #006491; text-decoration: none;">Contact our support team</a></p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>© ${new Date().getFullYear()} Domino's Rider Expense System. All rights reserved.</p>
            </div>
          </div>
        </div>
      `,
      text: `
Domino's Rider Expense - Password Reset

Dear ${user.name},

We received a request to reset your password for your Domino's Rider Expense account with email: ${email}.

Password Reset OTP: ${otp}
This OTP is valid for 10 minutes.

Please enter this OTP in the app to proceed with resetting your password.

Need help? Contact: dominoriderexpense@gmail.com

Best regards,
Adeel Ul Rehman 😇
The Domino's Rider Team

If you didn't request this, please ignore this email.
© ${new Date().getFullYear()} Domino's Rider Expense System.
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    return res.json({ 
      success: true, 
      message: "Password reset OTP sent to email" 
    });
  } catch (error) {
    console.error('Reset OTP error:', error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to send reset OTP" 
    });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.resetOtpExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate newPassword: min 8 characters, at least one alphabet and one number
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one alphabet and one number",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.resetOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.resetOtpExpireAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpireAt = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};


export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, oldPassword, newPassword, employmentType, profilePicture } = req.body;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = {};

    if (name && name !== user.name) {
      updateData.name = name;
    }

    if (employmentType && employmentType !== user.employmentType) {
      if (!['PartTimer', 'FullTimer'].includes(employmentType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employment type",
        });
      }
      updateData.employmentType = employmentType;
      updateData.fixedSalary = employmentType === "FullTimer" ? 37000 : 18500;
    }

    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to set new password",
        });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]*$/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one alphabet and one number",
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (profilePicture) {
      if (!profilePicture.startsWith('data:image/')) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile picture format",
        });
      }
      updateData.profilePicture = profilePicture;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes provided",
      });
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password -verifyOtp -resetOtp');

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

export const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;
    const { profilePicture } = req.body;

    if (!profilePicture || !profilePicture.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing profile picture",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate base64 string size (max 5MB)
    const base64Size = Buffer.byteLength(profilePicture, 'base64') / (1024 * 1024);
    if (base64Size > 5) {
      return res.status(400).json({
        success: false,
        message: "Profile picture size must be 5MB or less",
      });
    }

    user.profilePicture = profilePicture;
    await user.save();

    const updatedUser = await userModel.findById(userId).select('-password -verifyOtp -resetOtp');
    return res.json({
      success: true,
      message: "Profile picture uploaded successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
    });
  }
};

export const removeProfilePicture = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to remove",
      });
    }

    user.profilePicture = null;
    await user.save();

    const updatedUser = await userModel.findById(userId).select('-password -verifyOtp -resetOtp');
    return res.json({
      success: true,
      message: "Profile picture removed successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error('Profile picture removal error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove profile picture",
    });
  }
};

// Delete Account Function
export const deleteAccount = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userId = req.userId;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.email !== email) {
      return res.status(401).json({
        success: false,
        message: "Email does not match your account",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // Delete related records
    await DailyRecord.deleteMany({ user_id: userId });
    await MonthlySummary.deleteMany({ user_id: userId });
    await userModel.findByIdAndDelete(userId);

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};

