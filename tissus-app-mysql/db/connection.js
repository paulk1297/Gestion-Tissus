require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool de connexions MySQL, réutilisé partout dans l'application.
// - dateStrings: true   -> les colonnes DATE/DATETIME sont renvoyées comme
//   chaînes "AAAA-MM-JJ" (comme le faisait SQLite), pratique pour les
//   champs <input type="date"> et l'affichage direct dans les vues.
// - decimalNumbers: true -> les colonnes DECIMAL sont renvoyées comme
//   nombres JavaScript plutôt que comme chaînes, pour pouvoir faire des
//   calculs directement (montant_total - montant_paye, toFixed, etc.)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'gestion_tissus',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_tissus',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
});

module.exports = pool;
