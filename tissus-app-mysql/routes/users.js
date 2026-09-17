const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [utilisateurs] = await pool.query(
      'SELECT id, nom, email, role, actif, cree_le FROM utilisateurs ORDER BY nom'
    );
    res.render('users/liste', { utilisateurs });
  })
);

router.get('/nouveau', (req, res) => {
  res.render('users/form', { erreur: null });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nom, email, mot_de_passe, role } = req.body;
    if (!nom || !email || !mot_de_passe || mot_de_passe.length < 6) {
      return res.render('users/form', {
        erreur: 'Tous les champs sont obligatoires et le mot de passe doit contenir au moins 6 caractères.',
      });
    }
    const [existants] = await pool.query('SELECT id FROM utilisateurs WHERE email = ?', [
      email.trim().toLowerCase(),
    ]);
    if (existants.length > 0) {
      return res.render('users/form', { erreur: 'Un utilisateur avec cet email existe déjà.' });
    }
    const hash = bcrypt.hashSync(mot_de_passe, 10);
    await pool.query('INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif) VALUES (?, ?, ?, ?, 1)', [
      nom.trim(),
      email.trim().toLowerCase(),
      hash,
      role === 'admin' ? 'admin' : 'employe',
    ]);
    req.session.flash = { type: 'success', message: 'Utilisateur créé avec succès.' };
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
