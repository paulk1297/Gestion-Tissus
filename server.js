require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const initDb = require('./db/init');
const { requireAuth, requireAdmin, requirePermission, exposeLocals } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'changez-cette-cle-secrete',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 12, // 12 heures
    },
  })
);

app.use(exposeLocals);

// Routes publiques (connexion)
app.use('/', require('./routes/auth'));

// Tout le reste nécessite d'être connecté. Le tableau de bord reste visible
// par tous les utilisateurs connectés (vue d'ensemble en lecture seule) ;
// chaque autre section nécessite la permission du module correspondant
// (un administrateur passe toujours ces vérifications).
app.use('/', requireAuth, require('./routes/dashboard'));
app.use('/fournisseurs', requireAuth, requirePermission('fournisseurs'), require('./routes/fournisseurs'));
app.use('/couturiers', requireAuth, requirePermission('couturiers'), require('./routes/couturiers'));
app.use('/clients', requireAuth, requirePermission('clients'), require('./routes/clients'));
app.use('/achats', requireAuth, requirePermission('achats'), require('./routes/achats'));
app.use('/commandes', requireAuth, requirePermission('commandes'), require('./routes/commandes'));
app.use('/ventes', requireAuth, requirePermission('ventes'), require('./routes/ventes'));
app.use('/stock', requireAuth, requirePermission('stock'), require('./routes/stock'));
app.use('/utilisateurs', requireAuth, requireAdmin, require('./routes/users'));

// 404
app.use((req, res) => {
  res.status(404).render('404');
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Une erreur est survenue. Consultez les journaux du serveur pour plus de détails.');
});

// La base de données MySQL doit être prête (tables créées, admin initial créé)
// avant d'accepter des requêtes.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Plateforme Gestion Tissus démarrée : http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Impossible d'initialiser la base de données MySQL :", err);
    process.exit(1);
  });
