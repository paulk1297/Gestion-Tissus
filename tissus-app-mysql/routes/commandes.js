const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { getStockNonCousu } = require('../utils/stock');

const router = express.Router();

async function chargerCouturiers() {
  const [lignes] = await pool.query('SELECT * FROM couturiers ORDER BY nom');
  return lignes;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const statut = req.query.statut || '';
    let sql = `SELECT cc.*, c.nom AS couturier_nom FROM commandes_couture cc
               JOIN couturiers c ON c.id = cc.couturier_id`;
    const params = [];
    if (statut) {
      sql += ' WHERE cc.statut = ?';
      params.push(statut);
    }
    sql += ' ORDER BY cc.date_envoi DESC, cc.id DESC';
    const [lignes] = await pool.query(sql, params);
    res.render('commandes/liste', { lignes, statut });
  })
);

router.get(
  '/nouveau',
  asyncHandler(async (req, res) => {
    res.render('commandes/form', {
      item: null,
      couturiers: await chargerCouturiers(),
      stockDisponible: await getStockNonCousu(pool),
      erreur: null,
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const erreur = validerCommande(req.body);
    if (erreur) {
      return res.render('commandes/form', {
        item: req.body,
        couturiers: await chargerCouturiers(),
        stockDisponible: await getStockNonCousu(pool),
        erreur,
      });
    }
    const { couturier_id, qualite, nom_tissu, modele, prix_unitaire_couture, quantite, montant_paye, date_envoi, notes } =
      req.body;
    const montant_total = parseFloat(prix_unitaire_couture) * parseFloat(quantite);

    await pool.query(
      `INSERT INTO commandes_couture
        (couturier_id, qualite, nom_tissu, modele, prix_unitaire_couture, quantite, montant_total, montant_paye, statut, date_envoi, notes, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'envoye', ?, ?, ?)`,
      [
        couturier_id,
        qualite.trim(),
        (nom_tissu || '').trim() || null,
        modele.trim(),
        parseFloat(prix_unitaire_couture),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_envoi || new Date().toISOString().slice(0, 10),
        notes || null,
        req.session.user.id,
      ]
    );

    req.session.flash = { type: 'success', message: 'Commande de couture envoyée avec succès.' };
    res.redirect('/commandes');
  })
);

router.get(
  '/:id/modifier',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM commandes_couture WHERE id = ?', [req.params.id]);
    const item = lignes[0];
    if (!item) return res.status(404).send('Introuvable');
    res.render('commandes/form', {
      item,
      couturiers: await chargerCouturiers(),
      stockDisponible: await getStockNonCousu(pool),
      erreur: null,
    });
  })
);

router.post(
  '/:id',
  asyncHandler(async (req, res) => {
    const erreur = validerCommande(req.body);
    if (erreur) {
      return res.render('commandes/form', {
        item: { ...req.body, id: req.params.id },
        couturiers: await chargerCouturiers(),
        stockDisponible: await getStockNonCousu(pool),
        erreur,
      });
    }
    const { couturier_id, qualite, nom_tissu, modele, prix_unitaire_couture, quantite, montant_paye, date_envoi, notes } =
      req.body;
    const montant_total = parseFloat(prix_unitaire_couture) * parseFloat(quantite);

    await pool.query(
      `UPDATE commandes_couture SET couturier_id = ?, qualite = ?, nom_tissu = ?, modele = ?, prix_unitaire_couture = ?,
        quantite = ?, montant_total = ?, montant_paye = ?, date_envoi = ?, notes = ? WHERE id = ?`,
      [
        couturier_id,
        qualite.trim(),
        (nom_tissu || '').trim() || null,
        modele.trim(),
        parseFloat(prix_unitaire_couture),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_envoi,
        notes || null,
        req.params.id,
      ]
    );
    req.session.flash = { type: 'success', message: 'Commande mise à jour.' };
    res.redirect('/commandes');
  })
);

// Marquer une commande comme reçue (tissu cousu reçu du couturier) => alimente le stock cousu
router.post(
  '/:id/recevoir',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM commandes_couture WHERE id = ?', [req.params.id]);
    const commande = lignes[0];
    if (!commande) return res.status(404).send('Introuvable');
    if (commande.statut !== 'envoye') {
      req.session.flash = { type: 'danger', message: 'Seule une commande "envoyée" peut être marquée comme reçue.' };
      return res.redirect('/commandes');
    }
    await pool.query(`UPDATE commandes_couture SET statut = 'recu', date_reception = ? WHERE id = ?`, [
      req.body.date_reception || new Date().toISOString().slice(0, 10),
      req.params.id,
    ]);
    req.session.flash = {
      type: 'success',
      message: 'Commande marquée comme reçue : le stock de tissus cousus a été mis à jour.',
    };
    res.redirect('/commandes');
  })
);

router.post(
  '/:id/annuler',
  asyncHandler(async (req, res) => {
    await pool.query(`UPDATE commandes_couture SET statut = 'annule' WHERE id = ?`, [req.params.id]);
    req.session.flash = { type: 'success', message: 'Commande annulée.' };
    res.redirect('/commandes');
  })
);

router.post(
  '/:id/supprimer',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM commandes_couture WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: 'Commande supprimée.' };
    res.redirect('/commandes');
  })
);

function validerCommande(body) {
  const { couturier_id, qualite, modele, prix_unitaire_couture, quantite } = body;
  if (!couturier_id) return 'Veuillez choisir un couturier.';
  if (!qualite || !qualite.trim()) return 'La qualité est obligatoire.';
  if (!modele || !modele.trim()) return 'Le modèle est obligatoire.';
  if (!prix_unitaire_couture || isNaN(prix_unitaire_couture) || parseFloat(prix_unitaire_couture) <= 0)
    return 'Le prix unitaire de couture doit être un nombre positif.';
  if (!quantite || isNaN(quantite) || parseFloat(quantite) <= 0)
    return 'La quantité doit être un nombre positif.';
  return null;
}

module.exports = router;
