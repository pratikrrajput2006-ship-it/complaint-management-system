function rolemiddleware(allowedroll) {
  return function (req, res, next) {
    if (req.user.role !== allowedroll) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
}

module.exports = { rolemiddleware };

module.exports = { rolemiddleware };
