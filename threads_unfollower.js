/* =========================================================================
   THREADS - Takip etmeyenleri bul & takipten çık  (v6 - ÇIKARMA DÜZELTME)
   Liste MODAL içinde taranır. Çıkarma: profil -> "Takip ediliyor" -> menü
   "Unfollow" (gerçek click event) -> doğrulama.
   KULLANIM:
     1) Profil -> "X takip ediliyor" / "Following" yazısına tıkla.
     2) F12 -> Console. Bu kodun TAMAMINI yapıştır, Enter.
     3) "TARA" -> önce Following, sonra Followers taranır.
     4) "Seni takip etmeyen" kişiler listelenir.
        - @kullanıcıya tıkla -> profiline gider
        - "Çık" -> sadece o kişiyi çıkarır
        - "TÜMÜNÜ ÇIKAR" -> 3 sn arayla hepsini çıkarır
        - "DURDUR" -> istediğin an durdurur
   NOT: Popup (açılır pencere) iznini tarayıcıda ver.
   ========================================================================= */
(function () {
  "use strict";
  const HOST = location.origin;
  const INTER_WAIT = 3000; // kişi başı aradaki bekleme (ms)
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function cleanUser(href) {
    if (!href) return null;
    let u = (href.split(/[?#]/)[0] || "");
    if (!u.startsWith("/@")) return null;
    u = u.slice(2);
    if (/(post|media|replies|reposts|explore|search|following|followers)\b/i.test(u)) return null;
    if (!/^[A-Za-z0-9._]+$/.test(u)) return null;
    return u || null;
  }

  // En spesifik (en kısa metinli, en içteki) eşleşmeyi bul
  function bestMatch(root, keywords) {
    const els = [...root.querySelectorAll("*")];
    const cands = [];
    for (const el of els) {
      const t = (el.textContent || "").trim().toLowerCase();
      if (!t) continue;
      if (keywords.some((k) => t.includes(k.toLowerCase()))) {
        // anchor ama /following/ gibi nav link'i ise atla
        const href = (el.getAttribute && el.getAttribute("href")) || "";
        if (/(following|followers)\//i.test(href)) continue;
        cands.push(el);
      }
    }
    if (!cands.length) return null;
    // en kısa metinli olanı tercih et (en içteki buton genelde odur)
    cands.sort((a, b) => {
      const ta = (a.textContent || "").trim().length;
      const tb = (b.textContent || "").trim().length;
      if (ta !== tb) return ta - tb;
      return a.querySelectorAll("*").length - b.querySelectorAll("*").length;
    });
    return cands[0];
  }

  // Gerçek tıklama event'i gönder (React/Instagram için gerekli)
  function dispatchClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (typeof el.click === "function") { try { el.click(); } catch (e) {} }
  }

  function findDialog() {
    const dlg = document.querySelector('[role="dialog"]');
    if (dlg) return dlg;
    const all = [...document.querySelectorAll("*")];
    for (const el of all) {
      const t = el.textContent || "";
      if (/following|takip ediliyor/i.test(t) && /followers|takipçi/i.test(t) && el.children.length > 1) {
        if (el.tagName !== "BODY" && el.tagName !== "HTML") return el;
      }
    }
    return null;
  }

  function findTabIn(root, kw) {
    const cand = [...root.querySelectorAll("*")].filter((e) => {
      const t = (e.textContent || "").trim();
      return kw.test(t) && t.length < 30 && e.children.length === 0;
    });
    return cand[0] || null;
  }

  async function scrapeCurrentTab(label) {
    const dialog = findDialog();
    if (!dialog) { log("⚠ [" + label + "] liste penceresi bulunamadı!"); return new Set(); }
    const all = new Set();
    let last = -1, stable = 0;
    for (let i = 0; i < 250; i++) {
      const links = [...dialog.querySelectorAll('a[href^="/@"]')]
        .map((a) => cleanUser(a.getAttribute("href")))
        .filter(Boolean);
      links.forEach((u) => all.add(u));
      const scrollers = [...dialog.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        return (s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
      });
      if (scrollers.length === 0) window.scrollTo(0, document.body.scrollHeight);
      scrollers.forEach((sc) => { sc.scrollTop = sc.scrollHeight; });
      await delay(500);
      const cnt = links.length;
      if (cnt === last) { stable++; if (stable >= 5) break; } else stable = 0;
      last = cnt;
      if (i % 10 === 0) log("[" + label + "] taranıyor... (" + all.size + " bulundu)");
    }
    return all;
  }

  // Profildeki takip butonunu bulur. expectFollowing=true -> "Takip ediliyor"ı arar
  // (sol menüdeki /following/ nav linkini ELEMEZ, sadece role=main içindeki button'ları tarar)
  function findFollowBtn(doc, expectFollowing) {
    const main = doc.querySelector('[role="main"]') || doc;
    const els = [...main.querySelectorAll('button, [role="button"]')];
    const list = els.filter((b) => {
      const t = (b.textContent || "").trim().toLowerCase();
      const href = (b.getAttribute && b.getAttribute("href")) || "";
      if (/(following|followers)\//i.test(href)) return false; // sol menü nav linki
      if (expectFollowing) return /takip ediliyor|following/i.test(t) && !/follow\b/i.test(t);
      return /takip et|follow\b/i.test(t);
    });
    return list[0] || null;
  }

  async function unfollowUser(u) {
    const w = window.open(HOST + "/@" + u, "_blank");
    if (!w) { log("✗ Popup engellendi: @" + u + " (popup izni ver)"); return false; }
    let ok = false;
    for (let i = 0; i < 80; i++) {
      try {
        if (w.document && w.document.readyState === "complete" &&
            w.document.querySelector('button, [role="button"], a[href^="/@"]')) { ok = true; break; }
      } catch (e) {}
      await delay(250);
    }
    if (!ok) { log("✗ @" + u + " profil yüklenemedi"); try { w.close(); } catch (e) {} return false; }
    await delay(2000);

    // 1) profildeki "Takip ediliyor" / "Following" butonu (sol menü HARİÇ)
    let fb = null;
    for (let a = 0; a < 12 && !fb; a++) {
      fb = findFollowBtn(w.document, true);
      if (!fb) await delay(500);
    }
    if (!fb) { log("• @" + u + " takip butonu yok (zaten takipte değil?)"); try { w.close(); } catch (e) {} return false; }
    dispatchClick(fb);
    await delay(1500);

    // 2) menüden "Unfollow" (Türkçe: Takibi bırak)
    let uf = null;
    for (let a = 0; a < 12 && !uf; a++) {
      const menu = w.document.querySelector('[role="menu"]') ||
                   w.document.querySelector('[role="dialog"]') || w.document;
      uf = bestMatch(menu, ["takibi bırak", "unfollow", "takipten çık", "bırak", "remove"]);
      if (!uf) await delay(500);
    }
    if (!uf) {
      // belki direkt toggle (menü yok) — tekrar buton durumuna bak
      const re = findFollowBtn(w.document, false);
      if (re) { log("✓ @" + u + " çıkarıldı (menüsüz)"); try { w.close(); } catch (e) {} return true; }
      log("⚠ @" + u + " menüde 'Unfollow' bulunamadı");
      try { w.close(); } catch (e) {}
      return false;
    }
    dispatchClick(uf);
    await delay(1200);

    // 3) doğrulama: profildeki buton artık "Takip et" / "Follow" oldu mu?
    const after = findFollowBtn(w.document, false);
    const success = !!after;
    log((success ? "✓ @" + u + " çıkarıldı" : "⚠ @" + u + " çıkarıldı mı? (doğrulanamadı)"));
    await delay(800);
    try { w.close(); } catch (e) {} return true;
  }

  // --- durum / arayüz ----------------------------------------------------
  let targets = [];
  let running = false, stopFlag = false, doneCount = 0;

  function log(msg) {
    const el = document.getElementById("tu-log");
    if (!el) return;
    const d = document.createElement("div");
    d.textContent = "• " + msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }

  function buildPanel() {
    if (document.getElementById("tu-panel")) return;
    const css = `
      #tu-panel{position:fixed;top:12px;right:12px;width:340px;max-height:90vh;z-index:999999;
        background:#0f0f12;color:#eee;font:13px/1.4 Arial,Helvetica,sans-serif;
        border:1px solid #333;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.6);
        display:flex;flex-direction:column;overflow:hidden}
      #tu-panel h3{margin:0;padding:10px 12px;background:#1d1d22;font-size:14px;
        display:flex;justify-content:space-between;align-items:center}
      #tu-panel .body{padding:10px 12px;overflow:auto}
      #tu-panel button{cursor:pointer;border:0;border-radius:6px;padding:7px 10px;margin:3px 3px 3px 0;
        font-size:12px;font-weight:600;color:#fff}
      .tu-scan{background:#2563eb}.tu-go{background:#16a34a}.tu-stop{background:#dc2626}
      .tu-row{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #222}
      .tu-row a{color:#7dd3fc;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tu-mini{background:#374151;padding:4px 8px;font-size:11px}
      #tu-log{background:#000;color:#9ca3af;height:120px;overflow:auto;padding:6px 8px;margin-top:8px;
        border-radius:6px;font-size:11px}
      #tu-count{font-weight:700;color:#fbbf24}
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const p = document.createElement("div");
    p.id = "tu-panel";
    p.innerHTML = `
      <h3><span>Threads · Takip Etmeyenler</span>
          <span style="cursor:pointer" id="tu-close">✕</span></h3>
      <div class="body">
        <div id="tu-actions">
          <button class="tu-scan" id="tu-scan">TARA</button>
          <button class="tu-go" id="tu-goall" disabled>TÜMÜNÜ ÇIKAR</button>
          <button class="tu-stop" id="tu-stop" disabled>DURDUR</button>
        </div>
        <div style="margin:6px 0">Durum: <span id="tu-count">hazır</span></div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">
          Önce Following/Followers listesini aç, sonra TARA'ya bas.</div>
        <div id="tu-list"></div>
        <div id="tu-log"></div>
      </div>`;
    document.body.appendChild(p);

    document.getElementById("tu-close").onclick = () => p.remove();
    document.getElementById("tu-scan").onclick = startScan;
    document.getElementById("tu-goall").onclick = startUnfollowAll;
    document.getElementById("tu-stop").onclick = () => { stopFlag = true; log("⏹ Durduruluyor..."); };
  }

  function renderList() {
    const list = document.getElementById("tu-list");
    list.innerHTML = "";
    targets.forEach((t) => {
      const row = document.createElement("div");
      row.className = "tu-row";
      const a = document.createElement("a");
      a.href = HOST + "/@" + t.user; a.target = "_blank"; a.textContent = "@" + t.user;
      const open = document.createElement("button");
      open.className = "tu-mini"; open.textContent = "Aç";
      open.onclick = () => window.open(HOST + "/@" + t.user, "_blank");
      const unf = document.createElement("button");
      unf.className = "tu-mini"; unf.style.background = "#b91c1c"; unf.textContent = "Çık";
      unf.onclick = async () => {
        unf.disabled = true; unf.textContent = "...";
        let ok = false;
        try { ok = await unfollowUser(t.user); } catch (e) { log("✗ Hata @" + t.user + ": " + e.message); }
        unf.textContent = ok ? "✓" : "✗";
      };
      row.appendChild(a); row.appendChild(open); row.appendChild(unf);
      list.appendChild(row);
    });
  }

  async function startScan() {
    document.getElementById("tu-scan").disabled = true;
    const dialog = findDialog();
    if (!dialog) { log("✗ Liste penceresi bulunamadı! Önce 'Following/Followers' listesini aç."); document.getElementById("tu-scan").disabled = false; return; }

    const followingTab = findTabIn(dialog, /following|takip ediliyor/i);
    if (followingTab) followingTab.click();
    await delay(2000);
    log("Following sekmesi taranıyor...");
    const following = await scrapeCurrentTab("Following");
    log("✓ Following: " + following.size + " kişi.");

    const followersTab = findTabIn(dialog, /followers|takipçi/i);
    if (!followersTab) { log("✗ Followers sekmesi bulunamadı."); document.getElementById("tu-scan").disabled = false; return; }
    followersTab.click();
    await delay(2500);
    log("Followers sekmesi taranıyor...");
    const followers = await scrapeCurrentTab("Followers");
    log("✓ Followers: " + followers.size + " kişi.");

    const diff = [...following].filter((u) => !followers.has(u));
    targets = diff.map((u) => ({ user: u }));
    renderList();
    document.getElementById("tu-count").textContent =
      targets.length + " kişi seni takip etmiyor (F:" + following.size + "/T:" + followers.size + ")";
    document.getElementById("tu-goall").disabled = targets.length === 0;
    document.getElementById("tu-scan").disabled = false;
    log("✓ Bitti. " + targets.length + " kişi listede.");
  }

  async function startUnfollowAll() {
    if (!targets.length) return;
    if (!window.confirm(targets.length + " kişiyi 3 sn arayla takipten çıkarayım mı?")) return;
    running = true; stopFlag = false; doneCount = 0;
    document.getElementById("tu-stop").disabled = false;
    document.getElementById("tu-goall").disabled = true;
    for (const t of targets) {
      if (stopFlag) break;
      log("Takipten çıkarılıyor: @" + t.user);
      let ok = false;
      try { ok = await unfollowUser(t.user); } catch (e) { log("✗ Hata @" + t.user + ": " + e.message); }
      if (ok) { doneCount++; document.getElementById("tu-count").textContent =
        doneCount + " / " + targets.length + " çıkarıldı"; }
      if (stopFlag) break;
      log("⏳ 3 saniye bekleniyor...");
      await delay(INTER_WAIT);
    }
    running = false;
    document.getElementById("tu-stop").disabled = true;
    document.getElementById("tu-goall").disabled = false;
    log("✓ İşlem tamam. Toplam çıkarılan: " + doneCount);
  }

  buildPanel();
  log("Panel hazır. Following/Followers listesini aç, sonra TARA'ya bas.");
  window.threadsUnfollower = { scan: startScan, unfollowAll: startUnfollowAll, stop: () => (stopFlag = true) };
})();
