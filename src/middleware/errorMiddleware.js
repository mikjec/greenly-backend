export const notFound = (req, res, next) => {
  const error = new Error(`Nie znaleziono endpointu: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: err.message || "Wystąpił błąd serwera",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
