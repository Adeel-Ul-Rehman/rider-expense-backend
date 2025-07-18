import jwt from 'jsonwebtoken';

const userAuth = async (req, res, next) => {
  const { token } = req.cookies;

  // Log request details for debugging
  console.log('Request URL:', req.originalUrl);
  console.log('Request Origin:', req.get('Origin'));
  console.log('Token received:', token ? 'Present' : 'Missing');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Not authorized - Please login first" 
    });
  }

  try {
    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
    
    // Log decoded token for debugging
    console.log('Decoded token:', tokenDecode);

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
    console.error('JWT Verification Error:', {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return res.status(401).json({ 
      success: false, 
      message: "Session expired - Please login again" 
    });
  }
};

export default userAuth;