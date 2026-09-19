// Liste des modules de l'application pouvant être activés/désactivés
// individuellement pour chaque employé. Un administrateur a toujours accès
// à tout, quelle que soit cette liste.
const MODULES = [
  { cle: 'fournisseurs', libelle: 'Fournisseurs' },
  { cle: 'couturiers', libelle: 'Couturiers' },
  { cle: 'clients', libelle: 'Clients' },
  { cle: 'achats', libelle: 'Achats' },
  { cle: 'commandes', libelle: 'Commandes de couture' },
  { cle: 'ventes', libelle: 'Ventes' },
  { cle: 'stock', libelle: 'Consultation du stock' },
];

const CLES_MODULES = MODULES.map((m) => m.cle);

function toutesLesPermissions() {
  return CLES_MODULES.join(',');
}

// "fournisseurs,achats,ventes" -> ["fournisseurs", "achats", "ventes"]
function parsePermissions(chaine) {
  if (!chaine) return [];
  return chaine
    .split(',')
    .map((s) => s.trim())
    .filter((s) => CLES_MODULES.includes(s));
}

// ["fournisseurs", "achats"] -> "fournisseurs,achats"
function serialiserPermissions(liste) {
  if (!Array.isArray(liste)) return '';
  return liste.filter((c) => CLES_MODULES.includes(c)).join(',');
}

module.exports = { MODULES, CLES_MODULES, toutesLesPermissions, parsePermissions, serialiserPermissions };
