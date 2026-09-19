const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

async function chargerFournisseurs() {
  const [lignes] = await pool.query('SELECT * FROM fournisseurs ORDER BY nom');
  return lignes;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query(
      `SELECT a.*, f.nom AS fournisseur_nom
       FROM achats a
       JOIN fournisseurs f ON f.id = a.fournisseur_id
       ORDER BY a.date_achat DESC, a.id DESC`
    );
    res.render('achats/liste', { lignes });
  })
);

router.get(
  '/nouveau',
  asyncHandler(async (req, res) => {
    res.render('achats/form', { item: null, fournisseurs: await chargerFournisseurs(), erreur: null });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { fournisseur_id, qualite, nom_tissu, prix_unitaire, quantite, montant_paye, date_achat, notes } = req.body;
    const erreur = validerAchat(req.body);
    if (erreur) {
      return res.render('achats/form', { item: req.body, fournisseurs: await chargerFournisseurs(), erreur });
    }
    const montant_total = parseFloat(prix_unitaire) * parseFloat(quantite);
    await pool.query(
      `INSERT INTO achats (fournisseur_id, qualite, nom_tissu, prix_unitaire, quantite, montant_total, montant_paye, date_achat, notes, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fournisseur_id,
        qualite.trim(),
        nom_tissu.trim(),
        parseFloat(prix_unitaire),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_achat || new Date().toISOString().slice(0, 10),
        notes || null,
        req.session.user.id,
      ]
    );
    req.session.flash = { type: 'success', message: 'Achat enregistré avec succès.' };
    res.redirect('/achats');
  })
);

router.get(
  '/:id/modifier',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM achats WHERE id = ?', [req.params.id]);
    const item = lignes[0];
    if (!item) return res.status(404).send('Introuvable');
    res.render('achats/form', { item, fournisseurs: await chargerFournisseurs(), erreur: null });
  })
);

router.post(
  '/:id',
  asyncHandler(async (req, res) => {
    const { fournisseur_id, qualite, nom_tissu, prix_unitaire, quantite, montant_paye, date_achat, notes } = req.body;
    const erreur = validerAchat(req.body);
    if (erreur) {
      return res.render('achats/form', {
        item: { ...req.body, id: req.params.id },
        fournisseurs: await chargerFournisseurs(),
        erreur,
      });
    }
    const montant_total = parseFloat(prix_unitaire) * parseFloat(quantite);
    await pool.query(
      `UPDATE achats SET fournisseur_id = ?, qualite = ?, nom_tissu = ?, prix_unitaire = ?, quantite = ?,
        montant_total = ?, montant_paye = ?, date_achat = ?, notes = ? WHERE id = ?`,
      [
        fournisseur_id,
        qualite.trim(),
        nom_tissu.trim(),
        parseFloat(prix_unitaire),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_achat,
        notes || null,
        req.params.id,
      ]
    );
    req.session.flash = { type: 'success', message: 'Achat mis à jour.' };
    res.redirect('/achats');
  })
);

router.post(
  '/:id/supprimer',
  asyncHandler(async (req, res) => {
    const [achatLignes] = await pool.query('SELECT nom_tissu FROM achats WHERE id = ?', [req.params.id]);
    let commandesLiees = 0;
    if (achatLignes[0]) {
      const [n] = await pool.query('SELECT COUNT(*) AS n FROM commandes_couture WHERE nom_tissu = ?', [
        achatLignes[0].nom_tissu,
      ]);
      commandesLiees = n[0].n;
    }
    await pool.query('DELETE FROM achats WHERE id = ?', [req.params.id]);
    req.session.flash = {
      type: 'success',
      message:
        commandesLiees > 0
          ? 'Achat supprimé. Vérifiez le stock : des commandes de couture référencent ce tissu.'
          : 'Achat supprimé.',
    };
    res.redirect('/achats');
  })
);

function validerAchat(body) {
  const { fournisseur_id, qualite, nom_tissu, prix_unitaire, quantite } = body;
  if (!fournisseur_id) return 'Veuillez choisir un fournisseur.';
  if (!qualite || !qualite.trim()) return 'La qualité est obligatoire.';
  if (!nom_tissu || !nom_tissu.trim()) return 'Le nom du tissu est obligatoire.';
  if (!prix_unitaire || isNaN(prix_unitaire) || parseFloat(prix_unitaire) <= 0)
    return 'Le prix unitaire doit être un nombre positif.';
  if (!quantite || isNaN(quantite) || parseFloat(quantite) <= 0)
    return 'La quantité doit être un nombre positif.';
  return null;
}

module.exports = router;
