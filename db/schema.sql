-- Schéma de la base de données : Gestion Tissus
-- MySQL 8.0+ (ou MySQL 5.7 — voir remarques ci-dessous)

CREATE TABLE IF NOT EXISTS utilisateurs (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  nom             VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe    VARCHAR(255) NOT NULL,
  role            ENUM('admin', 'employe') NOT NULL DEFAULT 'employe',
  actif           TINYINT(1) NOT NULL DEFAULT 1,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fournisseurs (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  nom             VARCHAR(255) NOT NULL,
  lieu            VARCHAR(255),
  telephone       VARCHAR(50),
  whatsapp        VARCHAR(50),
  notes           TEXT,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS couturiers (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  nom             VARCHAR(255) NOT NULL,
  lieu            VARCHAR(255),
  telephone       VARCHAR(50),
  whatsapp        VARCHAR(50),
  notes           TEXT,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  nom             VARCHAR(255) NOT NULL,
  lieu            VARCHAR(255),
  telephone       VARCHAR(50),
  whatsapp        VARCHAR(50),
  notes           TEXT,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Achats de tissus NON COUSUS auprès des fournisseurs (entrée en stock non cousu)
CREATE TABLE IF NOT EXISTS achats (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  fournisseur_id      INT NOT NULL,
  qualite             VARCHAR(255) NOT NULL,
  nom_tissu           VARCHAR(255) NOT NULL,
  prix_unitaire       DECIMAL(12,2) NOT NULL,
  quantite            DECIMAL(12,3) NOT NULL,
  montant_total       DECIMAL(14,2) NOT NULL,
  montant_paye        DECIMAL(14,2) NOT NULL DEFAULT 0,
  date_achat          DATE NOT NULL,
  notes               TEXT,
  cree_par            INT,
  cree_le             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_achats_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
  CONSTRAINT fk_achats_utilisateur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_achats_fournisseur (fournisseur_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Commandes de couture envoyées aux couturiers
-- (sortie du stock non cousu à l'envoi, entrée en stock cousu à la réception)
CREATE TABLE IF NOT EXISTS commandes_couture (
  id                    INT PRIMARY KEY AUTO_INCREMENT,
  couturier_id          INT NOT NULL,
  qualite               VARCHAR(255) NOT NULL,
  nom_tissu             VARCHAR(255),
  modele                VARCHAR(255) NOT NULL,
  prix_unitaire_couture DECIMAL(12,2) NOT NULL,
  quantite              DECIMAL(12,3) NOT NULL,
  montant_total         DECIMAL(14,2) NOT NULL,
  montant_paye          DECIMAL(14,2) NOT NULL DEFAULT 0,
  statut                ENUM('envoye', 'recu', 'annule') NOT NULL DEFAULT 'envoye',
  date_envoi            DATE NOT NULL,
  date_reception        DATE,
  notes                 TEXT,
  cree_par              INT,
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commandes_couturier FOREIGN KEY (couturier_id) REFERENCES couturiers(id),
  CONSTRAINT fk_commandes_utilisateur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_commandes_couturier (couturier_id),
  INDEX idx_commandes_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ventes / livraisons de tissus COUSUS aux clients (sortie du stock cousu)
CREATE TABLE IF NOT EXISTS ventes (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  client_id           INT NOT NULL,
  qualite             VARCHAR(255) NOT NULL,
  modele              VARCHAR(255) NOT NULL,
  prix_unitaire_vente DECIMAL(12,2) NOT NULL,
  quantite            DECIMAL(12,3) NOT NULL,
  montant_total       DECIMAL(14,2) NOT NULL,
  montant_paye        DECIMAL(14,2) NOT NULL DEFAULT 0,
  date_vente          DATE NOT NULL,
  notes               TEXT,
  cree_par            INT,
  cree_le             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ventes_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_ventes_utilisateur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_ventes_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remarque MySQL 5.7 : ENGINE=InnoDB (par défaut) et ENUM sont supportés
-- depuis très longtemps ; ce schéma fonctionne donc aussi bien en 5.7 qu'en 8.x.
