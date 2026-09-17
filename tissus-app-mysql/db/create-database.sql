-- Script optionnel, à exécuter UNE FOIS avec un compte MySQL administrateur
-- (root, ou tout compte ayant le droit CREATE DATABASE / CREATE USER),
-- si vous préférez créer la base et un utilisateur dédié vous-même plutôt
-- que de laisser l'application le faire automatiquement au démarrage
-- (l'application n'a alors besoin d'aucun droit d'administration MySQL).
--
-- Utilisation :
--   mysql -u root -p < db/create-database.sql
-- (pensez à changer le mot de passe ci-dessous avant de l'exécuter)

CREATE DATABASE IF NOT EXISTS gestion_tissus
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'gestion_tissus'@'localhost' IDENTIFIED BY 'changez-ce-mot-de-passe';

GRANT ALL PRIVILEGES ON gestion_tissus.* TO 'gestion_tissus'@'localhost';

FLUSH PRIVILEGES;
