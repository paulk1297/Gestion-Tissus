const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { erreur: null });
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, mot_de_passe } = req.body;
    const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE email = ? AND actif = 1', [
      (email || '').trim().toLowerCase(),
    ]);
    const utilisateur = lignes[0];

    if (!utilisateur || !bcrypt.compareSync(mot_de_passe || '', utilisateur.mot_de_passe)) {
      return res.render('login', { erreur: 'Email ou mot de passe incorrect.' });
    }

    req.session.user = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role,
    };
    res.redirect('/');
  })
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/compte', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('compte', { erreur: null, succes: null });
});

router.post(
  '/compte',
  asyncHandler(async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { mot_de_passe_actuel, nouveau_mot_de_passe, confirmer_mot_de_passe } = req.body;
    const [lignes] = await pool.query('SELECT * FROM utilisateurs WHERE id = ?', [req.session.user.id]);
    const utilisateur = lignes[0];

    if (!bcrypt.compareSync(mot_de_passe_actuel || '', utilisateur.mot_de_passe)) {
      return res.render('compte', { erreur: 'Mot de passe actuel incorrect.', succes: null });
    }
    if (!nouveau_mot_de_passe || nouveau_mot_de_passe.length < 6) {
      return res.render('compte', {
        erreur: 'Le nouveau mot de passe doit contenir au moins 6 caractères.',
        succes: null,
      });
    }
    if (nouveau_mot_de_passe !== confirmer_mot_de_passe) {
      return res.render('compte', { erreur: 'Les deux mots de passe ne correspondent pas.', succes: null });
    }

    const hash = bcrypt.hashSync(nouveau_mot_de_passe, 10);
    await pool.query('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [hash, utilisateur.id]);
    res.render('compte', { erreur: null, succes: 'Mot de passe mis à jour avec succès.' });
  })
);

module.exports = router;
