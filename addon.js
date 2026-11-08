/* Comptes + classement + succès — Finance alternative QCM (ENCG Fès)
   Mode local (par défaut) : comptes et classement dans le navigateur.
   Mode cloud : si /api/health répond (Cloudflare Pages + KV), les
   comptes et le classement passent par l'API et sont partagés. */
(function () {
  'use strict';
  var LS_USERS = 'fa_qcm_users_v1';
  var LS_SESSION = 'fa_qcm_session_v1';
  var LS_STATS = 'fa_qcm_stats_v1';
  var LS_ACH = 'fa_qcm_ach_v1';
  var cloudMode = false;

  function loadJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- mot de passe haché (SHA-256, repli simple hors HTTPS) ---------- */
  function hashPassword(pw) {
    try {
      if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode('fa-qcm::' + pw))
          .then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) {
              return ('0' + b.toString(16)).slice(-2);
            }).join('');
          }).catch(function () { return fallbackHash(pw); });
      }
    } catch (e) {}
    return Promise.resolve(fallbackHash(pw));
  }
  function fallbackHash(pw) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < pw.length; i++) {
      var ch = pw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'fb-' + (h2 >>> 0).toString(16) + '-' + (h1 >>> 0).toString(16);
  }

  /* ---------- prix : 3 niveaux seulement, selon les points ----------
     10 points par bonne réponse.
     🥉 Bronze : 1 bonne réponse (10 pts) — celui qui a eu un peu
     🥈 Argent : 20 bonnes réponses (200 pts) — le niveau du milieu
     🥇 Or : 50 bonnes réponses (500 pts) — celui qui a eu beaucoup de points */
  var ACH = [
    { id: 'bronze', icon: '🥉', title: 'Bronze', desc: '1 bonne réponse (10 points)', kind: 'correct', target: 1 },
    { id: 'silver', icon: '🥈', title: 'Argent', desc: '20 bonnes réponses (200 points)', kind: 'correct', target: 20 },
    { id: 'gold', icon: '🥇', title: 'Or', desc: '50 bonnes réponses (500 points)', kind: 'correct', target: 50 }
  ];
  function tierFor(stats) {
    var c = (stats && stats.totalCorrect) || 0;
    if (c >= 50) return { icon: '🥇', name: 'Or' };
    if (c >= 20) return { icon: '🥈', name: 'Argent' };
    if (c >= 1) return { icon: '🥉', name: 'Bronze' };
    return { icon: '—', name: 'Aucun prix' };
  }
  function achProgress(a, stats) {
    return Math.min(stats.totalCorrect || 0, a.target) + '/' + a.target + ' bonnes réponses';
  }
  function achUnlocked(a, stats) {
    return (stats.totalCorrect || 0) >= a.target;
  }
  function getUnlocked(username) {
    var all = loadJSON(LS_ACH, {});
    return all[username] || [];
  }
  function checkAchievements(stats) {
    var username = stats.username;
    var unlocked = getUnlocked(username);
    var newly = [];
    ACH.forEach(function (a) {
      if (unlocked.indexOf(a.id) === -1 && achUnlocked(a, stats)) {
        unlocked.push(a.id); newly.push(a);
      }
    });
    if (newly.length) {
      var all = loadJSON(LS_ACH, {}); all[username] = unlocked; saveJSON(LS_ACH, all);
    }
    return newly;
  }

  /* ---------- stats locales ---------- */
  function blankStats(name, username) {
    return { name: name, username: username, totalCorrect: 0, totalWrong: 0, totalUnanswered: 0, totalAnswered: 0, sessions: 0, bestScore: 0, bestPercentage: 0, perfectExams: 0, lastPlayedAt: null };
  }
  function getStats(username) {
    var all = loadJSON(LS_STATS, {});
    return all[username] || null;
  }
  function saveStats(stats) {
    var all = loadJSON(LS_STATS, {}); all[stats.username] = stats; saveJSON(LS_STATS, all);
  }
  function leaderboardLocal() {
    var all = loadJSON(LS_STATS, {});
    var list = Object.keys(all).map(function (k) { return all[k]; });
    list.forEach(function (s) {
      s.points = (s.totalCorrect || 0) * 10;
      var ans = (s.totalCorrect || 0) + (s.totalWrong || 0);
      s.accuracy = ans > 0 ? Math.round((s.totalCorrect / ans) * 100) : 0;
    });
    list.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return (a.sessions || 0) - (b.sessions || 0);
    });
    return list;
  }

  /* ---------- session / affichage ---------- */
  function currentSession() { return loadJSON(LS_SESSION, null); }
  function setSession(s) { if (s) saveJSON(LS_SESSION, s); else { try { localStorage.removeItem(LS_SESSION); } catch (e) {} } }
  function showToast(text) {
    var t = $('fa-toast'); if (!t) return;
    t.textContent = text; t.classList.add('is-visible');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('is-visible'); }, 3800);
  }
  function refreshTopbar() {
    var s = currentSession();
    var bar = $('fa-topbar');
    if (!s) { if (bar) bar.classList.remove('is-visible'); return; }
    var stats = getStats(s.username) || blankStats(s.name, s.username);
    if (bar) bar.classList.add('is-visible');
    var av = $('fa-avatar'); if (av) av.textContent = (s.name || '?').trim().charAt(0).toUpperCase();
    var nm = $('fa-display-name'); if (nm) nm.textContent = s.name;
    var sub = $('fa-display-sub');
    if (sub) {
      var rank = leaderboardLocal().findIndex(function (x) { return x.username === s.username; });
      var tier = tierFor(stats);
      sub.textContent = '@' + s.username + ' • ' + tier.icon + ' ' + tier.name + ' • ✅ ' + (stats.totalCorrect || 0) + ' correctes • ' + (rank >= 0 ? '🏆 #' + (rank + 1) : 'Pas encore classé');
    }
  }
  function showAuth() {
    var a = $('fa-auth'); if (a) a.classList.remove('is-hidden');
    var bar = $('fa-topbar'); if (bar) bar.classList.remove('is-visible');
  }
  function hideAuth() {
    var a = $('fa-auth'); if (a) a.classList.add('is-hidden');
    refreshTopbar();
  }

  /* ---------- classement ---------- */
  function renderLeaderboard(entries, note) {
    var body = $('fa-lb-body'); if (!body) return;
    var me = currentSession();
    if (note) { var n = $('fa-lb-note'); if (n) n.textContent = note; }
    if (!entries || !entries.length) {
      body.innerHTML = '<p class="fa-empty">Aucun score pour le moment. Sois le premier à jouer !</p>';
      return;
    }
    var rows = entries.map(function (e, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      var tier = tierFor(e);
      var cls = me && e.username === me.username ? ' class="is-me"' : '';
      return '<tr' + cls + '><td><span class="fa-rank">' + medal + '</span></td>' +
        '<td>' + esc(e.name) + '<br><span class="text-muted">@' + esc(e.username) + '</span></td>' +
        '<td>' + tier.icon + ' ' + esc(tier.name) + '</td>' +
        '<td>✅ ' + (e.totalCorrect || 0) + '</td><td>❌ ' + (e.totalWrong || 0) + '</td>' +
        '<td>' + (e.accuracy != null ? e.accuracy : 0) + '%</td>' +
        '<td><strong>' + (e.points != null ? e.points : (e.totalCorrect || 0) * 10) + '</strong></td>' +
        '<td>' + (e.sessions || 0) + '</td></tr>';
    }).join('');
    body.innerHTML = '<table class="fa-table"><thead><tr><th>#</th><th>Joueur</th><th>Prix</th><th>Correctes</th><th>Fausses</th><th>Précision</th><th>Points</th><th>Sessions</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function openLeaderboard() {
    $('fa-modal-leaderboard').classList.add('is-open');
    if (cloudMode) {
      fetch('/api/leaderboard').then(function (r) { return r.json(); }).then(function (d) {
        renderLeaderboard(d.entries || [], 'Classement partagé — tous les joueurs, mis à jour après chaque session.');
      }).catch(function () { renderLeaderboard(leaderboardLocal(), 'Classement local (mode hors-ligne sur cet appareil).'); });
    } else {
      renderLeaderboard(leaderboardLocal(), 'Classement local — sur cet appareil uniquement. Le classement partagé s’active avec le backend Cloudflare (KV).');
    }
  }
  function openAchievements() {
    var s = currentSession(); if (!s) return;
    var stats = getStats(s.username) || blankStats(s.name, s.username);
    var unlocked = getUnlocked(s.username);
    var body = $('fa-ach-body'); if (!body) return;
    body.innerHTML = ACH.map(function (a) {
      var ok = unlocked.indexOf(a.id) !== -1;
      return '<div class="fa-ach ' + (ok ? 'is-unlocked' : 'is-locked') + '">' +
        '<div class="fa-ach-icon">' + a.icon + '</div><div>' +
        '<div class="fa-ach-title">' + esc(a.title) + (ok ? ' ✓' : '') + '</div>' +
        '<div class="fa-ach-desc">' + esc(a.desc) + '</div>' +
        '<div class="fa-ach-progress">' + esc(achProgress(a, stats)) + '</div>' +
        '</div></div>';
    }).join('');
    $('fa-modal-achievements').classList.add('is-open');
  }
  function closeModals() {
    document.querySelectorAll('.fa-modal').forEach(function (m) { m.classList.remove('is-open'); });
  }

  /* ---------- enregistrement d'un résultat (appelé par le QCM) ---------- */
  function recordLocal(result) {
    var s = currentSession(); if (!s) return [];
    var stats = getStats(s.username) || blankStats(s.name, s.username);
    var correct = result.correctCount != null ? result.correctCount : (result.score || 0);
    var wrong = result.incorrectCount != null ? result.incorrectCount : 0;
    var unans = result.unansweredCount != null ? result.unansweredCount : 0;
    stats.totalCorrect += correct;
    stats.totalWrong += wrong;
    stats.totalUnanswered += unans;
    stats.totalAnswered += correct + wrong + unans;
    stats.sessions += 1;
    if (correct > (stats.bestScore || 0)) stats.bestScore = correct;
    if ((result.percentage || 0) > (stats.bestPercentage || 0)) stats.bestPercentage = result.percentage;
    if (result.mode === 'exam' && result.percentage === 100 && (result.totalQuestions || 0) >= 10) stats.perfectExams = (stats.perfectExams || 0) + 1;
    stats.lastPlayedAt = new Date().toISOString();
    saveStats(stats);
    return checkAchievements(stats);
  }
  window.__FA_onResult = function (result) {
    try {
      var s = currentSession(); if (!s || !result) return;
      if (cloudMode && s.token) {
        fetch('/api/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: s.token, result: result })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.stats) saveStats(d.stats);
          var names = (d && d.unlockedNames) || [];
          names.forEach(function (n) { showToast('🎖️ Prix débloqué : ' + n); });
          refreshTopbar();
        }).catch(function () {
          var newly = recordLocal(result);
          newly.forEach(function (a) { showToast('🎖️ Prix débloqué : ' + a.title); });
          refreshTopbar();
        });
        return;
      }
      var newly = recordLocal(result);
      newly.forEach(function (a) { showToast('🎖️ Prix débloqué : ' + a.title); });
      refreshTopbar();
    } catch (e) { /* ne jamais casser le QCM */ }
  };

  /* ---------- auth ---------- */
  function showError(id, msg) {
    var el = $(id); if (!el) return;
    el.textContent = msg; el.classList.add('is-visible');
  }
  function clearErrors() {
    document.querySelectorAll('.fa-error').forEach(function (el) { el.classList.remove('is-visible'); el.textContent = ''; });
  }
  function validUsername(u) { return /^[a-z0-9._-]{3,20}$/.test(u); }
  function switchTab(which) {
    $('fa-tab-login').classList.toggle('is-active', which === 'login');
    $('fa-tab-register').classList.toggle('is-active', which === 'register');
    $('fa-form-login').style.display = which === 'login' ? '' : 'none';
    $('fa-form-register').style.display = which === 'register' ? '' : 'none';
    clearErrors();
  }
  function afterLogin(session) {
    setSession(session);
    hideAuth();
    showToast('👋 Bienvenue, ' + session.name + ' !');
  }

  function initAuth() {
    $('fa-tab-login').addEventListener('click', function () { switchTab('login'); });
    $('fa-tab-register').addEventListener('click', function () { switchTab('register'); });

    $('fa-form-register').addEventListener('submit', function (ev) {
      ev.preventDefault(); clearErrors();
      var name = $('fa-reg-name').value.trim();
      var username = $('fa-reg-username').value.trim().toLowerCase();
      var password = $('fa-reg-password').value;
      if (name.length < 2) return showError('fa-reg-error', 'Écris ton nom complet.');
      if (!validUsername(username)) return showError('fa-reg-error', 'Nom d’utilisateur : 3 à 20 caractères, lettres, chiffres, . _ -');
      if (password.length < 4) return showError('fa-reg-error', 'Mot de passe : 4 caractères minimum.');
      hashPassword(password).then(function (hash) {
        if (cloudMode) {
          return fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, username: username, passwordHash: hash }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) return showError('fa-reg-error', d.error || 'Inscription impossible.');
              afterLogin({ username: username, name: name, token: d.token });
            }).catch(function () { showError('fa-reg-error', 'Serveur injoignable. Réessaie.'); });
        }
        var users = loadJSON(LS_USERS, {});
        if (users[username]) return showError('fa-reg-error', 'Ce nom d’utilisateur existe déjà. Choisis-en un autre.');
        users[username] = { name: name, username: username, passHash: hash, createdAt: new Date().toISOString() };
        saveJSON(LS_USERS, users);
        if (!getStats(username)) saveStats(blankStats(name, username));
        afterLogin({ username: username, name: name });
      });
    });

    $('fa-form-login').addEventListener('submit', function (ev) {
      ev.preventDefault(); clearErrors();
      var username = $('fa-login-username').value.trim().toLowerCase();
      var password = $('fa-login-password').value;
      if (!username || !password) return showError('fa-login-error', 'Remplis les deux champs.');
      hashPassword(password).then(function (hash) {
        if (cloudMode) {
          return fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, passwordHash: hash }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (!d.ok) return showError('fa-login-error', d.error || 'Nom d’utilisateur ou mot de passe incorrect.');
              if (!getStats(username)) saveStats(blankStats(d.name, username));
              afterLogin({ username: username, name: d.name, token: d.token });
            }).catch(function () { showError('fa-login-error', 'Serveur injoignable. Réessaie.'); });
        }
        var users = loadJSON(LS_USERS, {});
        var u = users[username];
        if (!u || u.passHash !== hash) return showError('fa-login-error', 'Nom d’utilisateur ou mot de passe incorrect.');
        afterLogin({ username: username, name: u.name });
      });
    });

    $('fa-btn-logout').addEventListener('click', function () { setSession(null); location.reload(); });
    $('fa-btn-leaderboard').addEventListener('click', openLeaderboard);
    $('fa-btn-achievements').addEventListener('click', openAchievements);
    document.querySelectorAll('[data-fa-close]').forEach(function (b) { b.addEventListener('click', closeModals); });
    document.querySelectorAll('.fa-modal').forEach(function (m) {
      m.addEventListener('click', function (ev) { if (ev.target === m) closeModals(); });
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeModals(); });

    var s = currentSession();
    if (s) {
      var users = loadJSON(LS_USERS, {});
      if (cloudMode || users[s.username]) { hideAuth(); } else { setSession(null); showAuth(); }
    } else { showAuth(); }
    refreshTopbar();
  }

  /* ---------- détection cloud ---------- */
  function detectCloud() {
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 2000);
      fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' }).then(function (r) {
        clearTimeout(timer);
        if (r && r.ok) { cloudMode = true; refreshTopbar(); }
      }).catch(function () { clearTimeout(timer); });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAuth(); detectCloud(); });
  } else { initAuth(); detectCloud(); }
})();
