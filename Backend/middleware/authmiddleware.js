const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      Message: "Authorization header is missing",
    });
  }
  const token = authHeader.split(" ")[1]; //What split(" ") does"Bearer ABC123"->["Bearer", "ABC123"]<-[1] = token
  try {
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    return res.status(401).json({
      Message: "Invalid or expired token",
    });
  }
}


module.exports={authMiddleware};