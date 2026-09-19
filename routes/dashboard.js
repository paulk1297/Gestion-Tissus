const express = require('express');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const {
  getStockNonCousu,
  getStockCousu,
  getSoldesFournisseurs,
  getSoldesCouturiers,
  getSoldesClients,
} = require('../utils/stock');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const stockNonCousu = await getStockNonCousu(pool);
    const stockCousu = await getStockCousu(pool);
    const soldesFournisseurs = await getSoldesFournisseurs(pool);
    const soldesCouturiers = await getSoldesCouturiers(pool);
    const soldesClients = await getSoldesClients(pool);

    const totalStockNonCousu = stockNonCousu.reduce((s, r) => s + r.stock_disponible, 0);
    const totalStockCousu = stockCousu.reduce((s, r) => s + r.stock_disponible, 0);
    const totalDuFournisseurs = soldesFournisseurs.reduce((s, r) => s + r.solde_du, 0);
    const totalDuCouturiers = soldesCouturiers.reduce((s, r) => s + r.solde_du, 0);
    const totalDuClients = soldesClients.reduce((s, r) => s + r.solde_du, 0);

    const [commandesEnCoursLignes] = await pool.query(
      `SELECT COUNT(*) AS n FROM commandes_couture WHERE statut = 'envoye'`
    );
    const commandesEnCours = commandesEnCoursLignes[0].n;

    const [chiffreAffairesLignes] = await pool.query(
      `SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes
       WHERE YEAR(date_vente) = YEAR(CURDATE()) AND MONTH(date_vente) = MONTH(CURDATE())`
    );
    const chiffreAffairesMois = chiffreAffairesLignes[0].total;

    const [dernieresVentes] = await pool.query(
      `SELECT v.*, c.nom AS client_nom FROM ventes v JOIN clients c ON c.id = v.client_id
       ORDER BY v.date_vente DESC, v.id DESC LIMIT 5`
    );

    const [dernieresCommandes] = await pool.query(
      `SELECT cc.*, c.nom AS couturier_nom FROM commandes_couture cc JOIN couturiers c ON c.id = cc.couturier_id
       ORDER BY cc.date_envoi DESC, cc.id DESC LIMIT 5`
    );

    const stockNonCousuFaible = stockNonCousu.filter((r) => r.stock_disponible <= 0);
    const stockCousuFaible = stockCousu.filter((r) => r.stock_disponible <= 0);

    res.render('dashboard', {
      totalStockNonCousu,
      totalStockCousu,
      totalDuFournisseurs,
      totalDuCouturiers,
      totalDuClients,
      commandesEnCours,
      chiffreAffairesMois,
      dernieresVentes,
      dernieresCommandes,
      stockNonCousuFaible,
      stockCousuFaible,
    });
  })
);

module.exports = router;
