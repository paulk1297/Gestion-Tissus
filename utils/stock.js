// Fonctions de calcul du stock et des soldes, utilisées par plusieurs routes.
// Version MySQL (async/await, pool mysql2/promise).

// Stock des tissus NON COUSUS = quantités achetées - quantités envoyées en couture (statut != 'annule')
async function getStockNonCousu(pool) {
  const [lignes] = await pool.query(`
    SELECT
      combinaisons.qualite AS qualite,
      combinaisons.nom_tissu AS nom_tissu,
      COALESCE(achete.total, 0) AS total_achete,
      COALESCE(envoye.total, 0) AS total_envoye,
      ROUND(COALESCE(achete.total, 0) - COALESCE(envoye.total, 0), 3) AS stock_disponible
    FROM (
      SELECT qualite, nom_tissu FROM achats
      UNION
      SELECT qualite, COALESCE(nom_tissu, '') AS nom_tissu FROM commandes_couture WHERE nom_tissu IS NOT NULL AND nom_tissu != ''
    ) AS combinaisons
    LEFT JOIN (
      SELECT qualite, nom_tissu, SUM(quantite) AS total
      FROM achats
      GROUP BY qualite, nom_tissu
    ) AS achete ON achete.qualite = combinaisons.qualite AND achete.nom_tissu = combinaisons.nom_tissu
    LEFT JOIN (
      SELECT qualite, nom_tissu, SUM(quantite) AS total
      FROM commandes_couture
      WHERE statut != 'annule' AND nom_tissu IS NOT NULL AND nom_tissu != ''
      GROUP BY qualite, nom_tissu
    ) AS envoye ON envoye.qualite = combinaisons.qualite AND envoye.nom_tissu = combinaisons.nom_tissu
    ORDER BY combinaisons.qualite, combinaisons.nom_tissu
  `);
  return lignes;
}

// Stock des tissus COUSUS = quantités effectivement reçues des couturiers
// (quantite_recue, qui peut n'être qu'une partie d'une commande en cas de
// réception partielle) - quantités vendues. Une commande annulée ne compte
// jamais, même si une réception partielle avait déjà eu lieu avant son
// annulation (en pratique l'application empêche d'annuler une commande déjà
// partiellement reçue, mais on l'exclut ici par sécurité).
async function getStockCousu(pool) {
  const [lignes] = await pool.query(`
    SELECT
      combinaisons.qualite AS qualite,
      combinaisons.modele AS modele,
      COALESCE(recu.total, 0) AS total_recu,
      COALESCE(vendu.total, 0) AS total_vendu,
      ROUND(COALESCE(recu.total, 0) - COALESCE(vendu.total, 0), 3) AS stock_disponible
    FROM (
      SELECT qualite, modele FROM commandes_couture WHERE quantite_recue > 0 AND statut != 'annule'
      UNION
      SELECT qualite, modele FROM ventes
    ) AS combinaisons
    LEFT JOIN (
      SELECT qualite, modele, SUM(quantite_recue) AS total
      FROM commandes_couture
      WHERE quantite_recue > 0 AND statut != 'annule'
      GROUP BY qualite, modele
    ) AS recu ON recu.qualite = combinaisons.qualite AND recu.modele = combinaisons.modele
    LEFT JOIN (
      SELECT qualite, modele, SUM(quantite) AS total
      FROM ventes
      GROUP BY qualite, modele
    ) AS vendu ON vendu.qualite = combinaisons.qualite AND vendu.modele = combinaisons.modele
    ORDER BY combinaisons.qualite, combinaisons.modele
  `);
  return lignes;
}

async function getSoldesFournisseurs(pool) {
  const [lignes] = await pool.query(`
    SELECT f.id, f.nom,
      COALESCE(SUM(a.montant_total), 0) AS total_du,
      COALESCE(SUM(a.montant_paye), 0) AS total_paye,
      ROUND(COALESCE(SUM(a.montant_total), 0) - COALESCE(SUM(a.montant_paye), 0), 2) AS solde_du
    FROM fournisseurs f
    LEFT JOIN achats a ON a.fournisseur_id = f.id
    GROUP BY f.id, f.nom
    ORDER BY solde_du DESC
  `);
  return lignes;
}

async function getSoldesCouturiers(pool) {
  const [lignes] = await pool.query(`
    SELECT c.id, c.nom,
      COALESCE(SUM(cc.montant_total), 0) AS total_du,
      COALESCE(SUM(cc.montant_paye), 0) AS total_paye,
      ROUND(COALESCE(SUM(cc.montant_total), 0) - COALESCE(SUM(cc.montant_paye), 0), 2) AS solde_du
    FROM couturiers c
    LEFT JOIN commandes_couture cc ON cc.couturier_id = c.id AND cc.statut != 'annule'
    GROUP BY c.id, c.nom
    ORDER BY solde_du DESC
  `);
  return lignes;
}

async function getSoldesClients(pool) {
  const [lignes] = await pool.query(`
    SELECT cl.id, cl.nom,
      COALESCE(SUM(v.montant_total), 0) AS total_du,
      COALESCE(SUM(v.montant_paye), 0) AS total_paye,
      ROUND(COALESCE(SUM(v.montant_total), 0) - COALESCE(SUM(v.montant_paye), 0), 2) AS solde_du
    FROM clients cl
    LEFT JOIN ventes v ON v.client_id = cl.id
    GROUP BY cl.id, cl.nom
    ORDER BY solde_du DESC
  `);
  return lignes;
}

module.exports = {
  getStockNonCousu,
  getStockCousu,
  getSoldesFournisseurs,
  getSoldesCouturiers,
  getSoldesClients,
};
