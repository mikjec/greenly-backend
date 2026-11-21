// A scheduler secret may run all accounts; a verified user may run only their own.
export const authorizeNotificationCron = (authenticate) => (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers["x-cron-secret"] || req.query.secret;
  if (secret && provided === secret) {
    req.cronUserId = null;
    return next();
  }
  return authenticate(req, res, () => {
    req.cronUserId = req.user.id;
    next();
  });
};
