# Configurateur de devis A.R.C ALUMINIUM — Spécification complète pour reconstruction Next.js / React

> **But de ce document.** Décrire **toute** la logique du fichier Excel `CONFIGURATEUR_V2_200626__A_R_C_ALUMINIUM_PROSPECT.xlsx` (onglets / « calques », tables de données, formules, abaques, arrondis, validations, mises en forme conditionnelles, génération de texte) de façon assez précise pour le reconstruire à l'identique en Next.js/React **sans avoir l'Excel sous les yeux**.
>
> Les **matrices de prix** (grilles tarifaires 2D) et toutes les tables de lookup sont fournies dans le fichier compagnon **`arc_data.json`** (à importer directement dans l'app). Ce `.md` documente la **structure** et la **logique** ; le `.json` contient les **chiffres**.
>
> ⚠️ Détail critique validé : l'arrondi Excel `ROUND(x,0)` est un **arrondi au plus proche, .5 vers le haut** (round-half-away-from-zero), **pas** l'arrondi bancaire de JavaScript/Python. À reproduire exactement (voir §6.2). La chaîne de calcul complète a été revérifiée numériquement (un cas test donne `1198,931 €` au centime près).

---

## 0. Vue d'ensemble fonctionnelle

Le classeur est un **configurateur de devis « fourniture seule » de menuiseries aluminium** (coulissants, galandages, châssis fixes, portes lourdes, fenêtres OF/OB). L'utilisateur (un commercial ou un client pro d'A.R.C) saisit, ligne par ligne, une menuiserie via des **listes déroulantes** + des **dimensions**, et le prix **net HT** (remise déjà appliquée) se calcule en temps réel.

Le cœur du produit est l'onglet **« Devis »** : un tableau de **10 lignes** (lignes Excel 14→23) où chaque ligne est une menuiserie. Pour chaque ligne, environ **8 listes déroulantes** + **3 saisies numériques** (Largeur, Hauteur, Qté) alimentent une cascade de ~15 colonnes de calcul cachées (V→AM) qui produisent le prix unitaire (colonne S) puis le prix total (colonne T).

Toute la **donnée tarifaire** vit dans l'onglet caché **`_Données`** (tables de lookup) + **16 onglets cachés** de **grilles de prix 2D** (un par type de menuiserie), où **lignes = hauteurs** et **colonnes = largeurs**.

### Modèle mental du calcul (par ligne)

```
Type + Largeur + Hauteur
        │
        ▼
[1] Tarif de base "baie"  ──► lookup dans la grille 2D du type (dimension arrondie au pas de 100 mm)
        │
        ├─[2] + PV 4 points de fermeture   (si hauteur ≥ seuil 2320 mm → +4 %)   [coulissants/galandages]
        ├─[3] + PV famille couleur (%)      (× tarif baie)
        ├─[4] + PV vitrage (€ forfait)
        ├─[5] + PV dormant €/ml             (× périmètre 2·(L+H))
        ├─[6] + PV dormant % baie           (× tarif baie)  [=0 partout dans ce fichier]
        └─[7] + PV traverses/meneaux €/ml   (× L ou H selon profilé)
        │
        ▼
   Sous-total  ──►  × (1 − remise)             [remise globale, onglet Paramètres]
        │
        ├─[8] + PV option porte (déjà nette, ×0,75)   [Portes Lourdes uniquement]
        ├─[9] + Forfait couleur (appliqué 1× / devis, déjà net)
        ├─[10] + Grille de ventilation : +25 € net  (si "OUI")
        ├─[11] + Habillage extérieur €/ml  (× (L + 2·H))   [net, hors remise]
        └─[12] + Bavette €/ml              (× L)            [net, hors remise]
        │
        ▼
   PRIX UNITAIRE NET HT (colonne S)  ──► × Qté  ──► PRIX TOTAL NET HT (colonne T)
```

> Subtilité importante sur la remise : la remise `Paramètres!B2` s'applique au **bloc baie + PV proportionnelles** (tarif baie, 4 pts, couleur %, vitrage, dormant €/ml, dormant %, traverses/meneaux). Les éléments **option porte**, **habillage**, **bavette**, **forfait couleur** et **grille ventilation** sont ajoutés **après** la remise (ils sont déjà nets / forfaitaires). Voir la formule exacte au §6.4.

---

## 1. Inventaire des onglets (« calques »)

| # | Onglet | État | Rôle |
|---|--------|------|------|
| 1 | **Notice d'utilisation** | visible | Mode d'emploi + abaques + mentions de propriété/confidentialité. Pur affichage. |
| 2 | **Paramètres** | visible | **`B2` = taux de remise client** (cellule jaune éditable). Valeur du fichier : `0,515` (51,5 %). |
| 3 | **Sommaire** | visible | Récap des grilles + familles couleur + tableau « PV traverses/meneaux ». Affichage/référence. |
| 4 | **Devis** | visible | **Outil principal.** Saisie multi-lignes (10 lignes) + calcul. C'est ce qu'il faut reconstruire en priorité. |
| 5–9 | **Coulissant 2/3/4 v 2 rails**, **Coulissant 3/6 v 3 rails** | cachés | Grilles de prix 2D (€ HT non remisé). |
| 10–13 | **Galandage 1v1r / 2v1r / 2v2r / 4v2r** | cachés | Grilles de prix 2D. |
| 14 | **Châssis fixe vitré** | caché | Grille de prix 2D. |
| 15–16 | **Porte Lourde 1 vantail / 2 vantaux** | cachés | Grilles de prix 2D. |
| 17 | **Doubles Vitrages** | caché | Catalogue vitrages (affichage). La donnée utile est dupliquée dans `_Données`. |
| 18 | **Options dormant** | caché | Catalogue dormants (affichage). Donnée utile dupliquée dans `_Données`. |
| 19 | **Teintes & Finitions** | caché | Catalogue RAL par famille (affichage). |
| 20 | **`_Données`** | caché | **Toutes les tables de lookup** + table de routage des grilles. Cerveau de données. |
| 21–24 | **Fenêtre OF 1v / OF 2v / OB 1v / OB 2v** | cachés | Grilles de prix 2D. |

> Une notice mentionne aussi un onglet « Configurateur » (devis rapide 1 menuiserie). Il n'existe pas dans ce fichier ; seul « Devis » (multi-lignes) est présent. À l'écran on peut prévoir les deux modes, mais la logique de calcul est strictement identique.

### Référence externe `[1]`
Certaines formules de la colonne **J** (commentaires) du Devis pointent vers `[1]_Données!…` (un classeur externe), alors que les colonnes de calcul (S, V…) pointent vers le `_Données` **local**. Le classeur `[1]` est une copie de structure identique. **Pour la reconstruction, traiter `[1]_Données` = `_Données` local** (mêmes plages, mêmes valeurs).

---

## 2. Onglet « Paramètres »

- **`Paramètres!B2`** = `remise` (nombre décimal, ex. `0,515`). Unique réglage global du devis. Tout l'app le lit comme une constante de configuration (dans le JSON : `remise_default = 0.515`).
- Modifiable par l'utilisateur. `0` = tarif de base sans remise.

En React : une variable de state global / contexte `remise` (slider ou champ %), défaut `0.515`.

---

## 3. Onglet « Devis » — structure de la grille de saisie

### 3.1 En-têtes & blocs d'en-tête (lignes 1–11)

Bloc « chantier » + « performances » + « demandeur » — purement informatif (pas de calcul), à reproduire comme champs de formulaire libres :

- **INFORMATIONS CHANTIER** : Nom du chantier, Adresse, Référence affaire, Date de la demande (`=TODAY()` → date du jour auto).
- **PERFORMANCES** (champs libres, orientation BE) : Uw, Facteur solaire Sw, Affaiblissement acoustique, AEV.
- **DEMANDEUR** (pré-rempli, éditable) : Demande émise par = `Bruno ROBEIL` ; Société = `A.R.C ALUMINIUM` ; Tél = `+33 (0)4 76 55 09 64` ; E-mail = `contact@arc-alu.fr`.
- Titre : `DEVIS - FOURNITURE SEULE - MENUISERIES ALUMINIUM`.

### 3.2 Tableau de saisie (lignes 14→23 = 10 lignes max)

Ligne d'en-tête = ligne 13. Colonnes **visibles** saisies/affichées :

| Col | En-tête | Type | Source / liste déroulante |
|-----|---------|------|----------------------------|
| A | N° | auto | 1..10 |
| B | Localisation | texte libre | — |
| **C** | **Type de menuiserie** | liste | `_Données!A3:A18` (18 types) |
| **D** | **Famille couleur** | liste | `_Données!A21:A28` (8 familles) |
| **E** | **Vitrage** | liste | `_Données!A48:A104` (57 vitrages) |
| **F** | **Type de dormant** | liste | `_Données!A33:A43` (11 dormants) |
| **G** | **Largeur (mm)** | nombre | saisie |
| **H** | **Hauteur (mm)** | nombre | saisie |
| **I** | **Qté** | nombre | saisie |
| J | Commentaires position | **auto** (formule) | généré (voir §7) |
| K | Observations | texte libre | — |
| **L** | Grille de ventilation | liste | `OUI` / `NON` (validation native) → +25 € net si OUI |
| **M** | Option T/M 1 | liste | `_Données!A149:A154` (Aucune / Traverses / Meneaux) |
| **N** | Option T/M 2 | liste | `_Données!A149:A154` |
| **O** | Option T/M 3 | liste | `_Données!A149:A154` |
| **P** | Habillage extérieur | liste | `_Données!A218:A229` (Aucun / Cornières) |
| **Q** | Bavette | liste | `_Données!A232:A236` (Aucune / Bavettes) |
| **R** | Option porte | liste | `_Données!A109:A125` (options portes lourdes) |
| S | Prix unitaire net HT | **auto** | formule maîtresse (§6.4) |
| T | Prix total net HT | **auto** | `=S × Qté` |

Colonnes **cachées de calcul** (V→AM), une par ligne — voir §6 :

| Col | Nom | Rôle |
|-----|-----|------|
| V | Tarif baie | Prix de base lu dans la grille 2D (ou `0` si vide, `-1` si dimension introuvable). |
| W | PV 4pts | Plus-value 4 points de fermeture. |
| X | PV coul. | PV famille couleur (% × tarif baie). |
| Y | Forfait | Forfait couleur (€). |
| Z | PV vitr. | PV vitrage (€). |
| AA | PV €/ml | PV dormant linéaire. |
| AB | PV % baie | PV dormant % (×tarif baie). |
| AC | PV option | PV option porte (déjà nette). |
| AD | PV T/M | PV traverses/meneaux. |
| AE | Err T/M | Drapeau d'incompatibilité T/M (>0 = erreur). |
| AF/AG/AH | T1/T2/T3 | Libellés traverses extraits de M/N/O. |
| AI/AJ/AK | M1/M2/M3 | Libellés meneaux extraits de M/N/O. |
| AL | Ligne T | Fragment de texte « Traverses : … » pour le commentaire. |
| AM | Ligne M | Fragment de texte « Meneaux : … » pour le commentaire. |

### 3.3 Totaux (lignes 25–28)

| Cellule | Formule | Sens |
|---------|---------|------|
| **T25** | `=SUM(T14:T23)` | Total HT des lignes. |
| **T26** | `=MAX(Y14:Y23)*(1−remise)` | **Forfait couleur**, appliqué **1 seule fois** par devis = le **plus élevé** des forfaits famille présents, **remisé**. |
| **T27** | `=T25+T26` | **TOTAL NET HT GLOBAL** (le chiffre à afficher en gras). |
| T28 | `=Paramètres!B2` | Rappel du taux de remise. |

> ⚠️ Le **forfait couleur** (99 € ou 275 €) n'est **PAS** ajouté dans le prix unitaire de chaque ligne ; il est compté **une seule fois** au niveau du devis (le max des forfaits, remisé), puis ajouté au total. La colonne `Y` (forfait par ligne) ne sert qu'à alimenter ce `MAX`. (Voir nuance §6.4 : `Y` est exclu de `S`.)

---

## 4. Onglet `_Données` — toutes les tables de lookup

> Toutes ces tables sont dans `arc_data.json`. Reproduites ici pour lisibilité. Les **clés exactes** (chaînes des listes déroulantes) doivent être respectées **au caractère près** car elles servent de clés de lookup.

### 4.1 Table de **routage des grilles** (`_Données!A3:S18`) — clé du moteur

Une ligne par type de menuiserie. Colonnes (index VLOOKUP entre parenthèses) :

| Champ (col index) | Sens |
|---|---|
| `label` (1) | Nom du type (= valeur de la liste déroulante col C). |
| `onglet` (2) | Nom de l'onglet/grille de prix à utiliser. |
| `L_min`(3) `L_max`(4) | Bornes largeur **pour le calcul** (clamp). |
| `H_min`(5) `H_max`(6) | Bornes hauteur **pour le calcul** (clamp). |
| `H_1pt`(7) `H_2pt`(8) `H_3pt`(9) `H_4pt`(10) | Seuils hauteur points de fermeture. Seul **`H_4pt`** est utilisé (déclenche la PV 4 pts). |
| `PV4pts_pct` (11) | Taux PV 4 pts (`0,04` pour coulissants/galandages ; `0` sinon). |
| `EUR_first_row` (12) | 1ʳᵉ ligne de la **matrice de prix** dans la grille (toujours `5`). |
| `EUR_first_col` (13) | 1ʳᵉ colonne de la matrice (toujours `2` = col B). |
| `n_widths` (14) | Nombre de colonnes largeur. |
| `n_heights` (15) | Nombre de lignes hauteur. |
| `width_first` (16) | 1ʳᵉ largeur de la grille. |
| `width_step` (17) | Pas largeur (toujours `100`). |
| `height_first` (18) | 1ʳᵉ hauteur de la grille. |
| `height_step` (19) | Pas hauteur (toujours `100`). |

Valeurs complètes :

| label | onglet | L_min | L_max | H_min | H_max | H_4pt | PV4pts% | EUR_row | EUR_col | n_w | n_h | w_first | w_step | h_first | h_step |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Coulissant 2 vantaux 2 rails | Coulissant 2 vantaux 2 rails | 600 | 3500 | 750 | 2700 | 2320 | 0.04 | 5 | 2 | 28 | 21 | 800 | 100 | 750 | 100 |
| Coulissant 3 vantaux 2 rails | Coulissant 3 vantaux 2 rails | 1000 | 5000 | 750 | 2700 | 2320 | 0.04 | 5 | 2 | 31 | 21 | 2000 | 100 | 750 | 100 |
| Coulissant 4 vantaux 2 rails | Coulissant 4 vantaux 2 rails | 1200 | 5000 | 750 | 2700 | 2320 | 0.04 | 5 | 2 | 36 | 21 | 2500 | 100 | 750 | 100 |
| Coulissant 3 vantaux 3 rails | Coulissant 3 vantaux 3 rails | 1000 | 5000 | 750 | 2700 | 2320 | 0.04 | 5 | 2 | 31 | 21 | 2000 | 100 | 750 | 100 |
| Coulissant 6 vantaux 3 rails | Coulissant 6 vantaux 3 rails | 4000 | 6400 | 750 | 2700 | 2320 | 0.04 | 5 | 2 | 25 | 21 | 4000 | 100 | 750 | 100 |
| Galandage 1 vantail 1 rail | Galandage 1 vantail 1 rail | 500 | 2000 | 750 | 2350 | 2320 | 0.04 | 5 | 2 | 16 | 17 | 500 | 100 | 750 | 100 |
| Galandage 2 vantaux 1 rail | Galandage 2 vantaux 1 rail | 900 | 3200 | 750 | 2350 | 2320 | 0.04 | 5 | 2 | 24 | 17 | 900 | 100 | 750 | 100 |
| Galandage 2 vantaux 2 rails | Galandage 2 vantaux 2 rails | 1000 | 3300 | 750 | 2350 | 2320 | 0.04 | 5 | 2 | 24 | 17 | 1000 | 100 | 750 | 100 |
| Galandage 4 vantaux 2 rails | Galandage 4 vantaux 2 rails | 1800 | 4100 | 750 | 2350 | 2320 | 0.04 | 5 | 2 | 24 | 17 | 1800 | 100 | 750 | 100 |
| Châssis fixe vitré | Châssis fixe vitré | 300 | 3000 | 450 | 2550 | 99999 | 0 | 5 | 2 | 28 | 22 | 300 | 100 | 450 | 100 |
| Porte Lourde 1 vantail | Porte Lourde 1 vantail | 800 | 1300 | 1950 | 2850 | 99999 | 0 | 5 | 2 | 6 | 7 | 800 | 100 | 1950 | 100 |
| Porte Lourde 2 vantaux | Porte Lourde 2 vantaux | 1200 | 2500 | 1950 | 2850 | 99999 | 0 | 5 | 2 | 14 | 7 | 1200 | 100 | 1950 | 100 |
| Fenêtre OF 1 vantail | Fenêtre OF 1 vantail | 400 | 1300 | 550 | 2500 | 99999 | 0 | 5 | 2 | 10 | 21 | 400 | 100 | 550 | 100 |
| Fenêtre OF 2 vantaux | Fenêtre OF 2 vantaux | 700 | 2400 | 550 | 2500 | 99999 | 0 | 5 | 2 | 18 | 21 | 700 | 100 | 550 | 100 |
| Fenêtre OB 1 vantail | Fenêtre OB 1 vantail | 400 | 1300 | 550 | 2500 | 99999 | 0 | 5 | 2 | 10 | 21 | 400 | 100 | 550 | 100 |
| Fenêtre OB 2 vantaux | Fenêtre OB 2 vantaux | 700 | 2400 | 550 | 2500 | 99999 | 0 | 5 | 2 | 18 | 21 | 700 | 100 | 550 | 100 |

> Note : la table de routage utilise `L_min`/`H_min` parfois plus larges que l'abaque « officielle » (§4.10). Le **calcul** de prix s'appuie sur le clamp `width_first…L_max` et `height_first…H_max`. Le **contrôle hors-abaque** (cellule rouge + message) s'appuie sur la table **abaques** `A196:E211` (§4.10), qui peut être plus restrictive (ex. coulissant 2v : routage L_min 600 mais abaque L_min 800). Garder les deux tables distinctes.

### 4.2 Familles couleur (`_Données!A21:C28`) — liste col D

| Famille (clé) | Plus-value % | Forfait € |
|---|---|---|
| Famille 1 Monocolore | 0 | 0 |
| Famille 1 Bicolore | 0 | 0 |
| Famille 1 PLUS Monocolore | 0 | 99 |
| Famille 2 Monocolore | 0.10 | 99 |
| Famille 3 Monocolore | 0.25 | 99 |
| Famille 4 Faux bois | 0.30 | 99 |
| Famille 5 Bicolore | 0.20 | 275 |
| Famille 6 Bicolore | 0.25 | 275 |

- PV % = `X` = `tarif_baie × pct` (remisée).
- Forfait = `Y` = alimente le `MAX` du devis (compté 1× au total, remisé).

### 4.3 Dormants (`_Données!A33:C43`) — liste col F

| Dormant (clé) | €/ml | % baie |
|---|---|---|
| Standard (sans doublage) | 0 | 0 |
| Dormant réno 25 mm | 25 | 0 |
| Dormant réno 45 mm | 26 | 0 |
| Dormant réno 65 mm | 30 | 0 |
| Dormant réno 80 mm | 31 | 0 |
| Doublage 120 mm sans VR (sans plus value) | 0 | 0 |
| Doublage 120 mm avec VR (sans plus value) | 0 | 0 |
| Doublage 140 mm sans VR | 18 | 0 |
| Doublage 140 mm avec VR | 18 | 0 |
| Doublage 160 mm sans VR | 25 | 0 |
| Doublage 160 mm avec VR | 25 | 0 |

- `AA` (€/ml) = `eur_ml × 2 × (L + H) / 1000` (périmètre en m), remisé.
- `AB` (% baie) = `tarif_baie × pct_baie`, remisé. (Toutes les valeurs `% baie` = 0 dans ce fichier, mais garder la colonne pour évolutivité.)

### 4.4 Vitrages (`_Données!A48:C104`) — liste col E (57 entrées)

Colonnes : `code vitrage` (clé), `plus-value €` (= `Z`, remisée), `catégorie` (info). Le 1ᵉʳ (`4 /20/ 4 (Fe Argon WE) Clair`) a une PV de **0 €** (vitrage standard de référence). **Liste intégrale dans `arc_data.json` → `vitrages`.** Extrait :

| code (clé) | PV € | catégorie |
|---|---|---|
| 4 /20/ 4 (Fe Argon WE) Clair | 0 | Faiblement Émissif |
| 6 /18/ 4 (Fe Argon WE) Clair | 30 | Double Vitrage Faiblement Émissif |
| 4 /16/ 6 (Fe Argon WE) Clair | 88 | Double Vitrage Faiblement Émissif |
| 4 /16/ 4 (Fe Argon WE) G200 | 29 | Double Vitrage Décoratif |
| … (57 lignes au total) | … | … |
| SP10 (44.6) /14/ 6 (Fe Argon WE) Stopsol Bronze | 967 | Double Vitrage Feuilleté Securit |

### 4.5 Options portes lourdes (`_Données!A109:C125`) — liste col R (17 entrées)

Colonnes : `label` (clé), `prix public €`, `multiplicateur vantail` (0 = prix fixe / 1 = ×nb vantaux).

| label (clé) | prix public € | mult. vantail |
|---|---|---|
| Aucune option | 0 | 0 |
| Bandeau Ventouse Electromagnétique (Noir/Blanc) | 1791 | 0 |
| Bandeau Ventouse + Bâton de maréchal/hauteur >316mm | 2514 | 0 |
| Poignée S Filante | 764 | 0 |
| Barre Antipanique 1 point sur vantail principal | 764 | 0 |
| Barre Antipanique 3 points sur vantail principal | 1316 | 0 |
| Barre Antipanique 1 point + module à clé extérieur | 1074 | 0 |
| Barre Antipanique 3 points + module à clé extérieur | 1624 | 0 |
| Barres Antipaniques 1 point + 2 points sur secondaire | 2076 | 0 |
| Barres Antipaniques 3 points + 2 points sur secondaire | 2629 | 0 |
| Barres Antipaniques 1 point + clé extérieur + 2 points secondaire | 2385 | 0 |
| Barres Antipaniques 3 points + clé extérieur + 2 points secondaire | 2936 | 0 |
| Gâche journalière et/ou Gâche électrique | 180 | 0 |
| Ferme porte à Glissière | 522 | 0 |
| Crémone Pompier | 250 | 0 |
| Verrou à bascule haut et bas (sans plus-value) | 0 | 0 |
| Joint anti pince doigt (par vantail) | 477 | 1 |

> **Règle option porte (col AC)** : valable **uniquement** si Type ∈ {Porte Lourde 1 vantail, Porte Lourde 2 vantaux}. Calcul :
> `AC = prix_public × 0,75 × (si mult_vantail=1 alors {1v→1, 2v→2} sinon 1) × (1 − remise)`.
> Le `×0,75` est un coefficient tarif fixe ; le résultat est **net** (remise déjà appliquée dans AC, donc AC est ajouté **après** la remise dans S). Si une option ≠ « Aucune option » est choisie alors que le type **n'est pas** une porte lourde → message d'erreur (voir §6.4 / §8).

### 4.6 Plus-values traverses & meneaux (`_Données!A132:B146`)

Clé composite **`"<Type>|<Profilé>"`**, valeur = prix €/ml **HT brut** (sera remisé). 15 entrées :

| clé (`Type|Profilé`) | €/ml brut |
|---|---|
| Châssis fixe vitré\|Traverse 70 mm | 224.46 |
| Châssis fixe vitré\|Traverse 100 mm | 264.82 |
| Châssis fixe vitré\|Meneau 70 mm | 230 |
| Châssis fixe vitré\|Meneau 100 mm | 252.73 |
| Fenêtre OF 1 vantail\|Traverse 70 mm | 170.1 |
| Fenêtre OF 2 vantaux\|Traverse 70 mm | 328.28 |
| Fenêtre OB 1 vantail\|Traverse 70 mm | 170.1 |
| Fenêtre OB 2 vantaux\|Traverse 70 mm | 328.28 |
| Porte Lourde 1 vantail\|Traverse 70 mm | 184.33 |
| Porte Lourde 1 vantail\|Traverse 100 mm | 211.33 |
| Porte Lourde 1 vantail\|Meneau 70 mm | 280.71 |
| Porte Lourde 2 vantaux\|Traverse 70 mm | 352.29 |
| Porte Lourde 2 vantaux\|Traverse 142 mm | 687 |
| Porte Lourde 2 vantaux\|Meneau 70 mm | 280.71 |
| Porte Lourde 2 vantaux\|Meneau 100 mm | 339.29 |

> Seuls ces couples Type↔Profilé existent. Toute autre combinaison (ex. un coulissant avec une traverse) est **incompatible** → drapeau `AE > 0` → message d'erreur, prix non affiché.

### 4.7 Liste profilés T/M (`_Données!A149:A154`) — listes cols M, N, O

`Aucune`, `Traverse 70 mm`, `Traverse 100 mm`, `Traverse 142 mm`, `Meneau 70 mm`, `Meneau 100 mm`.

- Un profilé dont le libellé **commence par** `"Traverse"` (8 premiers car.) est multiplié par la **Largeur** ; un profilé commençant par `"Meneau"` (6 premiers car.) est multiplié par la **Hauteur**. (Voir col AD §6.)

### 4.8 Type → Système ALUK (`_Données!A158:B173`) — affichage commentaire

| Types | Système |
|---|---|
| Tous les Coulissants & Galandages | `Aluk Group 67CL32` |
| Châssis fixe, Portes Lourdes, Fenêtres OF/OB | `Aluk Group 67FR/67PL` |

### 4.9 Type → Poignée & Fermeture (`_Données!A177:C192`) — affichage commentaire

| Types | Poignée | Fermeture |
|---|---|---|
| Coulissants & Galandages | SARENA 20° sur vantail principal / Cuvette sur vantail secondaire | Serrure multipoints Slidelock |
| Châssis fixe vitré | *(vide)* | *(vide)* |
| Portes Lourdes (1v & 2v) | Paire de béquille HERA / Rosaces Horus / Cylindre standard 45x45 | Serrure 3 points KFV |
| Fenêtres OF & OB | HOPPE ALENA | SIEGENIA - Perçage symétrique |

> Règle d'affichage : pour une **porte lourde** dont l'option (col R) contient `"ventouse"` ou `"antipanique"` (recherche insensible à la casse), on **masque** la poignée et la fermeture par défaut dans le commentaire (l'option les remplace).

### 4.10 Abaques de dimensions (`_Données!A196:E211`) — contrôle hors-abaque

`Type` (clé), `L_min`, `L_max`, `H_min`, `H_max`. Sert au **drapeau rouge** + message « ⚠ Hors abaque ». (Ce sont les bornes **commerciales/officielles**, parfois plus strictes que le routage §4.1.)

| Type | L_min | L_max | H_min | H_max |
|---|---|---|---|---|
| Coulissant 2 vantaux 2 rails | 800 | 3500 | 750 | 2700 |
| Coulissant 3 vantaux 2 rails | 2000 | 5000 | 750 | 2700 |
| Coulissant 4 vantaux 2 rails | 2500 | 6050 | 750 | 2700 |
| Coulissant 3 vantaux 3 rails | 2000 | 5000 | 750 | 2700 |
| Coulissant 6 vantaux 3 rails | 4000 | 6400 | 750 | 2700 |
| Galandage 1 vantail 1 rail | 500 | 2000 | 750 | 2350 |
| Galandage 2 vantaux 1 rail | 900 | 3200 | 750 | 2350 |
| Galandage 2 vantaux 2 rails | 1000 | 3300 | 750 | 2350 |
| Galandage 4 vantaux 2 rails | 1800 | 4100 | 750 | 2350 |
| Châssis fixe vitré | 300 | 3000 | 450 | 2550 |
| Porte Lourde 1 vantail | 800 | 1300 | 1950 | 2850 |
| Porte Lourde 2 vantaux | 1200 | 2500 | 1950 | 2850 |
| Fenêtre OF 1 vantail | 400 | 1300 | 550 | 2500 |
| Fenêtre OF 2 vantaux | 700 | 2400 | 550 | 2500 |
| Fenêtre OB 1 vantail | 400 | 1300 | 550 | 2500 |
| Fenêtre OB 2 vantaux | 700 | 2400 | 550 | 2500 |

### 4.11 Habillage extérieur (`_Données!A218:B229`) — liste col P

`label` (clé), `prix €/ml`. Calcul `S += eur_ml × (L + 2·H) / 1000` (**net, hors remise**).

| label | €/ml |
|---|---|
| Aucun | 0 |
| Cornière 20×15 | 10.21 |
| Cornière 30×15 | 13.47 |
| Cornière 30×20 | 14.68 |
| Cornière 40×20 | 18.26 |
| Cornière 50×20 | 20.84 |
| Cornière 60×20 | 23.95 |
| Cornière 60×30 | 28.33 |
| Cornière 60×40 | 31.36 |
| Cornière 80×20 | 30.45 |
| Cornière 80×60 | 51.45 |
| Cornière 100×30 | 47.7 |

### 4.12 Bavette (`_Données!A232:B236`) — liste col Q

`label` (clé), `prix €/ml`. Calcul `S += eur_ml × L / 1000` (**net, hors remise**).

| label | €/ml |
|---|---|
| Aucune | 0 |
| Bavette 74 mm (N99987) | 48 |
| Bavette 114 mm (N99988) | 51 |
| Bavette 154 mm (N99989) | 63 |
| Bavette Réno 72x92 - N99934 | 43 |

---

## 5. Les 16 grilles de prix 2D (onglets cachés)

Chaque type de menuiserie a sa propre grille. **Structure identique** sur tous les onglets :

```
Ligne 1 : titre (ex. "COULISSANT 2 VANTAUX 2 RAILS CL32")
Ligne 3 : "PRIX EN € HT (Double vitrage standard) - non remisé"
Ligne 4 : en-têtes LARGEURS → en B4, C4, D4, …  (B4=800, C4=900, …)   [= EUR_first_row - 1]
Col  A  : HAUTEURS ↓ à partir de A5 (A5=750, A6=850, …)               [= colonne 1]
Matrice : prix à partir de B5 (EUR_first_row=5, EUR_first_col=2=B)
```

- **Lignes = hauteurs**, **colonnes = largeurs**, valeurs = **prix € HT non remisé** (double vitrage standard de référence).
- Dimensions de chaque matrice (n_heights × n_widths) : voir colonne `n_h`/`n_w` de la table de routage (§4.1).
- Les onglets contiennent aussi, **plus bas**, une 2ᵉ section « prix €/m² » et une ligne « Traverse 70 mm » : **purement indicatives**, **non utilisées** par le moteur de calcul du Devis. À ignorer pour la reconstruction (le moteur lit `_Données` pour les traverses, §4.6).

**Toutes les matrices sont dans `arc_data.json` → `price_grids[<onglet>] = { widths:[…], heights:[…], prices:[[…],…] }`** où `prices[i][j]` correspond à `heights[i] × widths[j]`.

Exemple complet (petite grille) — **Porte Lourde 1 vantail** (7 hauteurs × 6 largeurs) :

| H \ L | 800 | 900 | 1000 | 1100 | 1200 | 1300 |
|---|---|---|---|---|---|---|
| **1950** | 2758 | 2822 | 2892 | 2959 | 3027 | 3092 |
| **2150** | 2810 | 2880 | 2947 | 3016 | 3085 | 3155 |
| **2350** | 2863 | 2933 | 3004 | 3074 | 3144 | 3214 |
| **2550** | 2915 | 2988 | 3060 | 3131 | 3203 | 3346 |
| **2650** | 2971 | 3042 | 3116 | 3190 | 3260 | 3409 |
| **2750** | 3024 | 3098 | 3172 | 3246 | 3392 | 3471 |
| **2850** | 3076 | 3153 | 3231 | 3304 | 3454 | 3534 |

> Avertissement présent dans le Sommaire : *« valeurs transcrites à partir d'images fournies ; vérifier les prix avant tout devis »*. Donc des cellules isolées peuvent contenir des coquilles à valider côté A.R.C.

---

## 6. Le moteur de calcul (colonnes V→AM) — formules exactes & pseudo-code

> Toutes les formules ci-dessous sont par **ligne `r`** (14→23). `remise = Paramètres!B2`. Les lookups `VLOOKUP(x, table, k, FALSE)` sont des **correspondances exactes** sur la 1ʳᵉ colonne de la table. `routing(Type)` = ligne de §4.1.

### 6.1 Convention d'arrondi des dimensions

Les dimensions saisies sont **« accrochées » au pas de 100 mm** puis **clampées** :

```
snap(value, first, step, maxLimit) =
    s = first + ROUND_HALF_UP( (value - first) / step ) * step
    return MAX(first, MIN(maxLimit, s))

snappedW = snap(L, width_first, width_step, L_max)     // L_max = routing col 4
snappedH = snap(H, height_first, height_step, H_max)   // H_max = routing col 6
```

### 6.2 ⚠️ ROUND_HALF_UP (impératif)

Excel `ROUND(x,0)` arrondit **0,5 vers le haut** (loin de zéro). À reproduire :

```js
function xlRound(x) {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}
```

> **NE PAS** utiliser `Math.round` seul pour les négatifs ni la « banker's rounding ». Cas test : `(1200-750)/100 = 4,5` → doit donner **5** (→ hauteur 1250), pas 4. Une erreur ici décale d'une ligne dans la grille et fausse le prix.

### 6.3 Colonne V = **Tarif baie** (lookup matriciel)

Formule Excel (simplifiée de sa forme `INDIRECT/ADDRESS/MATCH`) :

```
Si C="" OU G="" OU H="" :  V = 0
Sinon :
   widthIdx  = MATCH_EXACT_OR_APPROX(snappedW, grille.widths)     // 1-based
   heightIdx = MATCH_EXACT_OR_APPROX(snappedH, grille.heights)    // 1-based
   prix = grille.prices[heightIdx-1][widthIdx-1]
   Si prix == "" (cellule vide) :  V = -1     // dimension non disponible
   Sinon : V = prix
En cas d'erreur quelconque : V = 0
```

`MATCH_EXACT_OR_APPROX` = `IFERROR(MATCH(v, range, 0), MATCH(v, range, 1))` :
1. essaie une **correspondance exacte** ;
2. sinon **correspondance approchée par défaut** (= plus grande valeur **≤** `v`, en supposant la plage **triée croissant**).

Comme les dimensions sont déjà accrochées au pas exact de la grille, la correspondance est quasi toujours exacte. La valeur `-1` signale une **cellule vide** dans la matrice (combinaison L×H non tarifée) → message « ⚠ Dimension non disponible ».

```js
function matchExactOrApprox(v, arr) {
  const i = arr.indexOf(v);
  if (i !== -1) return i;                 // 0-based
  let best = -1;                          // approx: plus grand <= v
  for (let k = 0; k < arr.length; k++) if (arr[k] <= v) best = k; else break;
  return best;                            // -1 si aucun
}
function tarifBaie(line, routing, grids) {
  const { type, L, H } = line;
  if (!type || L === '' || H === '') return 0;
  const r = routing[type];
  const g = grids[r.onglet];
  const sw = snap(L, r.width_first, r.width_step, r.L_max);
  const sh = snap(H, r.height_first, r.height_step, r.H_max);
  const wi = matchExactOrApprox(sw, g.widths);
  const hi = matchExactOrApprox(sh, g.heights);
  if (wi < 0 || hi < 0) return -1;
  const p = g.prices[hi][wi];
  return (p === '' || p == null) ? -1 : p;
}
```

### 6.4 Colonnes W → AE (les plus-values) + formule maîtresse S

```
snappedH (réutilisé pour le seuil 4 pts)

W (PV 4pts)   = (V==0) ? 0 : ( snappedH >= H_4pt ? V * PV4pts_pct : 0 )
X (PV coul.)  = (D=="" OU V==0) ? 0 : V * famille_pct(D)
Y (Forfait)   = (D=="") ? 0 : famille_forfait(D)              // NB: PAS dans S, sert au MAX du devis
Z (PV vitr.)  = (E=="") ? 0 : vitrage_pv(E)
AA(PV €/ml)   = (F=="" OU G=="" OU H=="") ? 0 : dormant_eurml(F) * 2*(G+H)/1000
AB(PV % baie) = (F=="" OU V==0) ? 0 : V * dormant_pctbaie(F)
AC(PV option) = (R vide/"Aucune option" OU type≠porte) ? 0
                : option_prix(R) * 0.75 * ( option_mult(R)==1 ? (type=="Porte Lourde 1 vantail"?1 : type=="Porte Lourde 2 vantaux"?2 : 1) : 1 ) * (1-remise)
AD(PV T/M)    = somme sur M,N,O des profilés ≠ vide/"Aucune" :
                  pv_brut = tm_price( type+"|"+profil )                       // §4.6
                  longueur = (profil commence par "Traverse") ? G : H         // mm
                  contribution = pv_brut * longueur/1000                      // €/ml brut × m
AE(Err T/M)   = nb de profilés (M,N,O) non vides/≠"Aucune" dont la clé type|profil est ABSENTE de la table §4.6 (>0 ⇒ incompatibilité)
```

**Drapeau hors-abaque** (réutilisé dans S) — vrai si G ou H hors des bornes **abaque** (§4.10) :

```
horsAbaque(line) =
   ( G≠"" ET G < abaque.L_min(type) ) OU ( G≠"" ET G > abaque.L_max(type) )
   OU ( H≠"" ET H < abaque.H_min(type) ) OU ( H≠"" ET H > abaque.H_max(type) )
```

**Formule maîtresse S (Prix unitaire net HT)** — logique condensée (l'Excel l'imbrique 4×, mais sémantiquement) :

```
S(line):
   1. Si horsAbaque(line)                       → S = ""   (vide, pas de prix)
   2. Sinon si R≠vide/"Aucune option" ET type∉portes  → S = "⚠ Option valable uniquement pour Porte Lourde"
   3. Sinon si AE > 0                            → S = "⚠ Option T/M incompatible avec la gamme"
   4. Sinon si V == 0 :                          // type/dim incomplet
         S = (AC > 0) ? AC : ""
   5. Sinon si V == -1                           → S = "⚠ Dimension non disponible"
   6. Sinon (cas normal) :
         base = (V + W + X + Z + AA + AB + AD) * (1 - remise) + AC
         si L (grille ventilation) == "OUI" : base += 25
         S = base
            + habillage_eurml(P) * (G + 2*H)/1000      // net, hors remise
            + bavette_eurml(Q)   * G/1000              // net, hors remise
```

> Détails confirmés par le calcul de référence (ligne 1 du fichier) :
> - Type = Coulissant 2v2r, L=1800, H=1200, Qté=1, Famille 1 Monocolore, vitrage standard (PV 0), dormant Standard (0), **Grille ventilation = OUI**, **Habillage = Cornière 60×30 (28,33 €/ml)**, **Bavette = Bavette 74 mm (48 €/ml)**, aucune option/T/M.
> - snappedW=1800, snappedH=1250 → **V = 1997**. W=0 (1250<2320). X=Z=AA=AB=AC=AD=0.
> - base = 1997 × (1−0,515) + 0 = **968,545** ; +25 (ventilation) = 993,545.
> - habillage = 28,33 × (1800+2×1200)/1000 = 28,33 × 4,2 = **118,986**.
> - bavette = 48 × 1800/1000 = **86,4**.
> - **S = 993,545 + 118,986 + 86,4 = 1198,931 €** ✓ (correspond exactement à la cellule Excel).

**T (Prix total)** : `T = (S est numérique) ? S * Qté : ""`.

### 6.5 Implémentation JS de référence (à coller dans l'app)

```js
// tables = objet importé de arc_data.json, indexé par clé (voir §11 pour la mise en map)
function computeLine(line, t, remise) {
  const { type, famille, vitrage, dormant, L, H, qte,
          ventilation, optTM1, optTM2, optTM3, habillage, bavette, optionPorte } = line;

  const isPorte = type === 'Porte Lourde 1 vantail' || type === 'Porte Lourde 2 vantaux';
  const r = t.routing[type];

  // hors abaque ?
  const ab = t.abaques[type];
  const hors = ab && (
    (L !== '' && (L < ab.L_min || L > ab.L_max)) ||
    (H !== '' && (H < ab.H_min || H > ab.H_max))
  );

  const V = tarifBaie(line, t.routing, t.grids);     // §6.3
  const sh = (type && H !== '') ? snap(H, r.height_first, r.height_step, r.H_max) : 0;

  const W  = V === 0 ? 0 : (sh >= r.H_4pt ? V * r.PV4pts_pct : 0);
  const fam = t.famille[famille] || { pct: 0, forfait: 0 };
  const X  = (!famille || V === 0) ? 0 : V * fam.pct;
  const Y  = !famille ? 0 : fam.forfait;            // pour MAX devis
  const Z  = !vitrage ? 0 : (t.vitrage[vitrage] ?? 0);
  const dm = t.dormant[dormant] || { eurml: 0, pct: 0 };
  const AA = (!dormant || L === '' || H === '') ? 0 : dm.eurml * 2 * (L + H) / 1000;
  const AB = (!dormant || V === 0) ? 0 : V * dm.pct;

  let AC = 0;
  if (optionPorte && optionPorte !== 'Aucune option' && isPorte) {
    const o = t.option[optionPorte];
    const mult = o.mult === 1 ? (type === 'Porte Lourde 2 vantaux' ? 2 : 1) : 1;
    AC = o.prix * 0.75 * mult * (1 - remise);
  }

  let AD = 0, AE = 0;
  for (const prof of [optTM1, optTM2, optTM3]) {
    if (!prof || prof === 'Aucune') continue;
    const key = type + '|' + prof;
    const pv = t.tm[key];
    if (pv === undefined) { AE++; continue; }
    const len = prof.startsWith('Traverse') ? L : H;
    AD += pv * len / 1000;
  }

  // erreurs / cas spéciaux
  if (hors) return { price: null, error: null };                          // cellule vide
  if (optionPorte && optionPorte !== 'Aucune option' && !isPorte)
    return { price: null, error: '⚠ Option valable uniquement pour Porte Lourde' };
  if (AE > 0) return { price: null, error: '⚠ Option T/M incompatible avec la gamme' };
  if (V === 0) return { price: AC > 0 ? AC : null, error: null };
  if (V === -1) return { price: null, error: '⚠ Dimension non disponible' };

  let base = (V + W + X + Z + AA + AB + AD) * (1 - remise) + AC;
  if (ventilation === 'OUI') base += 25;
  base += (t.habillage[habillage] ?? 0) * (L + 2 * H) / 1000;
  base += (t.bavette[bavette] ?? 0) * L / 1000;

  return { price: base, error: null, forfait: Y, total: (qte ? base * qte : 0) };
}

// Totaux du devis
function totals(lines, results, remise) {
  const totalLignes = results.reduce((s, x) => s + (typeof x.price === 'number' ? x.total : 0), 0);
  const forfaitMax  = Math.max(0, ...results.map(x => x.forfait || 0)) * (1 - remise);
  return { totalLignes, forfaitCouleur: forfaitMax, totalNetHT: totalLignes + forfaitMax, remise };
}
```

---

## 7. Génération automatique du « Commentaire position » (colonne J)

Texte multi-lignes (séparateur = `\n` / `CHAR(10)`) assemblé conditionnellement. Reproduction exacte de la logique :

```
si Type == "" → ""  (rien)
sinon, concaténer dans cet ordre, en sautant les fragments vides :

1. "<Type> aluminium"
2. si L et H : ", <L> × <H> mm"
3. si hors abaque : "\n⚠ Hors abaque (L <L_min>–<L_max> / H <H_min>–<H_max> mm)"   (bornes = abaque §4.10)
4. si système(Type) ≠ "" : "\nSystème : <système>"                 (§4.8)
5. si Famille couleur ≠ "" : "\nTraitement surface : <famille>"
6. si Vitrage ≠ "" : "\nVitrage : <vitrage>"
7. si Dormant ≠ "" : "\nCadre : <dormant>"
8. Poignée : "\nPoignée : <poignée>"      SAUF si (Type est porte lourde ET option contient "ventouse" ou "antipanique") OU poignée vide   (§4.9)
9. Fermeture : "\nFermeture : <fermeture>" même condition d'exclusion
10. fragment Traverses (AL) : si au moins une traverse (M/N/O commençant par "Traverse") : "\nTraverses : <t1>[, <t2>][, <t3>]"
11. fragment Meneaux  (AM) : si au moins un meneau (commençant par "Meneau") : "\nMeneaux : <m1>[, <m2>][, <m3>]"
12. si Option porte ≠ ""/"Aucune option" : "\nOption : <option>"
13. si Grille ventilation == "OUI" : "\nGrille de ventilation"
14. si Habillage ≠ ""/"Aucun" : "\nHabillage extérieur : <habillage>"
15. si Bavette ≠ ""/"Aucune" : "\nBavette : <bavette>"
```

Exemple (ligne de référence) :

```
Coulissant 2 vantaux 2 rails aluminium, 1800 × 1200 mm
Système : Aluk Group 67CL32
Traitement surface : Famille 1 Monocolore
Vitrage : 4 /20/ 4 (Fe Argon WE) Clair
Cadre : Standard (sans doublage)
Poignée : SARENA 20° sur vantail principal / Cuvette sur vantail secondaire
Fermeture : Serrure multipoints Slidelock
Grille de ventilation
Habillage extérieur : Cornière 60×30
Bavette : Bavette 74 mm (N99987)
```

> En React : afficher ce commentaire dans une cellule `white-space: pre-line` (les `\n` deviennent des retours à la ligne).

---

## 8. Validations & mises en forme conditionnelles (signaux visuels)

### 8.1 Listes déroulantes (data validations)
| Colonne(s) | Source |
|---|---|
| C14:C23 (Type) | `_Données!A3:A18` |
| D14:D23 (Famille) | `_Données!A21:A28` |
| E14:E23 (Vitrage) | `_Données!A48:A104` |
| F14:F23 (Dormant) | `_Données!A33:A43` |
| L14:L23 (Ventilation) | liste fixe `OUI,NON` |
| M14:O23 (Option T/M) | `_Données!A149:A154` |
| P14:P23 (Habillage) | `_Données!A218:A229` |
| Q14:Q23 (Bavette) | `_Données!A232:A236` |
| R14:R23 (Option porte) | `_Données!A109:A125` |

### 8.2 Mise en forme conditionnelle (cellules rouges)
Deux règles (type *expression*), à reproduire comme état visuel d'erreur (fond rouge) sur les champs Largeur/Hauteur :

- **G14:G23 (Largeur)** devient rouge si : `Type≠"" ET L≠"" ET (L < abaque.L_min OU L > abaque.L_max)`.
- **H14:H23 (Hauteur)** devient rouge si : `Type≠"" ET H≠"" ET (H < abaque.H_min OU H > abaque.H_max)`.

Quand une dimension est hors-abaque, le **prix ne s'affiche pas** (S = vide) et le commentaire ajoute « ⚠ Hors abaque (…) ». Le devis ne peut pas être validé pour cette ligne.

### 8.3 Autres signaux (déjà couverts par S, §6.4)
- Prix vide (S="") : ligne incomplète ou hors-abaque.
- « ⚠ Option valable uniquement pour Porte Lourde » : option porte sur un type non-porte.
- « ⚠ Option T/M incompatible avec la gamme » : traverse/meneau non prévu pour ce type.
- « ⚠ Dimension non disponible » : combinaison L×H sans prix dans la matrice (cellule vide).

---

## 9. Reconstruction Next.js / React — recommandations

### 9.1 Architecture proposée
```
/app
  /devis            → page principale (tableau multi-lignes + totaux)
/lib
  arc_data.json     → données (à importer)
  pricing.ts        → snap(), xlRound(), matchExactOrApprox(), tarifBaie(),
                      computeLine(), totals()  (cf. §6.5)
  data.ts           → transforme arc_data.json en Maps indexées (clé→valeur)
/components
  DevisRow.tsx      → une ligne (selects + inputs + prix)
  DevisTable.tsx    → 10 lignes + ligne totaux
  HeaderBlocks.tsx  → chantier / performances / demandeur
```

### 9.2 Modèle d'une ligne (state)
```ts
type DevisLine = {
  localisation?: string;
  type?: string;           // clé routing
  famille?: string;        // clé famille couleur
  vitrage?: string;        // clé vitrage
  dormant?: string;        // clé dormant
  L?: number; H?: number; qte?: number;
  observations?: string;
  ventilation?: 'OUI' | 'NON';
  optTM1?: string; optTM2?: string; optTM3?: string;   // profilés
  habillage?: string;
  bavette?: string;
  optionPorte?: string;
};
```

### 9.3 Indexation des tables (data.ts)
Transformer les listes de `arc_data.json` en Maps clé→valeur :
```ts
routing[label]        = { onglet, L_min, L_max, H_min, H_max, H_4pt, PV4pts_pct,
                          EUR_first_row, EUR_first_col, n_widths, n_heights,
                          width_first, width_step, height_first, height_step };
famille[label]        = { pct, forfait };
dormant[label]        = { eurml, pct };
vitrage[code]         = pv;                 // €
option[label]         = { prix, mult };
tm["Type|Profilé"]    = prixBrut;           // €/ml
habillage[label]      = eurml;
bavette[label]        = eurml;
grids[onglet]         = { widths, heights, prices };  // tel quel
abaques[type]         = { L_min, L_max, H_min, H_max };
```

### 9.4 Réactivité
- `remise` = contexte global (défaut `0.515`, champ % éditable « Paramètres »).
- Chaque ligne recalcule `computeLine` à chaque changement de champ.
- Listes déroulantes filtrées par cohérence facultative (ex. n'afficher les options portes que si Type ∈ portes), mais **conserver** les messages d'erreur Excel pour rester iso-comportement.
- Totaux : `totals()` (le **forfait couleur** = max des forfaits familles présentes × (1−remise), ajouté **une fois**).
- Date de la demande = `new Date()` (équiv. `TODAY()`).
- Commentaire (col J) = fonction `buildComment(line, tables, remise)` (§7), rendu en `pre-line`.

### 9.5 Pièges à respecter (sinon écarts de prix)
1. **xlRound** (half-up) pour l'accrochage des dimensions (§6.2). Critique.
2. **Forfait couleur** = jamais dans le prix unitaire ; uniquement au total, en MAX, remisé.
3. **Option porte / habillage / bavette / ventilation +25 €** ajoutés **APRÈS** la remise.
4. **PV traverses/meneaux** : Traverse → ×Largeur, Meneau → ×Hauteur, prix brut ÷1000 ; puis remisé (inclus dans le bloc remisé `V+W+X+Z+AA+AB+AD`).
5. Clamp dimensions sur `width_first…L_max` / `height_first…H_max` (routage), mais contrôle **rouge** sur l'abaque (§4.10).
6. `V = -1` (cellule vide) ≠ `V = 0` (champ incomplet) : messages différents.
7. Respecter les **clés textuelles exactes** des listes (accents, espaces, « × », casse).

---

## 10. Procédure de test (non-régression)

Cas de référence (à reproduire au centime) :

| Champ | Valeur |
|---|---|
| Type | Coulissant 2 vantaux 2 rails |
| Largeur × Hauteur | 1800 × 1200 mm |
| Qté | 1 |
| Famille | Famille 1 Monocolore |
| Vitrage | 4 /20/ 4 (Fe Argon WE) Clair |
| Dormant | Standard (sans doublage) |
| Grille ventilation | OUI |
| Habillage | Cornière 60×30 |
| Bavette | Bavette 74 mm (N99987) |
| **Résultat attendu** | **V (baie) = 1997 ; S (unitaire net HT) = 1198,931 € ; T = 1198,931 €** |

Détail : `1997×0,485 = 968,545 → +25 (ventil.) = 993,545 → +118,986 (habillage) → +86,4 (bavette) = 1198,931`.

---

## 11. Fichier de données `arc_data.json`

Structure (toutes les valeurs y sont, dont les **16 matrices de prix**) :

```jsonc
{
  "remise_default": 0.515,
  "routing":   [ { "label","onglet","L_min","L_max","H_min","H_max",
                   "H_1pt","H_2pt","H_3pt","H_4pt","PV4pts_pct",
                   "EUR_first_row","EUR_first_col","n_widths","n_heights",
                   "width_first","width_step","height_first","height_step" }, … (16) ],
  "color_families": [ ["label", pct, forfait], … ],
  "dormants":       [ ["label", eurml, pctBaie], … ],
  "vitrages":       [ ["code", pvEur, "catégorie"], … (57) ],
  "door_options":   [ ["label", prixPublic, multVantail], … (17) ],
  "tm_prices":      [ ["Type|Profilé", prixMlBrut], … (15) ],
  "tm_list":        [ "Aucune","Traverse 70 mm", … ],
  "systems":        [ ["Type","Système"], … ],
  "poignees_fermetures": [ ["Type","Poignée","Fermeture"], … ],
  "abaques":        [ ["Type", Lmin, Lmax, Hmin, Hmax], … (16) ],
  "habillage_exterieur": [ ["label", eurml], … ],
  "bavette":        [ ["label", eurml], … ],
  "price_grids":  { "<onglet>": { "widths":[…], "heights":[…], "prices":[[…],…] }, … (16) }
}
```

`price_grids[onglet].prices[i][j]` = prix € HT (non remisé) pour `heights[i] × widths[j]`.

---

## 12. Résumé des constantes « magiques » à ne pas perdre

- **Remise par défaut** : `0,515`.
- **Pas dimensions** : `100 mm` (largeur & hauteur), tous types.
- **Seuil PV 4 points** : hauteur accrochée `≥ 2320 mm` → `+4 %` du tarif baie (coulissants & galandages uniquement).
- **Grille de ventilation** : `+25 €` net (après remise).
- **Coefficient option porte** : `× 0,75` (puis `× (1−remise)`, déjà net).
- **Forfait couleur** : `99 €` (familles « PLUS »/2/3/4) ou `275 €` (familles 5/6), **1× par devis**, en MAX, remisé.
- **Habillage** : `€/ml × (L + 2·H)/1000` ; **Bavette** : `€/ml × L/1000` ; **Dormant €/ml** : `€/ml × 2·(L+H)/1000`. Tous en mètres (÷1000).
- **`V = -1`** = combinaison L×H sans prix ; **`V = 0`** = ligne incomplète.
- **Arrondi** : `ROUND_HALF_UP` (jamais bancaire).

