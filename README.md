# Finance alternative — QCM ENCG (avec comptes, classement et succès)

Site d'entraînement aux QCM de Finance Alternative (Crowdfunding & Finance
Islamique) — ENCG Fès. 120 questions : 60 Axe 1 (Crowdfunding) + 60 Axe 2
(Finance Islamique), 100 à choix unique + 20 à choix multiples.

## Ce qui a été ajouté à ton HTML d'origine

Ton fichier d'origine est gardé intact (les 120 QCM, le design sombre
teal/navy, l'entraînement + l'examen chronométré, l'historique local).

Ajouts :

1. **Compte** — écran d'accueil : créer un compte (nom complet + nom
   d'utilisateur + mot de passe) ou se connecter. Le mot de passe est haché
   (SHA-256) avant d'être stocké. Déconnexion dans la barre du haut.
2. **Classement** — bouton 🏆 Classement : rang, nom, ✅ bonnes réponses,
   ❌ mauvaises réponses, précision, points (10 points par bonne réponse),
   nombre de sessions. Ton rang est surligné.
3. **Prix — 3 niveaux seulement**, selon les points (10 points par bonne
   réponse), bouton 🏆 Mes prix :
   - 🥉 **Bronze** : 1 bonne réponse (10 points) — celui qui a eu un peu
   - 🥈 **Argent** : 20 bonnes réponses (200 points) — le niveau du milieu
   - 🥇 **Or** : 50 bonnes réponses (500 points) — celui qui a eu beaucoup
     de points

   Le prix de chaque joueur s'affiche dans le classement et dans la barre
   du haut. Un toast s'affiche quand tu débloques un prix. Chaque session
   (entraînement ou examen) met à jour tes stats, ton classement et ton
   prix automatiquement.

## Deux modes — important

- **Mode local (par défaut, sans backend)** : comptes, stats et classement
  sont dans le `localStorage` du navigateur. Ça marche tout de suite, mais
  le classement ne se voit que sur le même appareil / navigateur : tes
  camarades sur leur téléphone ne te verront pas, et tu ne les verras pas.
- **Mode partagé (Cloudflare Pages + KV)** : les fichiers
  `functions/api/*.js` + `wrangler.toml` sont prêts. Une fois déployé avec
  un namespace KV `FA_KV`, les comptes et le classement sont partagés entre
  tous les joueurs. Le site détecte tout seul `/api/health` et bascule en
  mode partagé ; sinon il retombe en mode local.

## Fichiers

- `index.html` — le site complet (généré par `build.py` depuis ton HTML)
- `addon.css` / `addon.html` / `addon.js` — les ajouts (comptes, classement, succès)
- `build.py` — régénère `index.html` depuis ton HTML d'origine
- `functions/api/` — backend Cloudflare Pages Functions (KV) : health,
  register, login, submit, leaderboard (+ `_shared.js`)
- `wrangler.toml` — config Cloudflare Pages (remplacer `REPLACE_WITH_KV_ID`)

## Déploiement GitHub + Cloudflare Pages

```bash
# 1. Nouveau repo GitHub, puis :
git init && git add . && git commit -m "Finance QCM ENCG + comptes/classement/succès"
git branch -M main
git remote add origin https://github.com/<ton-compte>/finance-qcm-encg.git
git push -u origin main

# 2. Cloudflare Pages : Create application > Pages > Connect to Git
#    (repo finance-qcm-encg, build command vide, output directory = racine)

# 3. Pour le classement PARTAGÉ, créer le KV une fois :
npx wrangler kv namespace create FA_KV
npx wrangler kv namespace create FA_KV --preview
#    puis coller les ids dans wrangler.toml, et dans Cloudflare Pages :
#    Settings > Functions > KV namespace bindings > FA_KV = le namespace créé.
#    Sans cette étape, le site marche quand même, mais en mode local.
```

## Sécurité — à savoir pour l'examen

C'est un site d'entraînement entre camarades, pas un service bancaire :
les mots de passe sont hachés côté navigateur, il n'y a pas de
réinitialisation de mot de passe par e-mail, et un joueur motivé pourrait
tricher en modifiant son `localStorage` en mode local. En mode Cloudflare
KV, les scores passent par le serveur, mais il n'y a pas d'anti-triche
forte. Suffisant pour réviser et se challenger en classe, pas pour un
examen officiel noté.
