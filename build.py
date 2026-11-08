#!/usr/bin/env python3
"""Build finance-qcm/index.html from the user's original HTML + add-ons.
Keeps all 120 QCM questions intact; only adds:
 - a hook call in submitExam / finishTraining -> window.__FA_onResult(result)
 - auth / leaderboard / achievements CSS + HTML + JS
"""
import pathlib

base = pathlib.Path.home() / "workspace/finance-qcm"
src = pathlib.Path.home() / "workspace/user/files/Finance_alternative_QCM_autonome_0_4pzw.html"
html = src.read_text(encoding="utf-8")

# --- 1. hooks in the original (minified) JS ---
old_exam = 'return this.lastExamResults=m,g.saveSessionToHistory'
new_exam = 'return this.lastExamResults=m,(window.__FA_onResult?window.__FA_onResult(m):0),g.saveSessionToHistory'
assert html.count(old_exam) == 1, f"exam hook anchor count={html.count(old_exam)}"
html = html.replace(old_exam, new_exam)

old_tr = 'g.saveSessionToHistory({id:"session_"+Date.now(),date:new Date().toISOString(),mode:"training"'
new_tr = ('(window.__FA_onResult?window.__FA_onResult({mode:"training",axis:this.activeSession.axis,'
          'topic:this.activeSession.topic,totalQuestions:e,score:n,percentage:r,correctCount:n,'
          'incorrectCount:Object.values(this.activeSession.scores).filter(function(a){return a===0}).length,'
          'unansweredCount:e-Object.keys(this.activeSession.scores).length,timeSpentSeconds:i}):0),'
          'g.saveSessionToHistory({id:"session_"+Date.now(),date:new Date().toISOString(),mode:"training"')
assert html.count(old_tr) == 1, f"training hook anchor count={html.count(old_tr)}"
html = html.replace(old_tr, new_tr)

# --- 2. CSS ---
css = (base / "addon.css").read_text(encoding="utf-8")
assert html.count("</style>") == 1
html = html.replace("</style>", css + "\n</style>", 1)

# --- 3. HTML: topbar before #app, auth/modals after #app ---
addon_html = (base / "addon.html").read_text(encoding="utf-8")
marker = '<div id="fa-auth">'
assert marker in addon_html
topbar, rest = addon_html.split(marker, 1)
rest = marker + rest
assert html.count('<div id="app"></div>') == 1
html = html.replace('<div id="app"></div>', topbar + '<div id="app"></div>\n' + rest, 1)

# --- 4. JS after the original script ---
js = (base / "addon.js").read_text(encoding="utf-8")
idx = html.rfind("</script>")
assert idx > 0
html = html[: idx + len("</script>")] + "\n<script>\n" + js + "\n</script>" + html[idx + len("</script>"):]

# --- 5. meta description update (accounts/leaderboard) ---
html = html.replace(
    'content="Site web d\'entraînement interactif aux QCM de Finance Alternative (Crowdfunding &amp; Finance Islamique) — ENCG Fès"',
    'content="QCM de Finance Alternative (Crowdfunding &amp; Finance Islamique) — ENCG Fès : compte, classement et succès"',
    1,
)

out = base / "index.html"
out.write_text(html, encoding="utf-8")
print(f"built {out} ({out.stat().st_size} bytes)")
print("questions still present:", html.count('"id":"FA-'))
