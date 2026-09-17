const pool = require('../db/connection');
const createAnnuaireRouter = require('../utils/annuaireRouter');

const router = createAnnuaireRouter({
  table: 'couturiers',
  vueDossier: 'couturiers',
  cheminBase: '/couturiers',
  titreSingulier: 'couturier',
  titrePluriel: 'couturiers',
  usageAvantSuppression: async (id) => {
    const [lignes] = await pool.query('SELECT COUNT(*) AS n FROM commandes_couture WHERE couturier_id = ?', [id]);
    if (lignes[0].n > 0) return `Impossible de supprimer ce couturier : ${lignes[0].n} commande(s) lui sont liées.`;
    return null;
  },
});

module.exports = router;
