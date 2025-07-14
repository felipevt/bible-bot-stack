function apiKeyAuth(req, res, next) {
  const clientKey = req.headers['api-key'];
  const serverKey = process.env.API_KEY;

  if (!clientKey || clientKey !== serverKey) {
    return res.status(401).json({ error: 'Não autorizado: API key inválida ou faltando' });
  }

  next();
}

module.exports = apiKeyAuth;