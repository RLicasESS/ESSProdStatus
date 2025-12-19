// ==========================================
// ESS Tags Web App (Operator Version)
// Backend: Google Apps Script Web App
// ==========================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbytwPIElO5czOhnY5wmDUnQMCltrxApfADq_C2131TjY7uo8iFbVUafTAHJAIJTYjEjSw/exec";

const SHARED_SECRET = ""; // optional

function $(id) {
  return document.getElementById(id);
}

function show(el, on = true) {
  el.style.display = on ? "" : "none";
}

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

// ---------------- API helpers ----------------

async function apiGet(action, params = {}) {
  const u = new URL(API_URL);
  u.searchParams.set("action", action);
  if (SHARED_SECRET) u.searchParams.set("secret", SHARED_SECRET);

  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }

  const res = await fetch(u.toString());
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

async function apiPost(payload) {
  const u = new URL(API_URL);
  if (SHARED_SECRET) u.searchParams.set("secret", SHARED_SECRET);

  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // <-- key change
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "API error");
  return json;
}

// ---------------- Mode handling ----------------

let currentMode = "none"; // "register" | "edit" | "none"
let editTagId = "";

function setRegisterBoxTitle(text) {
  // first child div inside registerBox is the title in your HTML
  const titleEl = $("registerBox")?.querySelector("div");
  if (titleEl) titleEl.textContent = text;
}

function openRegisterMode(tagValue) {
  currentMode = "register";
  editTagId = "";

  setRegisterBoxTitle("Registering new lot?");
  $("register").textContent = "Register";
  $("cancelRegister").textContent = "Cancel";

  // Clear fields
  $("lot").value = "";
  $("qty").value = "";
  $("product").value = "";

  // Keep tag as-is
  $("tag").value = tagValue;

  show($("registerBox"), true);
}

function openEditMode(foundData) {
  currentMode = "edit";
  editTagId = foundData.TAG_ID;

  setRegisterBoxTitle("Edit Data");
  $("register").textContent = "Save Changes";
  $("cancelRegister").textContent = "Cancel";

  $("lot").value = foundData.LOT_ID;
  $("qty").value = foundData.LOT_QTY;
  $("product").value = foundData.PRODUCT_NAME;

  // show box
  show($("registerBox"), true);
}

// ---------------- Core logic ----------------

async function lookupTag() {
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
        <button id="editBtn" style="font-weight:700">Edit Data</button>
        <button id="deregBtn" style="color:#b00020;font-weight:700">
          Deregister Tag
        </button>
      </div>
    `);

    $("editBtn").onclick = () => openEditMode(d);

    $("deregBtn").onclick = async () => {
      if (!confirm(`Deregister tag ${d.TAG_ID}?\n\nThis will remove it from the Tags Table.`)) return;

      await apiPost({ action: "deregister", tag: d.TAG_ID });

      clearUI();
      setResult(
        "Tag deregistered successfully.<br><br>" +
          "Please remove the tag from the lot and keep it for future use."
      );
    };

    return;
  }

  // Not found -> registration flow
  setResult(`Tag not found: <b>${tag}</b>`, true);
  openRegisterMode(tag);
}

async function submitRegisterOrEdit() {
  const tag = $("tag").value.trim();
  const lot = $("lot").value.trim();
  const qty = $("qty").value.trim();
  const product = $("product").value.trim();

  if (!tag || !lot || !qty || !product) {
    setResult("All fields are required.", true);
    return;
  }

  if (currentMode === "register") {
    await apiPost({ action: "register", tag, lot, qty, product });
    show($("registerBox"), false);
    setResult("New lot registered successfully.");
    await lookupTag();
    return;
  }

  if (currentMode === "edit") {
    await apiPost({ action: "update", tag: editTagId || tag, lot, qty, product });
    show($("registerBox"), false);
    setResult("Data updated successfully.");
    await lookupTag();
    return;
  }

  setResult("Unexpected state. Please Lookup again.", true);
}

async function viewTable() {
  clearUI();
  show($("tableBox"), true);
  $("tableStatus").textContent = "Loading…";

  const out = await apiGet("all");
  const rows = out.rows || [];

  const tbody = $("table").querySelector("tbody");
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.TAG_ID}</td>
      <td>${r.LOT_ID}</td>
      <td>${r.LOT_QTY}</td>
      <td>${r.PRODUCT_NAME}</td>
    `;
    tbody.appendChild(tr);
  }

  $("tableStatus").textContent = `Rows: ${rows.length}`;
}

// ---------------- Wire UI ----------------

window.addEventListener("DOMContentLoaded", () => {
  $("lookup").onclick = () => lookupTag().catch(e => setResult(e.message, true));
  $("register").onclick = () => submitRegisterOrEdit().catch(e => setResult(e.message, true));

  $("cancelRegister").onclick = () => {
    show($("registerBox"), false);
    currentMode = "none";
    editTagId = "";
  };

  $("viewTable").onclick = () => viewTable().catch(e => setResult(e.message, true));
  $("closeTable").onclick = () => show($("tableBox"), false);

  $("tag").addEventListener("keydown", ev => {
    if (ev.key === "Enter") lookupTag().catch(e => setResult(e.message, true));
  });
});
