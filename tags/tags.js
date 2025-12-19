// ==========================================
// ESS Tags Web App (Operator Version)
// Backend: Google Apps Script Web App
// ==========================================

// 🔒 HARD-CODED BACKEND (operator never sees this)
const API_URL =
  "https://script.google.com/macros/s/AKfycbxIfQ2nvY-itZS2rPdYxoRF1yE6nzn4r2ZhcTI3gkLZhKSJ2RE6f9DXQemfO2s3canHWA/exec";

// Optional shared secret (leave "" if not used)
const SHARED_SECRET = ""; // e.g. "ess-tags-2025"

// ------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function show(el, on = true) {
  el.style.display = on ? "" : "none";
}

function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^0+/, "");
}

// ------------------------------------------
// API helpers
// ------------------------------------------
async function apiGet(action, params = {}) {
  const u = new URL(API_URL);
  u.searchParams.set("action", action);
  if (SHARED_SECRET) u.searchParams.set("secret", SHARED_SECRET);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }

  const res = await fetch(u.toString(), { method: "GET" });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

async function apiPost(payload) {
  const u = new URL(API_URL);
  if (SHARED_SECRET) u.searchParams.set("secret", SHARED_SECRET);

  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

// ------------------------------------------
// UI helpers
// ------------------------------------------
function clearUI() {
  show($("result"), false);
  show($("registerBox"), false);
  show($("tableBox"), false);
}

function setResult(html, danger = false) {
  const box = $("result");
  box.innerHTML = html;
  box.className = danger ? "card danger" : "card";
  show(box, true);
}

// ------------------------------------------
// Core actions
// ------------------------------------------
async function lookup() {
  clearUI();

  const tag = $("tag").value.trim();
  if (!tag) {
    setResult("Please enter a Tag ID.", true);
    return;
  }

  const out = await apiGet("lookup", { tag });

  if (out.found) {
    const d = out.data;

    // show full tag (with leading zeros)
    $("tag").value = d.TAG_ID;

    setResult(`
      <div><span class="k">TAG ID</span>${d.TAG_ID}</div>
      <div><span class="k">LOT ID</span>${d.LOT_ID}</div>
      <div><span class="k">LOT QTY</span>${d.LOT_QTY}</div>
      <div><span class="k">PRODUCT</span>${d.PRODUCT_NAME}</div>

      <div style="margin-top:12px">
        <button id="deregBtn" style="color:#b00020;font-weight:700">
          Deregister Tag
        </button>
      </div>
    `);

    $("deregBtn").onclick = async () => {
      if (
        !confirm(
          `Deregister tag ${d.TAG_ID}?\n\nThis will remove it from the Tags Table.`
        )
      )
        return;

      await apiPost({ action: "deregister", tag: d.TAG_ID });

      clearUI();
      setResult(
        "Tag deregistered successfully.<br><br>" +
          "Please remove the tag from the lot and keep it for future use."
      );
    };

    return;
  }

  // Not found → registration flow
  setResult(`Tag not found: <b>${tag}</b>`, true);
  show($("registerBox"), true);

  $("lot").value = "";
  $("qty").value = "";
  $("product").value = "";
}

async function registerTag() {
  const tag = $("tag").value.trim();
  const lot = $("lot").value.trim();
  const qty = $("qty").value.trim();
  const product = $("product").value.trim();

  if (!tag || !lot || !qty || !product) {
    setResult("All fields are required to register a new lot.", true);
    return;
  }

  await apiPost({
    action: "register",
    tag,
    lot,
    qty,
    product,
  });

  show($("registerBox"), false);
  setResult("New lot registered successfully.");

  // Immediately re-lookup to show saved data
  await lookup();
}

async function viewTable() {
  clearUI();
  show($("tableBox"), true);
  $("tableStatus").textContent = "Loading…";

  const out = await ap
