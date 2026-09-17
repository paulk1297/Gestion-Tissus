// Express 4 ne capture pas automatiquement les erreurs des gestionnaires de
// route "async" : une promesse rejetée non gérée resterait silencieuse (ou
// ferait planter le processus). Cet utilitaire enveloppe un gestionnaire
// async et transmet toute erreur à next(), pour qu'elle arrive jusqu'au
// middleware de gestion d'erreurs de server.js.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
