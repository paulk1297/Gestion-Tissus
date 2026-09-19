function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.session.flash = { type: 'danger', message: "Accès réservé à l'administrateur." };
  return res.redirect('/');
}

// Restreint l'accès à un module (fournisseurs, achats, ventes, ...) : un
// administrateur a toujours accès à tout ; un employé doit avoir ce module
// dans sa liste de permissions.
function requirePermission(module) {
  return function (req, res, next) {
    const utilisateur = req.session && req.session.user;
    if (!utilisateur) return res.redirect('/login');
    if (utilisateur.role === 'admin') return next();
    if (Array.isArray(utilisateur.permissions) && utilisateur.permissions.includes(module)) {
      return next();
    }
    req.session.flash = { type: 'danger', message: "Vous n'avez pas accès à cette section. Contactez l'administrateur." };
    return res.redirect('/');
  };
}

// Rend l'utilisateur courant et le message flash disponibles dans toutes les vues
function exposeLocals(req, res, next) {
  res.locals.currentUser = (req.session && req.session.user) || null;
  res.locals.flash = (req.session && req.session.flash) || null;
  if (req.session) req.session.flash = null;
  next();
}

module.exports = { requireAuth, requireAdmin, requirePermission, exposeLocals };
