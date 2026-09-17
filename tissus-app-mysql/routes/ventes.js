const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { getStockCousu } = require('../utils/stock');

const router = express.Router();

async function chargerClients() {
  const [lignes] = await pool.query('SELECT * FROM clients ORDER BY nom');
  return lignes;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query(
      `SELECT v.*, c.nom AS client_nom
       FROM ventes v
       JOIN clients c ON c.id = v.client_id
       ORDER BY v.date_vente DESC, v.id DESC`
    );
    res.render('ventes/liste', { lignes });
  })
);

router.get(
  '/nouveau',
  asyncHandler(async (req, res) => {
    res.render('ventes/form', { item: null, clients: await chargerClients(), stockDisponible: await getStockCousu(pool), erreur: null });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const erreur = validerVente(req.body);
    if (erreur) {
      return res.render('ventes/form', {
        item: req.body,
        clients: await chargerClients(),
        stockDisponible: await getStockCousu(pool),
        erreur,
      });
    }
    const { client_id, qualite, modele, prix_unitaire_vente, quantite, montant_paye, date_vente, notes } = req.body;
    const montant_total = parseFloat(prix_unitaire_vente) * parseFloat(quantite);

    await pool.query(
      `INSERT INTO ventes (client_id, qualite, modele, prix_unitaire_vente, quantite, montant_total, montant_paye, date_vente, notes, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_id,
        qualite.trim(),
        modele.trim(),
        parseFloat(prix_unitaire_vente),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_vente || new Date().toISOString().slice(0, 10),
        notes || null,
        req.session.user.id,
      ]
    );

    req.session.flash = { type: 'success', message: 'Vente enregistrée avec succès.' };
    res.redirect('/ventes');
  })
);

router.get(
  '/:id/modifier',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM ventes WHERE id = ?', [req.params.id]);
    const item = lignes[0];
    if (!item) return res.status(404).send('Introuvable');
    res.render('ventes/form', { item, clients: await chargerClients(), stockDisponible: await getStockCousu(pool), erreur: null });
  })
);

router.post(
  '/:id',
  asyncHandler(async (req, res) => {
    const erreur = validerVente(req.body);
    if (erreur) {
      return res.render('ventes/form', {
        item: { ...req.body, id: req.params.id },
        clients: await chargerClients(),
        stockDisponible: await getStockCousu(pool),
        erreur,
      });
    }
    const { client_id, qualite, modele, prix_unitaire_vente, quantite, montant_paye, date_vente, notes } = req.body;
    const montant_total = parseFloat(prix_unitaire_vente) * parseFloat(quantite);

    await pool.query(
      `UPDATE ventes SET client_id = ?, qualite = ?, modele = ?, prix_unitaire_vente = ?, quantite = ?,
        montant_total = ?, montant_paye = ?, date_vente = ?, notes = ? WHERE id = ?`,
      [
        client_id,
        qualite.trim(),
        modele.trim(),
        parseFloat(prix_unitaire_vente),
        parseFloat(quantite),
        montant_total,
        parseFloat(montant_paye) || 0,
        date_vente,
        notes || null,
        req.params.id,
      ]
    );
    req.session.flash = { type: 'success', message: 'Vente mise à jour.' };
    res.redirect('/ventes');
  })
);

router.post(
  '/:id/supprimer',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM ventes WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: 'Vente supprimée.' };
    res.redirect('/ventes');
  })
);

function validerVente(body) {
  const { client_id, qualite, modele, prix_unitaire_vente, quantite } = body;
  if (!client_id) return 'Veuillez choisir un client.';
  if (!qualite || !qualite.trim()) return 'La qualité est obligatoire.';
  if (!modele || !modele.trim()) return 'Le modèle est obligatoire.';
  if (!prix_unitaire_vente || isNaN(prix_unitaire_vente) || parseFloat(prix_unitaire_vente) <= 0)
    return 'Le prix unitaire de vente doit être un nombre positif.';
  if (!quantite || isNaN(quantite) || parseFloat(quantite) <= 0)
    return 'La quantité doit être un nombre positif.';
  return null;
}

module.exports = router;
