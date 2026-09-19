// Initialise la base de données MySQL : crée la base (si les droits le
// permettent), crée les tables si besoin, et crée le compte administrateur
// par défaut au tout premier démarrage.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { toutesLesPermissions } = require('../utils/modules');

async function creerBaseSiBesoin() {
  const nomBase = process.env.DB_NAME || 'gestion_tissus';
  const connexion = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'gestion_tissus',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    await connexion.query(
      `CREATE DATABASE IF NOT EXISTS \`${nomBase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connexion.end();
  }
}

function decouperInstructionsSql(sql) {
  // Retire les lignes de commentaire ("-- ...") puis découpe sur les points-virgules.
  const sansCommentaires = sql
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n');

  return sansCommentaires
    .split(';')
    .map((instruction) => instruction.trim())
    .filter((instruction) => instruction.length > 0);
}

// Migration : ajoute la colonne "permissions" si elle n'existe pas encore
// (base créée avant l'ajout de la gestion des droits par employé), et
// accorde l'accès à tous les modules aux employés déjà existants pour ne
// pas leur couper l'accès du jour au lendemain — l'administrateur pourra
// ensuite restreindre chacun individuellement depuis "Utilisateurs".
async function migrerColonnePermissions(pool) {
  const [colonnes] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateurs' AND COLUMN_NAME = 'permissions'`
  );
  if (colonnes[0].n === 0) {
    console.log('Migration : ajout de la colonne "permissions" à la table utilisateurs...');
    await pool.query('ALTER TABLE utilisateurs ADD COLUMN permissions VARCHAR(500) AFTER role');
  }

  await pool.query(
    `UPDATE utilisateurs SET permissions = ? WHERE role = 'employe' AND (permissions IS NULL OR permissions = '')`,
    [toutesLesPermissions()]
  );
}

// Migration : ajoute la colonne "quantite_recue" si elle n'existe pas encore
// (base créée avant la gestion des réceptions partielles), et pour les
// commandes déjà marquées "reçue" avant cette mise à jour, considère
// qu'elles ont été reçues en totalité (comportement identique à avant).
async function migrerColonneQuantiteRecue(pool) {
  const [colonnes] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commandes_couture' AND COLUMN_NAME = 'quantite_recue'`
  );
  if (colonnes[0].n === 0) {
    console.log('Migration : ajout de la colonne "quantite_recue" à la table commandes_couture...');
    await pool.query('ALTER TABLE commandes_couture ADD COLUMN quantite_recue DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER quantite');
  }

  await pool.query(`UPDATE commandes_couture SET quantite_recue = quantite WHERE statut = 'recu'`);
}

async function init() {
  try {
    await creerBaseSiBesoin();
  } catch (e) {
    console.warn(
      "Avertissement : impossible de créer automatiquement la base de données " +
        `("${e.message}"). Si elle existe déjà (créée manuellement via ` +
        'db/create-database.sql par exemple), vous pouvez ignorer ce message.'
    );
  }

  // Chargé après la création de la base, pour être sûr qu'elle existe déjà
  // quand le pool de connexions s'en sert.
  const pool = require('./connection');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const instructions = decouperInstructionsSql(schema);
  for (const instruction of instructions) {
    await pool.query(instruction);
  }

  await migrerColonnePermissions(pool);
  await migrerColonneQuantiteRecue(pool);

  const [lignes] = await pool.query('SELECT COUNT(*) AS n FROM utilisateurs');
  if (lignes[0].n === 0) {
    const nom = process.env.ADMIN_NOM || 'Administrateur';
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const motDePasse = process.env.ADMIN_PASSWORD || 'admin1234';
    const hash = bcrypt.hashSync(motDePasse, 10);

    await pool.query(
      'INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif) VALUES (?, ?, ?, ?, 1)',
      [nom, email, hash, 'admin']
    );

    console.log('----------------------------------------------------');
    console.log('Compte administrateur créé :');
    console.log('  Email        :', email);
    console.log('  Mot de passe :', motDePasse);
    console.log('Merci de changer ce mot de passe après la première connexion.');
    console.log('----------------------------------------------------');
  } else {
    console.log('Base de données déjà initialisée (utilisateurs existants).');
  }
}

if (require.main === module) {
  init()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Erreur lors de l'initialisation de la base de données :", err);
      process.exit(1);
    });
}

module.exports = init;
