function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  };
}

module.exports = { route };
