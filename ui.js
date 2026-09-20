(function(){
  var img=document.querySelector('.banner img');
  if(img){ img.src='IMG_5183.jpeg'; img.alt='35 ElGhaly'; }
  var T = {
    en: {
      kicker:"Closed desk \u00b7 not a public app",
      lede:"35 is a private earned-credit ledger for this desk. There is no public bot to click, no coin to buy, no deposit to send. Follow the record. Mail if you must. Mint stays unpublished until the desk books realized profit.",
      record:"Public record",
      c1t:"Closed", c1p:"The sniper and flash are not a public product.",
      c2t:"Earned only", c2p:"Credit later comes from signed desk-usage memos. Nobody buys 35.",
      c3t:"Not a listing", c3p:"No pool today. Do not look for a contract to ape.",
      doorst:"Doors",
      door1n:"Iris \u00b7 free glass",
      door1p:"A free glass door. Not 35 credits \u2014 just a window into the work.",
      door2n:"Plumb \u00b7 ready desk seats",
      door2p:"Ready desk seats when the desk opens them. No price here \u2014 follow the door.",
      locked:"Locked",
      lockedp:"Path A. Closed desk. No purchase. No redeem. No public app.",
      addr:"Addresses", mode:"Mode", support:"Support", mint:"Mint", pool:"Pool",
      askt:"Ask 35",
      askp:"You get an instant answer here. The same question is also sent to 35@elghaly.dev so the desk can reply.",
      termst:"Terms",
      t1:"Earned only. 35 is never sold. No presale, no public sale, no purchase of any kind.",
      t2:"No deposits. Nobody sends SOL or USDC to a 35 address in exchange for credit.",
      t3:"No redemption. Credit is not redeemable for cash, SOL, or USDC. There is no redemption desk.",
      t4:"Not equity. Not a SAFE, note, or claim on any company. Not a promise of profit or buyback. Not a deposit receipt.",
      t5:"A credit exists only when an allowlisted desk signer lands a signed memo for work published in the earn schedule.",
      t6:"Supply at mint is the credit ledger total. It is derived from signed memos, never an invented number.",
      termsn:"Full rules, kill list, and earn schedule are in the public record at github.com/Alarm2024/35.",
      earnt:"Earn schedule", earnwhat:"What earns a credit", earncredit:"Credit",
      earnp:"A rate that is not on this table cannot be issued \u2014 the issuer refuses it and the mint gate fails the ledger. Rates may change; already-issued credits keep the rate they were issued at.",
      ledt:"Ledger",
      footerDream:"\ud83d\udcad you dream we build \ud83e\udde0\ud83d\udca1",
      footerMade:"made by love \u2764\ufe0f",
      weAre24:"We are 24"
    }
  };
  T.ar = Object.assign({}, T.en, { kicker:"\u0645\u0643\u062a\u0628 \u0645\u063a\u0644\u0642", doorst:"\u0623\u0628\u0648\u0627\u0628", askt:"\u0627\u0633\u0623\u0644 35", support:"\u0627\u0644\u062f\u0639\u0645", record:"\u0627\u0644\u0633\u062c\u0644", weAre24:"\u0646\u062d\u0646 24" });
  T.ru = Object.assign({}, T.en, { kicker:"\u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0439 \u0434\u0435\u0441\u043a", doorst:"\u0414\u0432\u0435\u0440\u0438", askt:"\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u044c 35", weAre24:"\u041c\u044b 24" });
  T.zh = Object.assign({}, T.en, { kicker:"\u95ed\u95e8\u53f0\u5b50", doorst:"\u95e8", askt:"\u95ee 35", weAre24:"\u6211\u4eec\u662f 24" });
  T.de = Object.assign({}, T.en, { kicker:"Geschlossener Desk", doorst:"T\u00fcren", askt:"35 fragen", weAre24:"Wir sind 24" });
  T.es = Object.assign({}, T.en, { kicker:"Mesa cerrada", doorst:"Puertas", askt:"Preguntar a 35", weAre24:"Somos 24" });
  var LANGS = ["en","ar","ru","zh","de","es"];
  var LABELS = { en:"EN", ar:"AR", ru:"RU", zh:"\u4e2d\u6587", de:"DE", es:"ES" };
  function applyLang(lang) {
    if (!T[lang]) lang = "en";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    var pack = T[lang];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n"); if (pack[k]) el.textContent = pack[k];
    });
    document.querySelectorAll("#langbar button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-lang") === lang);
    });
    try { localStorage.setItem("35-lang", lang); } catch (e) {}
  }
  var bar = document.getElementById("langbar");
  if (bar && !bar.children.length) {
    LANGS.forEach(function (code) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("data-lang", code); b.textContent = LABELS[code];
      b.onclick = function () { applyLang(code); }; bar.appendChild(b);
    });
  }
  try { applyLang(localStorage.getItem("35-lang") || "en"); } catch (e) { applyLang("en"); }
  function answer(q) {
    q = (q || "").toLowerCase();
    if (!q.trim()) return "Type a question first.";
    if (/buy|purchase|price|chart|ape|presale|ico/.test(q)) return "You do not buy 35. No presale. No chart. Mint is unpublished.";
    if (/deposit|send (sol|usdc)|invest/.test(q)) return "Do not send SOL or USDC. There is no deposit address for credits.";
    if (/wallet|desksigner|squads/.test(q)) return "Public: deskSigner 3BZGNtr7\u2026npbLo (memo only). Squads GMyuRJ\u2026czcQ (treasury later). Do not send deposits. Mint unpublished.";
    if (/mint|contract|\bca\b|token address/.test(q)) return "Mint is unpublished. There is no contract to ape.";
    if (/pool|jupiter|swap|raydium|meteora/.test(q)) return "No 35/USDC pool yet.";
    if (/airdrop|member|points/.test(q)) return "Visiting this site does not earn 35.";
    if (/iris|plumb|door/.test(q)) return "Doors: Iris (free glass) at iris-35.elghaly.dev. Plumb (ready desk seats) at plumb.elghaly.dev. Neither sells 35 credits.";
    if (/reconcil|ledger|w38|week/.test(q)) return "Ledger 2026-W38: on chain 5, in ledger 5, missing 0, total 5.000000, RECONCILED. Mint unpublished.";
    return "Logged to the desk. A human reads 35@elghaly.dev.";
  }
  function notifyDesk(q) {
    return fetch("https://formsubmit.co/ajax/35@elghaly.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ _subject: "ASK 35 \u2014 35.elghaly.dev", message: q, source: "https://35.elghaly.dev" })
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var askBtn = document.getElementById("askBtn");
  if (askBtn) askBtn.onclick = function () {
    var q = document.getElementById("q").value || "";
    document.getElementById("a").textContent = answer(q);
    document.getElementById("sent").textContent = "Sending a copy to 35@elghaly.dev\u2026";
    notifyDesk(q).then(function () {
      document.getElementById("sent").textContent = "Copy sent toward 35@elghaly.dev.";
    }).catch(function () {
      document.getElementById("sent").textContent = "Instant answer is up. Mail copy failed \u2014 use Mail the desk.";
    });
  };
  var mailBtn = document.getElementById("mailBtn");
  if (mailBtn) mailBtn.onclick = function () {
    location.href = "mailto:35@elghaly.dev?subject=ASK%2035&body=" + encodeURIComponent((document.getElementById("q")||{}).value || "");
  };
  fetch("/protocol.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
    if (!p) return;
    function set(id, v) { var el = document.getElementById(id); if (el && v) el.textContent = v; }
    set("mode", p.issuanceMode);
    if (p.mint) set("mint", p.mint);
    if (p.pool) set("pool", p.pool);
  }).catch(function () {});
})();
