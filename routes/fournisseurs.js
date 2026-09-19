const pool = require('../db/connection');
const createAnnuaireRouter = require('../utils/annuaireRouter');

const router = createAnnuaireRouter({
  table: 'fournisseurs',
  vueDossier: 'fournisseurs',
  cheminBase: '/fournisseurs',
  titreSingulier: 'fournisseur',
  titrePluriel: 'fournisseurs',
  usageAvantSuppression: async (id) => {
    const [lignes] = await pool.query('SELECT COUNT(*) AS n FROM achats WHERE fournisseur_id = ?', [id]);
    if (lignes[0].n > 0) return `Impossible de supprimer ce fournisseur : ${lignes[0].n} achat(s) lui sont liés.`;
    return null;
  },
});

module.exports = router;
