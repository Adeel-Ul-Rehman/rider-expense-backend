import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Not authorized - Please login first" 
    });
  }

  try {
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify token has required fields
    if (!tokenDecode?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format"
      });
    }

    // Attach to both req.user and req.userId for compatibility
    req.user = { id: tokenDecode.id };
    req.userId = tokenDecode.id;
    
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: "Session expired - Please login again" 
    });
  }
};

export default userAuth;