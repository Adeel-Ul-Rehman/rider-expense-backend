import userModel from "../models/userModels.js";

export const getUserData = async (req, res) => {
  try {
    const userId = req.userId; // Set by userAuth middleware
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID not provided" });
    }
    const user = await userModel
      .findById(userId)
      .select("-password -verifyOtp -resetOtp");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({
      success: true,
      user: {
        id: user._id, // Match frontend expected field name
        name: user.name,
        email: user.email,
        employmentType: user.employmentType,
        isAccountVerified: user.isAccountVerified,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("getUserData error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
