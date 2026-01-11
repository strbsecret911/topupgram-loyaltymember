import { db, auth, adminLogin, adminLogout } from "./firebase.js";
import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, query,
  runTransaction, serverTimestamp, setDoc, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/* ========= CONFIG ========= */
const ALLOWED_ADMIN_EMAIL = "dinijanuari23@gmail.com";
const ADMIN_UID = "FfoHhBjcj6Wg7VmM2d9yu3nbKKt1";

/* ========= DOM ========= */
const view = document.getElementById("view");

/* ========= helpers ========= */
function card(html, accent=false){
  view.innerHTML = `<section class="card ${accent ? "accent":""}">${html}</section>`;
}
function go(hash){
  location.hash = hash;
  setTimeout(render, 0);
}
function fmtDate(d){
  try{
    return new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  }catch{ return "-"; }
}
function fmtTS(ts){
  if(!ts) return "-";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return fmtDate(d);
}
function addMonths(d,m){
  const x=new Date(d);
  const day=x.getDate();
  x.setMonth(x.getMonth()+m);
  if(x.getDate()<day) x.setDate(0);
  return x;
}
function isValidUsername(u){
  return /^[a-zA-Z0-9_]{5,32}$/.test(String(u||"").replace(/^@/,""));
}
function isValidTelegramId(tid){
  return /^[0-9]{5,15}$/.test(String(tid||"").trim());
}
function genMemberCode(tid){
  const C="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<6;i++) s+=C[Math.floor(Math.random()*C.length)];
  return `TPG-${s}-${tid}`;
}
function lower(s){ return String(s||"").trim().toLowerCase(); }

/* ========= modal ========= */
function openModal(innerHtml){
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal">${innerHtml}</div>`;
  wrap.addEventListener("click", (e)=>{
    if(e.target === wrap) wrap.remove();
  });
  document.body.appendChild(wrap);
  return wrap;
}

/* =========================
   PUBLIC HOME
========================= */
function pageHome(){
  card(`
    <div class="row">
      <button class="btn" data-action="open_register">Daftar Membership</button>
      <button class="btn secondary" data-action="goto_search">Cari Membership</button>
    </div>

    <hr/>

    <h3 style="margin:0 0 8px;">Cari Membership</h3>
    <div class="small">Cari dengan Telegram ID (disarankan), Nama (exact), atau Kode Member (exact).</div>

    <label>Tipe Pencarian</label>
    <select id="stype">
      <option value="telegram_id">Telegram ID</option>
      <option value="name">Nama</option>
      <option value="member_code">Kode Member</option>
    </select>

    <label>Kata Kunci</label>
    <input id="q" placeholder="contoh: 123456789" />

    <div id="msg"></div>
    <button class="btn" data-action="do_search">Cari</button>

    <div id="result" style="margin-top:12px;"></div>

    <div class="small" style="margin-top:12px;">
      Admin panel: buka URL ini dengan <b>#/admin</b>
    </div>
  `, true);
}

function renderMemberPublic(m){
  const points = Number(m.points_balance || 0);
  const pot = Math.floor(points/100)*1000;

  const exp = m.expires_at?.toDate ? m.expires_at.toDate() : (m.expires_at ? new Date(m.expires_at) : null);
  const expired = exp ? (new Date() > exp) : false;

  const redeemCount = Number(m.redeem_count || 0);
  return `
    <div class="card">
      <div><b>Nama:</b> ${m.name || "-"}</div>
      <div><b>Telegram ID:</b> ${m.telegram_id || "-"}</div>
      <div><b>Kode Member:</b> ${m.member_code || "-"}</div>
      <div><b>Poin:</b> ${points}</div>
      <div class="mini">100 poin = Rp1000 • Potongan saat ini: Rp${pot.toLocaleString("id-ID")}</div>
      <div><b>Riwayat Redeem:</b> ${redeemCount}x</div>
      <div><b>Expire:</b> ${exp ? fmtDate(exp) : "-"}</div>
      <div class="mini">Status: ${expired ? "KEDALUWARSA" : "AKTIF"}</div>
    </div>
  `;
}

/* =========================
   PUBLIC: register modal
========================= */
function openRegisterModal(){
  const modal = openModal(`
    <h3 style="margin:0 0 6px;">Form Daftar Membership</h3>
    <div class="small">Isi data, lalu pengajuan masuk ke admin untuk diproses.</div>

    <label>Nama</label>
    <input id="r_name" placeholder="contoh: Dini" />

    <label>Username Telegram</label>
    <input id="r_uname" placeholder="contoh: topupgram" />
    <div class="helper">Isi tanpa tanda <b>@</b>.</div>

    <div id="r_msg"></div>

    <button class="btn" id="r_submit">Kirim Pengajuan</button>
    <button class="btn secondary" id="r_close">Tutup</button>
  `);

  modal.querySelector("#r_close").onclick = ()=> modal.remove();

  modal.querySelector("#r_submit").onclick = async ()=>{
    const msg = modal.querySelector("#r_msg");
    msg.innerHTML = "";

    const name = String(modal.querySelector("#r_name").value||"").trim();
    const unameRaw = String(modal.querySelector("#r_uname").value||"").trim();
    const username = unameRaw.replace(/^@/,"");

    if(!name){
      msg.innerHTML = `<div class="error">Nama wajib diisi.</div>`;
      return;
    }
    if(!isValidUsername(username)){
      msg.innerHTML = `<div class="error">Username Telegram tidak valid (5–32, huruf/angka/_).</div>`;
      return;
    }

    try{
      await addDoc(collection(db,"member_requests"), {
        name,
        name_lc: lower(name),
        telegram_username: lower(username),
        status: "PENDING",
        requested_at: serverTimestamp()
      });

      modal.remove();
      openModal(`
        <h3 style="margin:0 0 6px;">Pengajuan Terkirim</h3>
        <div>Pengajuan kamu berstatus <span class="badge">PENDING</span>.</div>
        <div class="small" style="margin-top:8px;">Mohon tunggu verifikasi admin.</div>
        <button class="btn secondary" id="ok">OK</button>
      `).querySelector("#ok").onclick = (e)=> e.target.closest(".modal-backdrop").remove();
    }catch(e){
      msg.innerHTML = `<div class="error">${e?.message || e}</div>`;
    }
  };
}

/* =========================
   PUBLIC: search
========================= */
async function doSearch(){
  const msg = document.getElementById("msg");
  const box = document.getElementById("result");
  msg.innerHTML = "";
  box.innerHTML = "";

  const type = document.getElementById("stype").value;
  const q = String(document.getElementById("q").value||"").trim();

  if(!q){
    msg.innerHTML = `<div class="error">Masukkan kata kunci.</div>`;
    return;
  }

  try{
    if(type === "telegram_id"){
      if(!isValidTelegramId(q)){
        msg.innerHTML = `<div class="error">Telegram ID harus angka.</div>`;
        return;
      }
      const snap = await getDoc(doc(db,"members", q));
      if(!snap.exists()){
        box.innerHTML = `<div class="error">Member tidak ditemukan.</div>`;
        return;
      }
      box.innerHTML = renderMemberPublic(snap.data());
      return;
    }

    if(type === "member_code"){
      const qs = query(collection(db,"members"), where("member_code","==", q), limit(1));
      const snap = await getDocs(qs);
      if(snap.empty){
        box.innerHTML = `<div class="error">Member tidak ditemukan.</div>`;
        return;
      }
      box.innerHTML = renderMemberPublic(snap.docs[0].data());
      return;
    }

    if(type === "name"){
      // exact match untuk menghindari index rumit
      const qs = query(collection(db,"members"), where("name_lc","==", lower(q)), limit(10));
      const snap = await getDocs(qs);
      if(snap.empty){
        box.innerHTML = `<div class="error">Member tidak ditemukan (nama harus sama persis).</div>`;
        return;
      }
      let html = "";
      snap.forEach(d => html += renderMemberPublic(d.data()));
      box.innerHTML = html;
      return;
    }

  }catch(e){
    msg.innerHTML = `<div class="error">${e?.message || e}</div>`;
  }
}

/* =========================
   ADMIN
========================= */
function pageAdminLogin(){
  card(`
    <h3 style="margin:0 0 8px;">Admin Panel</h3>
    <div class="small">Login Google sebagai <b>${ALLOWED_ADMIN_EMAIL}</b>.</div>
    <button class="btn" data-action="admin_login">Login Admin</button>
    <button class="btn secondary" data-action="back_public">Kembali</button>
  `, true);
}

function pageAdminShell(user){
  card(`
    <div><b>Login:</b> ${user.email}</div>
    <button class="btn secondary" data-action="admin_logout">Logout</button>

    <div class="row" style="margin-top:10px;">
      <button class="btn secondary" data-action="admin_tab" data-tab="requests">Pengajuan</button>
      <button class="btn secondary" data-action="admin_tab" data-tab="points">Poin</button>
    </div>

    <div id="tab"></div>
  `, true);

  const tab = window.__tab || "requests";
  if(tab === "requests") renderAdminRequests();
  if(tab === "points") renderAdminPoints();
}

function setTab(html){
  document.getElementById("tab").innerHTML = html;
}

function renderAdminRequests(){
  setTab(`
    <h3 style="margin:12px 0 6px;">Pengajuan PENDING</h3>
    <div class="small">Isi Telegram ID lalu ACC. Kode member auto dibuat permanen.</div>
    <div id="list"></div>
  `);

  const list = document.getElementById("list");
  const qs = query(collection(db,"member_requests"), where("status","==","PENDING"), limit(50));

  onSnapshot(qs, (snap)=>{
    if(snap.empty){
      list.innerHTML = `<div class="small">Tidak ada pengajuan.</div>`;
      return;
    }

    // sort client-side (biar nggak perlu index)
    const sorted = snap.docs
      .map(d => ({ id:d.id, data:d.data() }))
      .sort((a,b)=>{
        const ta = a.data.requested_at?.toMillis ? a.data.requested_at.toMillis() : 0;
        const tb = b.data.requested_at?.toMillis ? b.data.requested_at.toMillis() : 0;
        return tb-ta;
      });

    let html = "";
    for(const it of sorted){
      const r = it.data;
      html += `
        <div class="card">
          <div><b>Nama:</b> ${r.name || "-"}</div>
          <div><b>Username:</b> @${r.telegram_username || "-"}</div>
          <div class="mini">Diajukan: ${fmtTS(r.requested_at)}</div>

          <label>Telegram ID (angka)</label>
          <input id="tid_${it.id}" placeholder="contoh: 123456789" inputmode="numeric" />

          <div class="row">
            <button class="btn" data-action="acc" data-id="${it.id}">ACC</button>
            <button class="btn secondary" data-action="decline" data-id="${it.id}">Decline</button>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
  });
}

async function adminApprove(reqId){
  const tid = String(document.getElementById(`tid_${reqId}`)?.value || "").trim();
  if(!isValidTelegramId(tid)){
    alert("Telegram ID tidak valid (harus angka).");
    return;
  }

  await runTransaction(db, async (tx)=>{
    const reqRef = doc(db,"member_requests", reqId);
    const reqSnap = await tx.get(reqRef);
    if(!reqSnap.exists()) throw new Error("Request tidak ditemukan");
    const r = reqSnap.data();
    if(r.status !== "PENDING") throw new Error("Request bukan PENDING");

    // member code unik + registry
    let code = "";
    for(let i=0;i<10;i++){
      const c = genMemberCode(tid);
      const regRef = doc(db,"member_codes", c);
      const regSnap = await tx.get(regRef);
      if(!regSnap.exists()){
        code = c;
        tx.set(regRef, { created_at: serverTimestamp() });
        break;
      }
    }
    if(!code) throw new Error("Gagal generate kode unik. Coba lagi.");

    const expiresAt = addMonths(new Date(), 5);

    // create member (doc id = telegram id)
    const memRef = doc(db,"members", tid);
    tx.set(memRef, {
      name: r.name || null,
      name_lc: lower(r.name || ""),
      telegram_username: r.telegram_username || null,
      telegram_id: tid,
      member_code: code,
      points_balance: 0,
      redeem_count: 0,
      created_at: serverTimestamp(),
      expires_at: expiresAt
    });

    tx.update(reqRef, {
      status: "APPROVED",
      telegram_id: tid,
      member_id: tid,
      member_code: code,
      approved_at: serverTimestamp()
    });
  });
}

async function adminDecline(reqId){
  await runTransaction(db, async (tx)=>{
    const ref = doc(db,"member_requests", reqId);
    const s = await tx.get(ref);
    if(!s.exists()) throw new Error("Request tidak ditemukan");
    tx.update(ref, { status:"DECLINED", declined_at: serverTimestamp() });
  });
}

function renderAdminPoints(){
  setTab(`
    <h3 style="margin:12px 0 6px;">Kelola Poin</h3>
    <div class="small">Tambah poin kelipatan +5. Redeem 100 poin = Rp1000.</div>

    <label>Telegram ID</label>
    <input id="pid" placeholder="contoh: 123456789" inputmode="numeric" />

    <div class="row">
      <button class="btn secondary" data-action="padd" data-delta="5">+5</button>
      <button class="btn secondary" data-action="padd" data-delta="10">+10</button>
    </div>
    <div class="row">
      <button class="btn secondary" data-action="padd" data-delta="25">+25</button>
      <button class="btn secondary" data-action="redeem100">Redeem -100</button>
    </div>

    <button class="btn" data-action="check_member">Cek Member</button>
    <div id="out" style="margin-top:12px;"></div>
  `);
}

async function adminShowMember(){
  const tid = String(document.getElementById("pid")?.value || "").trim();
  const out = document.getElementById("out");

  if(!isValidTelegramId(tid)){
    out.innerHTML = `<div class="error">Telegram ID tidak valid.</div>`;
    return;
  }

  const snap = await getDoc(doc(db,"members", tid));
  if(!snap.exists()){
    out.innerHTML = `<div class="error">Member tidak ditemukan (pastikan sudah ACC).</div>`;
    return;
  }

  const m = snap.data();
  const points = Number(m.points_balance||0);
  const pot = Math.floor(points/100)*1000;
  const exp = m.expires_at?.toDate ? m.expires_at.toDate() : (m.expires_at ? new Date(m.expires_at) : null);

  out.innerHTML = `
    <div class="card">
      <div><b>Nama:</b> ${m.name || "-"}</div>
      <div><b>Telegram ID:</b> ${m.telegram_id || "-"}</div>
      <div><b>Kode Member:</b> ${m.member_code || "-"}</div>
      <div><b>Poin:</b> ${points}</div>
      <div class="mini">Redeem: 100 poin = Rp1000 • Potongan saat ini: Rp${pot.toLocaleString("id-ID")}</div>
      <div><b>Riwayat Redeem:</b> ${Number(m.redeem_count||0)}x</div>
      <div><b>Expire:</b> ${exp ? fmtDate(exp) : "-"}</div>
    </div>
  `;
}

async function adminAdjustPoints(delta){
  const tid = String(document.getElementById("pid")?.value || "").trim();
  if(!isValidTelegramId(tid)){
    alert("Telegram ID tidak valid.");
    return;
  }

  await runTransaction(db, async (tx)=>{
    const ref = doc(db,"members", tid);
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("Member tidak ditemukan.");

    const cur = Number(snap.data().points_balance || 0);
    const next = Math.max(0, cur + Number(delta));
    tx.update(ref, { points_balance: next });
  });

  await adminShowMember();
}

async function adminRedeem100(){
  const tid = String(document.getElementById("pid")?.value || "").trim();
  if(!isValidTelegramId(tid)){
    alert("Telegram ID tidak valid.");
    return;
  }
  if(!confirm("Redeem 100 poin? (potongan Rp1000)")) return;

  await runTransaction(db, async (tx)=>{
    const ref = doc(db,"members", tid);
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("Member tidak ditemukan.");

    const cur = Number(snap.data().points_balance || 0);
    if(cur < 100) throw new Error("Poin tidak cukup untuk redeem (min 100).");

    const next = cur - 100;
    const redeemCount = Number(snap.data().redeem_count || 0) + 1;

    tx.update(ref, {
      points_balance: next,
      redeem_count: redeemCount,
      last_redeem_at: serverTimestamp()
    });
  });

  await adminShowMember();
}

/* =========================
   ROUTER + EVENTS (delegation)
========================= */
view.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;

  const act = btn.getAttribute("data-action");

  try{
    if(act === "open_register") return openRegisterModal();
    if(act === "goto_search") return document.getElementById("q")?.focus();
    if(act === "do_search") return doSearch();

    if(act === "admin_login") return adminLogin();
    if(act === "admin_logout") return adminLogout();
    if(act === "back_public") return go("#/");

    if(act === "admin_tab"){
      window.__tab = btn.getAttribute("data-tab") || "requests";
      return render();
    }

    if(act === "acc") return adminApprove(btn.getAttribute("data-id"));
    if(act === "decline") return adminDecline(btn.getAttribute("data-id"));

    if(act === "check_member") return adminShowMember();
    if(act === "padd") return adminAdjustPoints(Number(btn.getAttribute("data-delta")));
    if(act === "redeem100") return adminRedeem100();

  }catch(err){
    alert(err?.message || err);
  }
});

function render(){
  const route = location.hash || "#/";
  if(route.startsWith("#/admin")){
    return runAdmin();
  }
  return pageHome();
}

function runAdmin(){
  onAuthStateChanged(auth, async (user)=>{
    if(!user) return pageAdminLogin();

    const emailOk = (user.email||"").toLowerCase() === ALLOWED_ADMIN_EMAIL.toLowerCase();
    const uidOk = user.uid === ADMIN_UID;
    if(!emailOk || !uidOk){
      await adminLogout();
      alert("Akun ini tidak diizinkan.");
      return pageAdminLogin();
    }
    pageAdminShell(user);
  });
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);
render();
