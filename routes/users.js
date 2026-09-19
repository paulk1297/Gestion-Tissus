const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const { MODULES, serialiserPermissions, parsePermissions } = require('../utils/modules');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [utilisateurs] = await pool.query(
      'SELECT id, nom, email, role, permissions, actif, cree_le FROM utilisateurs ORDER BY nom'
    );
    utilisateurs.forEach((u) => {
      u.permissionsListe = u.role === 'admin' ? null : parsePermissions(u.permissions);
    });
    res.render('users/liste', { utilisateurs, MODULES });
  })
);

router.get('/nouveau', (req, res) => {
  res.render('users/form', { item: null, MODULES, permissionsActuelles: [], erreur: null });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nom, email, mot_de_passe, role } = req.body;
    const permissionsChoisies = [].concat(req.body.permissions || []);
    if (!nom || !email || !mot_de_passe || mot_de_passe.length < 6) {
      return res.render('users/form', {
        item: null,
        MODULES,
        permissionsActuelles: permissionsChoisies,
        erreur: 'Tous les champs sont obligatoires et le mot de passe doit contenir au moins 6 caractères.',
      });
    }
    const [existants] = await pool.query('SELECT id FROM utilisateurs WHERE email = ?', [
      email.trim().toLowerCase(),
    ]);
    if (existants.length > 0) {
      return res.render('users/form', {
        item: null,
        MODULES,
        permissionsActuelles: permissionsChoisies,
        erreur: 'Un utilisateur avec cet email existe déjà.',
      });
    }
    const hash = bcrypt.hashSync(mot_de_passe, 10);
    const roleFinal = role === 'admin' ? 'admin' : 'employe';
    await pool.query(
      'INSERT INTO utilisateurs (nom, email, mot_de_passe, role, permissions, actif) VALUES (?, ?, ?, ?, ?, 1)',
      [nom.trim(), email.trim().toLowerCase(), hash, roleFinal, serialiserPermissions(permissionsChoisies)]
    );
    req.session.flash = { type: 'success', message: 'Utilisateur créé avec succès.' };
    res.redirect('/utilisateurs');
  })
);

router.get(
  '/:id/modifier',
  asyncHandler(async (req, res) => {
    const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [req.params.id]);
    const item = lignes[0];
    if (!item) return res.status(404).send('Introuvable');
    res.render('users/form', {
      item,
      MODULES,
      permissionsActuelles: parsePermissions(item.permissions),
      erreur: null,
    });
  })
);

router.post(
  '/:id',
  asyncHandler(async (req, res) => {
    const { nom, email, role, nouveau_mot_de_passe } = req.body;
    const permissionsChoisies = [].concat(req.body.permissions || []);
    const cible = parseInt(req.params.id, 10);

    if (!nom || !nom.trim() || !email || !email.trim()) {
      const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [req.params.id]);
      return res.render('users/form', {
        item: lignes[0],
        MODULES,
        permissionsActuelles: permissionsChoisies,
        erreur: 'Le nom et l\'email sont obligatoires.',
      });
    }

    const [existants] = await pool.query('SELECT id FROM utilisateurs WHERE email = ? AND id != ?', [
      email.trim().toLowerCase(),
      cible,
    ]);
    if (existants.length > 0) {
      const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [req.params.id]);
      return res.render('users/form', {
        item: lignes[0],
        MODULES,
        permissionsActuelles: permissionsChoisies,
        erreur: 'Un autre utilisateur utilise déjà cet email.',
      });
    }

    let roleFinal = role === 'admin' ? 'admin' : 'employe';
    if (cible === req.session.user.id && roleFinal !== 'admin') {
      // Un administrateur ne peut pas se retirer lui-même son propre rôle
      // (pour éviter de se retrouver bloqué hors de la gestion des utilisateurs).
      roleFinal = 'admin';
      req.session.flash = { type: 'danger', message: 'Vous ne pouvez pas retirer votre propre rôle administrateur.' };
    }

    await pool.query('UPDATE utilisateurs SET nom = ?, email = ?, role = ?, permissions = ? WHERE id = ?', [
      nom.trim(),
      email.trim().toLowerCase(),
      roleFinal,
      serialiserPermissions(permissionsChoisies),
      cible,
    ]);

    if (nouveau_mot_de_passe && nouveau_mot_de_passe.trim()) {
      if (nouveau_mot_de_passe.trim().length < 6) {
        const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [req.params.id]);
        return res.render('users/form', {
          item: lignes[0],
          MODULES,
          permissionsActuelles: permissionsChoisies,
          erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères (les autres informations ont été enregistrées).',
        });
      }
      const hash = bcrypt.hashSync(nouveau_mot_de_passe.trim(), 10);
      await pool.query('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [hash, cible]);
    }

    if (!req.session.flash) {
      req.session.flash = { type: 'success', message: 'Utilisateur mis à jour.' };
    }
    res.redirect('/utilisateurs');
  })
);

router.post(
  '/:id/desactiver',
  asyncHandler(async (req, res) => {
    if (parseInt(req.params.id, 10) === req.session.user.id) {
      req.session.flash = { type: 'danger', message: 'Vous ne pouvez pas désactiver votre propre compte.' };
      return res.redirect('/utilisateurs');
    }
    await pool.query('UPDATE utilisateurs SET actif = 0 WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: 'Utilisateur désactivé.' };
    res.redirect('/utilisateurs');
  })
);

router.post(
  '/:id/activer',
  asyncHandler(async (req, res) => {
    await pool.query('UPDATE utilisateurs SET actif = 1 WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', message: 'Utilisateur activé.' };
    res.redirect('/utilisateurs');
  })
);

module.exports = router;
