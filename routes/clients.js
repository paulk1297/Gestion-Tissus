const pool = require('../db/connection');
const createAnnuaireRouter = require('../utils/annuaireRouter');

const router = createAnnuaireRouter({
  table: 'clients',
  vueDossier: 'clients',
  cheminBase: '/clients',
  titreSingulier: 'client',
  titrePluriel: 'clients',
  usageAvantSuppression: async (id) => {
    const [lignes] = await pool.query('SELECT COUNT(*) AS n FROM ventes WHERE client_id = ?', [id]);
    if (lignes[0].n > 0) return `Impossible de supprimer ce client : ${lignes[0].n} vente(s) lui sont liées.`;
    return null;
  },
});

module.exports = router;
