const authorize = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const userPermissions = req.user.permissions || [];

      const hasPermission = requiredPermissions.some(perm =>
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermissions,
          user: userPermissions
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

module.exports = { authorize };
