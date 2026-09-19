# Gestion Tissus — Plateforme d'achat, couture, vente et stock (version MySQL)

Cette version utilise **MySQL** comme base de données au lieu de SQLite —
mêmes fonctionnalités, mêmes pages, mais adaptée à un serveur de base de
données séparé et à un usage multi-utilisateurs plus soutenu.

Application web complète pour gérer un commerce de tissus cousus :
achat de tissus non cousus auprès de fournisseurs, envoi en couture chez des
couturiers, vente des tissus cousus aux clients, et suivi du stock à chaque
étape.

## Fonctionnalités

- **Annuaires** : fournisseurs, couturiers, clients (nom, lieu, téléphone, WhatsApp).
- **Achats** : tissus non cousus achetés chez un fournisseur (qualité, nom du
  tissu, prix unitaire, quantité), avec suivi du montant payé / solde dû.
- **Commandes de couture** : tissus envoyés à un couturier (qualité, modèle,
  prix unitaire de couture, quantité), avec statut *envoyée → reçue → annulée*
  et suivi du montant payé / solde dû.
- **Ventes** : tissus cousus livrés/vendus à un client (qualité, modèle, prix
  unitaire de vente, quantité), avec suivi du montant payé / solde dû.
- **Stock tissus non cousus** = total acheté − total envoyé en couture.
- **Stock tissus cousus** = total reçu des couturiers − total vendu.
- **Tableau de bord** avec indicateurs clés, alertes de stock, soldes dus.
- **Multi-utilisateurs** : plusieurs employés peuvent se connecter en même
  temps, avec deux rôles (Administrateur / Employé).

## Comment le stock est calculé (important à comprendre)

1. Un **achat** augmente le stock du tissu non cousu correspondant
   (identifié par *qualité + nom du tissu*).
2. Une **commande de couture** correspond à l'envoi de tissu non cousu chez
   un couturier : si vous renseignez le champ optionnel « Nom du tissu
   envoyé » (avec la même valeur que lors de l'achat), la quantité est
   déduite précisément du stock non cousu correspondant. Sans ce champ, la
   commande n'impacte pas le calcul détaillé du stock non cousu (mais reste
   comptabilisée normalement pour le couturier et les paiements).
3. Quand vous cliquez sur **« Marquer reçue »** sur une commande, la quantité
   correspondante (identifiée par *qualité + modèle*) est ajoutée au stock de
   tissus cousus.
4. Une **vente** déduit la quantité vendue du stock de tissus cousus
   correspondant (*qualité + modèle*).

Astuce : utilisez toujours les mêmes libellés de « qualité », « nom du
tissu » et « modèle » d'une saisie à l'autre (ex. toujours « Bazin riche »,
pas parfois « bazin riche » ou « Bazin Riche »), sinon l'application les
traitera comme des articles différents dans les tableaux de stock.

## Prérequis

- [Node.js](https://nodejs.org) version 18 ou supérieure (recommandé : 20 LTS).
- npm (installé avec Node.js).
- **Un serveur MySQL 5.7+ ou 8.x accessible** (local, sur le même serveur, ou distant).
  Si vous n'en avez pas déjà un, l'option Docker ci-dessous en installe un
  automatiquement pour vous.
- Un accès Internet le temps de l'installation des dépendances (`npm install`).

## Configuration MySQL

Cette version de l'application utilise **MySQL** au lieu de SQLite pour le
stockage des données (utile si vous avez déjà un serveur MySQL, ou si vous
préférez une base de données centralisée séparée de l'application).

Deux façons de préparer la base de données :

1. **Automatique (par défaut)** : au premier démarrage, l'application essaie
   de créer elle-même la base de données (si l'utilisateur MySQL renseigné
   dans `.env` en a le droit), puis crée les tables et le compte
   administrateur. C'est le plus simple pour démarrer rapidement.

2. **Manuelle (recommandé en production)** : demandez à votre administrateur
   MySQL (ou faites-le vous-même avec un compte `root`) d'exécuter une fois
   le script fourni, qui crée la base et un utilisateur dédié avec des droits
   limités à cette seule base :
   ```bash
   mysql -u root -p < db/create-database.sql
   ```
   (pensez à changer le mot de passe dans ce fichier avant de l'exécuter).
   L'application n'a alors besoin d'aucun droit d'administration MySQL.

Dans les deux cas, renseignez ensuite dans `.env` : `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Installation en local

```bash
# 1. Décompressez le projet puis placez-vous dans le dossier
cd tissus-app-mysql

# 2. Installez les dépendances
npm install

# 3. Copiez le fichier d'exemple de configuration
cp .env.example .env
# puis éditez .env : SESSION_SECRET, accès MySQL (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME), identifiants admin

# 4. Démarrez l'application (crée les tables et le compte admin au premier lancement)
npm start
```

L'application est alors accessible sur **http://localhost:3000**.

Au premier démarrage, un compte administrateur est créé automatiquement avec
l'email et le mot de passe définis dans `.env` (`ADMIN_EMAIL` /
`ADMIN_PASSWORD`). Connectez-vous puis changez ce mot de passe depuis
« Mon compte », et créez des comptes employés depuis le menu
« Utilisateurs ».

## Déploiement en production

L'application est un serveur Node.js classique (Express) qui se connecte à
un serveur MySQL séparé. Il vous faut donc un serveur MySQL accessible en
plus du serveur Node.js (les deux peuvent être sur la même machine).

### Option A — VPS (Ubuntu/Debian) avec MySQL local + PM2

```bash
# Sur le serveur
sudo apt update && sudo apt install -y nodejs npm mysql-server
npm install -g pm2

# Sécurisez et configurez MySQL (une seule fois)
sudo mysql_secure_installation
sudo mysql -u root -p < /var/www/tissus-app-mysql/db/create-database.sql

cd /var/www/tissus-app-mysql
npm install --omit=dev
cp .env.example .env   # puis éditez .env (DB_HOST=localhost, DB_USER/DB_PASSWORD comme dans create-database.sql)

pm2 start server.js --name gestion-tissus
pm2 save
pm2 startup   # pour redémarrer automatiquement au reboot du serveur
```

Mettez ensuite un reverse proxy **Nginx** devant l'application (port 3000)
pour servir le site en HTTPS avec un nom de domaine, par exemple avec
[Certbot](https://certbot.eff.org/) pour le certificat SSL gratuit.

Une configuration prête à l'emploi pour le domaine **tissus.elisasalut.com**
est fournie dans `nginx/tissus.elisasalut.com.conf` (avec redirection HTTP →
HTTPS et instructions d'installation en commentaire en haut du fichier).
Pour un autre domaine, remplacez simplement `tissus.elisasalut.com` par le
vôtre dans ce fichier.

### Option B — Plateformes d'hébergement (Render, Railway, etc.)

1. Poussez le projet sur un dépôt Git (GitHub/GitLab).
2. Créez un service de base de données **MySQL** géré sur la plateforme (la
   plupart des plateformes citées en proposent un en un clic), et notez ses
   informations de connexion (hôte, port, utilisateur, mot de passe, nom de
   base).
3. Créez un nouveau service « Web Service » Node.js pour l'application.
4. Commande de build : `npm install`. Commande de démarrage : `npm start`.
5. Définissez les variables d'environnement du fichier `.env.example` dans les
   paramètres du service (avec les informations de connexion MySQL de
   l'étape 2). Le disque de l'application peut être éphémère sans problème
   ici : toutes les données vivent dans MySQL, pas sur le disque de
   l'application.

### Option C — Docker (application + MySQL ensemble)

Un `docker-compose.yml` est fourni : il démarre à la fois l'application et
un serveur MySQL, avec les données MySQL conservées dans un volume Docker.

```bash
cp .env.example .env   # puis éditez .env si besoin (mots de passe, etc.)
docker compose up -d --build
```

L'application est accessible sur **http://localhost:3000**. Pour ne
construire que l'image de l'application seule (en pointant vers un MySQL
externe déjà existant) :

```bash
docker build -t gestion-tissus .
docker run -d -p 3000:3000 --env-file .env --name gestion-tissus gestion-tissus
```

## Sauvegarde des données

Toutes les données vivent dans MySQL. Pour sauvegarder, utilisez `mysqldump` :

```bash
mysqldump -u gestion_tissus -p gestion_tissus > sauvegarde-$(date +%F).sql
```

(avec Docker Compose : `docker compose exec mysql mysqldump -u gestion_tissus -p gestion_tissus > sauvegarde-$(date +%F).sql`)

Il est recommandé d'automatiser cette commande quotidiennement (cron) et de
copier les sauvegardes ailleurs (cloud, autre disque). Pour restaurer :

```bash
mysql -u gestion_tissus -p gestion_tissus < sauvegarde-2026-01-01.sql
```

## Utilisateurs, rôles et droits d'accès

- **Administrateur** : accès à tout, y compris la gestion des utilisateurs
  (menu « Utilisateurs »), et ne peut pas être restreint.
- **Employé** : accès limité aux modules qui lui sont explicitement accordés.
  Depuis le menu « Utilisateurs » (réservé aux administrateurs), pour chaque
  employé, vous cochez individuellement les modules auxquels il a droit parmi :
  Fournisseurs, Couturiers, Clients, Achats, Commandes de couture, Ventes et
  Consultation du stock. Un employé sans aucun module coché ne voit que le
  tableau de bord. Les droits d'un employé peuvent être différents de ceux
  d'un autre — il n'y a plus un seul niveau d'accès « employé » unique.
- Migration automatique : si vous mettez à jour une installation existante,
  tous les employés déjà créés conservent automatiquement l'accès à tous les
  modules au premier redémarrage après la mise à jour (rien n'est coupé sans
  action de votre part). Vous pouvez ensuite restreindre chacun individuellement
  depuis « Utilisateurs » → « Modifier ».
- Si un employé est déjà connecté au moment où vous modifiez ses droits, le
  changement ne prend effet qu'à sa prochaine connexion (il doit se
  déconnecter puis se reconnecter).
- Depuis la page « Modifier » d'un utilisateur, vous pouvez aussi réinitialiser
  son mot de passe (champ « Nouveau mot de passe », à laisser vide pour ne pas
  le changer).

Plusieurs employés peuvent utiliser l'application simultanément : MySQL gère
nativement les accès concurrents, y compris pour une équipe plus importante
ou plusieurs boutiques (contrairement à la version SQLite de l'application,
plutôt adaptée à une petite équipe).

## Sécurité

- Changez impérativement `SESSION_SECRET` dans `.env` avant la mise en
  production (n'importe quelle longue chaîne aléatoire).
- Changez le mot de passe administrateur par défaut dès la première connexion.
- Servez toujours l'application en HTTPS en production (voir Nginx/Certbot
  ci-dessus, ou HTTPS automatique fourni par votre hébergeur).
- Les mots de passe sont stockés hachés (bcrypt), jamais en clair.

## Structure du projet

```
tissus-app-mysql/
├── server.js               # point d'entrée de l'application
├── docker-compose.yml       # application + MySQL, pour un démarrage rapide
├── db/
│   ├── schema.sql           # définition des tables (DDL MySQL)
│   ├── create-database.sql  # script optionnel : créer la base + un utilisateur dédié
│   ├── connection.js        # pool de connexions MySQL (mysql2/promise)
│   └── init.js              # création de la base/des tables + compte admin initial
├── middleware/auth.js        # authentification et rôles
├── routes/                   # une route par entité (fournisseurs, achats, ventes, ...)
├── utils/
│   ├── stock.js              # calculs de stock et de soldes (requêtes MySQL)
│   ├── annuaireRouter.js     # routes CRUD réutilisées pour fournisseurs/couturiers/clients
│   └── asyncHandler.js       # capture les erreurs des routes async pour Express 4
├── views/                    # pages EJS (HTML) + Bootstrap 5
└── public/css/style.css      # styles additionnels
```

## Limites connues / pistes d'amélioration

- Le rapprochement du stock repose sur une correspondance textuelle exacte
  entre les champs « qualité », « nom du tissu » et « modèle » saisis à
  chaque étape ; une liste déroulante de tissus/modèles prédéfinis pourrait
  fiabiliser encore davantage la saisie.
- Les sessions de connexion sont actuellement stockées en mémoire : un
  redémarrage du serveur déconnecte tous les utilisateurs (sans perte de
  données). Pour l'éviter en production, un stockage de session persistant
  (ex. base de données) peut être ajouté.
- Pas encore d'export Excel/PDF des rapports : peut être ajouté ultérieurement.
