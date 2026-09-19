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
    const stockDisponible = await getStockNonCousu(pool);
    const erreur = validerCommande(req.body, stockDisponible, null);
    if (erreur) {
      return res.render('commandes/form', {
        item: req.body,
        couturiers: await chargerCouturiers(),
        stockDisponible,
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
    const [lignesActuelles] = await pool.query('SELECT * FROM commandes_couture WHERE id = ?', [req.params.id]);
    const commandeActuelle = lignesActuelles[0];
    const stockDisponible = await getStockNonCousu(pool);
    const erreur = validerCommande(req.body, stockDisponible, commandeActuelle);
    if (erreur) {
      return res.render('commandes/form', {
        item: { ...req.body, id: req.params.id },
        couturiers: await chargerCouturiers(),
        stockDisponible,
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

// Marquer une réception (totale ou partielle) du tissu cousu chez le
// couturier => alimente le stock cousu de la quantité effectivement reçue.
// Une commande peut être reçue en plusieurs fois : elle ne passe au statut
// "reçue" que lorsque le cumul des réceptions atteint la quantité commandée.
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

    const reste = Math.round((parseFloat(commande.quantite) - parseFloat(commande.quantite_recue)) * 1000) / 1000;
    const quantiteRecueSaisie = parseFloat(req.body.quantite_recue);
    const MARGE = 0.0005;
    if (isNaN(quantiteRecueSaisie) || quantiteRecueSaisie <= 0) {
      req.session.flash = { type: 'danger', message: 'Veuillez indiquer une quantité reçue valide.' };
      return res.redirect('/commandes');
    }
    if (quantiteRecueSaisie > reste + MARGE) {
      req.session.flash = {
        type: 'danger',
        message: `La quantité reçue (${quantiteRecueSaisie}) dépasse ce qu'il reste à recevoir sur cette commande (${reste}).`,
      };
      return res.redirect('/commandes');
    }

    const nouveauCumul = Math.round((parseFloat(commande.quantite_recue) + quantiteRecueSaisie) * 1000) / 1000;
    const complete = nouveauCumul >= parseFloat(commande.quantite) - MARGE;
    const nouveauStatut = complete ? 'recu' : 'envoye';

    await pool.query(
      `UPDATE commandes_couture SET quantite_recue = ?, statut = ?, date_reception = ? WHERE id = ?`,
      [nouveauCumul, nouveauStatut, req.body.date_reception || new Date().toISOString().slice(0, 10), req.params.id]
    );

    req.session.flash = complete
      ? { type: 'success', message: 'Commande marquée comme reçue : le stock de tissus cousus a été mis à jour.' }
      : {
          type: 'success',
          message: `Réception partielle enregistrée (${nouveauCumul} / ${commande.quantite} au total) : le stock de tissus cousus a été mis à jour.`,
        };
    res.redirect('/commandes');
  })
);

router.post(
  '/:id/annuler',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM commandes_couture WHERE id = ?', [req.params.id]);
    const commande = lignes[0];
    if (!commande) return res.status(404).send('Introuvable');
    if (parseFloat(commande.quantite_recue) > 0) {
      req.session.flash = {
        type: 'danger',
        message: 'Impossible d\'annuler une commande déjà partiellement ou totalement reçue.',
      };
      return res.redirect('/commandes');
    }
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

// Cherche le stock non cousu disponible pour une combinaison qualité/nom du
// tissu donnée dans le tableau renvoyé par getStockNonCousu().
function stockDisponiblePour(stockDisponible, qualite, nomTissu) {
  const ligne = stockDisponible.find((s) => s.qualite === qualite && s.nom_tissu === nomTissu);
  return ligne ? parseFloat(ligne.stock_disponible) : 0;
}

// Valide les champs de la commande et, si le nom du tissu envoyé est
// renseigné, vérifie que la quantité demandée ne dépasse pas le stock non
// cousu réellement disponible pour cet article (sans ce champ, la commande
// n'impacte pas le calcul détaillé du stock, donc aucun contrôle n'est
// possible ni nécessaire). `commandeActuelle` (uniquement en modification)
// permet de réintégrer la quantité de la commande en cours de modification,
// puisqu'elle est déjà déduite du stock calculé par getStockNonCousu() dès
// lors que son statut n'est pas "annulée".
function validerCommande(body, stockDisponible, commandeActuelle) {
  const { couturier_id, qualite, nom_tissu, modele, prix_unitaire_couture, quantite } = body;
  if (!couturier_id) return 'Veuillez choisir un couturier.';
  if (!qualite || !qualite.trim()) return 'La qualité est obligatoire.';
  if (!modele || !modele.trim()) return 'Le modèle est obligatoire.';
  if (!prix_unitaire_couture || isNaN(prix_unitaire_couture) || parseFloat(prix_unitaire_couture) <= 0)
    return 'Le prix unitaire de couture doit être un nombre positif.';
  if (!quantite || isNaN(quantite) || parseFloat(quantite) <= 0)
    return 'La quantité doit être un nombre positif.';
  if (commandeActuelle && parseFloat(quantite) < parseFloat(commandeActuelle.quantite_recue)) {
    return `La quantité commandée ne peut pas être inférieure à la quantité déjà reçue (${commandeActuelle.quantite_recue}).`;
  }

  const qualiteNettoyee = qualite.trim();
  const nomTissuNettoye = (nom_tissu || '').trim();
  if (nomTissuNettoye) {
    let disponible = stockDisponiblePour(stockDisponible, qualiteNettoyee, nomTissuNettoye);
    if (
      commandeActuelle &&
      commandeActuelle.statut !== 'annule' &&
      commandeActuelle.qualite === qualiteNettoyee &&
      (commandeActuelle.nom_tissu || '') === nomTissuNettoye
    ) {
      disponible += parseFloat(commandeActuelle.quantite);
    }
    if (parseFloat(quantite) > disponible) {
      return `Stock insuffisant : il ne reste que ${disponible} unité(s) disponible(s) pour "${qualiteNettoyee} / ${nomTissuNettoye}".`;
    }
  }

  return null;
}

module.exports = router;
