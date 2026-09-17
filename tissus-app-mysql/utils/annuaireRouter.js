// Générateur de routes CRUD pour les "annuaires" (fournisseurs, couturiers, clients)
// qui partagent tous les mêmes champs : nom, lieu, téléphone, whatsapp, notes.
// Version MySQL (async/await).
const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('./asyncHandler');

/**
 * @param {object} options
 * @param {string} options.table - nom de la table SQL (fournisseurs | couturiers | clients)
 * @param {string} options.vueDossier - dossier de vues (fournisseurs | couturiers | clients)
 * @param {string} options.cheminBase - chemin de base de l'URL (/fournisseurs | /couturiers | /clients)
 * @param {string} options.titreSingulier - ex: "fournisseur"
 * @param {string} options.titrePluriel - ex: "fournisseurs"
 * @param {function} [options.usageAvantSuppression] - fonction async(id) => string|null, retourne un message si l'entité est utilisée ailleurs
 */
function createAnnuaireRouter(options) {
  const { table, vueDossier, titreSingulier, titrePluriel, usageAvantSuppression } = options;
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const recherche = (req.query.q || '').trim();
      let lignes;
      if (recherche) {
        const motif = `%${recherche}%`;
        [lignes] = await pool.query(
          `SELECT * FROM ${table} WHERE nom LIKE ? OR lieu LIKE ? OR telephone LIKE ? ORDER BY nom`,
          [motif, motif, motif]
        );
      } else {
        [lignes] = await pool.query(`SELECT * FROM ${table} ORDER BY nom`);
      }
      res.render(`${vueDossier}/liste`, { lignes, recherche, titreSingulier, titrePluriel });
    })
  );

  router.get('/nouveau', (req, res) => {
    res.render(`${vueDossier}/form`, { item: null, titreSingulier, titrePluriel, erreur: null });
  });

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { nom, lieu, telephone, whatsapp, notes } = req.body;
      if (!nom || !nom.trim()) {
        return res.render(`${vueDossier}/form`, {
          item: req.body,
          titreSingulier,
          titrePluriel,
          erreur: 'Le nom est obligatoire.',
        });
      }
      await pool.query(`INSERT INTO ${table} (nom, lieu, telephone, whatsapp, notes) VALUES (?, ?, ?, ?, ?)`, [
        nom.trim(),
        lieu || null,
        telephone || null,
        whatsapp || null,
        notes || null,
      ]);
      req.session.flash = { type: 'success', message: `${capitaliser(titreSingulier)} ajouté avec succès.` };
      res.redirect(options.cheminBase);
    })
  );

  router.get(
    '/:id/modifier',
    asyncHandler(async (req, res) => {
      const [lignes] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      const item = lignes[0];
      if (!item) return res.status(404).send('Introuvable');
      res.render(`${vueDossier}/form`, { item, titreSingulier, titrePluriel, erreur: null });
    })
  );

  router.post(
    '/:id',
    asyncHandler(async (req, res) => {
      const { nom, lieu, telephone, whatsapp, notes } = req.body;
      if (!nom || !nom.trim()) {
        return res.render(`${vueDossier}/form`, {
          item: { ...req.body, id: req.params.id },
          titreSingulier,
          titrePluriel,
          erreur: 'Le nom est obligatoire.',
        });
      }
      await pool.query(`UPDATE ${table} SET nom = ?, lieu = ?, telephone = ?, whatsapp = ?, notes = ? WHERE id = ?`, [
        nom.trim(),
        lieu || null,
        telephone || null,
        whatsapp || null,
        notes || null,
        req.params.id,
      ]);
      req.session.flash = { type: 'success', message: `${capitaliser(titreSingulier)} mis à jour.` };
      res.redirect(options.cheminBase);
    })
  );

  router.post(
    '/:id/supprimer',
    asyncHandler(async (req, res) => {
      if (usageAvantSuppression) {
        const message = await usageAvantSuppression(req.params.id);
        if (message) {
          req.session.flash = { type: 'danger', message };
          return res.redirect(options.cheminBase);
        }
      }
      try {
        await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
        req.session.flash = { type: 'success', message: `${capitaliser(titreSingulier)} supprimé.` };
      } catch (e) {
        req.session.flash = {
          type: 'danger',
          message: `Impossible de supprimer : cet élément est utilisé ailleurs dans l'application.`,
        };
      }
      res.redirect(options.cheminBase);
    })
  );

  return router;
}

function capitaliser(mot) {
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

module.exports = createAnnuaireRouter;
