import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "rigpricer:v1";

function uid() {
  return crypto.randomUUID();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  const x = Number.isFinite(n) ? n : 0;
  return `$${x.toFixed(2)}`;
}

function sumParts(parts) {
  return parts.reduce((a, p) => a + safeNum(p.cost), 0);
}

function fees(salePrice, feePct, feeFixed) {
  const pct = safeNum(feePct) / 100;
  return salePrice * pct + safeNum(feeFixed);
}

function buildSpend(partsTotal, extraCosts) {
  return partsTotal + safeNum(extraCosts);
}

function netProfit(salePrice, spend, feeValue) {
  return salePrice - spend - feeValue;
}

function roiPct(profit, spend) {
  if (spend <= 0) return 0;
  return (profit / spend) * 100;
}

function pickPart(parts, category) {
  return parts.find(
    (p) => p.category === category && String(p.model || "").trim().length > 0
  );
}

function partsSummary(parts) {
  const cpu = pickPart(parts, "CPU")?.model?.trim() || "";
  const gpu = pickPart(parts, "GPU")?.model?.trim() || "";
  const ram = pickPart(parts, "RAM")?.model?.trim() || "";
  const storage = pickPart(parts, "Storage")?.model?.trim() || "";
  return { cpu, gpu, ram, storage };
}

function generateListing(parts, notes = "") {
  const { cpu, gpu, ram, storage } = partsSummary(parts);

  const titleParts = [
    gpu || "GPU",
    cpu || "CPU",
    ram ? `| ${ram}` : "",
    storage ? `| ${storage}` : "",
  ].filter(Boolean);

  const title = titleParts.join(" ").replace(/\s+/g, " ").trim();

  const specLines = [];
  if (cpu) specLines.push(`- CPU: ${cpu}`);
  if (gpu) specLines.push(`- GPU: ${gpu}`);
  if (ram) specLines.push(`- RAM: ${ram}`);
  if (storage) specLines.push(`- Storage: ${storage}`);

  const allParts = parts
    .filter((p) => String(p.model || "").trim().length > 0)
    .map((p) => `- ${p.category}: ${p.model}${p.condition ? ` (${p.condition})` : ""}`);

  const desc = [
    "Specs:",
    ...(specLines.length ? specLines : ["- Add your CPU/GPU/RAM/Storage for auto specs"]),
    "",
    "Full parts list:",
    ...(allParts.length ? allParts : ["- Add parts in the table"]),
    "",
    "Testing:",
    "- Clean install / basic stability checks",
    "- Temps verified during gaming/benchmark",
    "",
    "Pickup:",
    "- You can test on pickup",
    "- No trades",
    "",
    notes ? `Notes:\n${notes.trim()}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n");

  return { title, desc };
}

async function copyText(text) {
  const t = String(text ?? "");
  if (!t) return false;

  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function defaultState() {
  return {
    parts: [
      { id: uid(), category: "GPU", model: "MSI RTX 3080 Ti Gaming X Trio", condition: "used", cost: 440 },
      { id: uid(), category: "CPU", model: "Ryzen 9 5900X", condition: "used", cost: 0 },
      { id: uid(), category: "RAM", model: "32GB DDR4", condition: "used", cost: 0 },
      { id: uid(), category: "Storage", model: "2TB NVMe SSD", condition: "used", cost: 0 },
    ],
    salePrice: 1200,
    feePct: 0,
    listingNotes: "Includes power cable. Cash only.",
  };
}

export default function App() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultState();
    } catch {
      return defaultState();
    }
  });

  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const partsTotal = useMemo(() => sumParts(state.parts), [state.parts]);

  const salePrice = safeNum(state.salePrice);
  const feeValue = useMemo(
    () => fees(salePrice, state.feePct, 0),
    [salePrice, state.feePct]
  );

  const spend = useMemo(
    () => buildSpend(partsTotal, 0),
    [partsTotal]
  );


  const profit = useMemo(
    () => netProfit(salePrice, spend, feeValue),
    [salePrice, spend, feeValue]
  );

  const roi = useMemo(() => roiPct(profit, spend), [profit, spend]);

  const listing = useMemo(
    () => generateListing(state.parts, state.listingNotes),
    [state.parts, state.listingNotes]
  );

  function setField(key, value) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function addPart() {
    setState((s) => ({
      ...s,
      parts: [
        { id: uid(), category: "Other", model: "", condition: "used", cost: 0 },
        ...s.parts,
      ],
    }));
  }

  function updatePart(id, patch) {
    setState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function deletePart(id) {
    setState((s) => ({
      ...s,
      parts: s.parts.filter((p) => p.id !== id),
    }));
  }

  function resetAll() {
    setState(defaultState());
    setToast("Reset");
  }

  async function onCopyTitle() {
    const ok = await copyText(listing.title);
    setToast(ok ? "Copied title" : "Copy failed");
  }

  async function onCopyDesc() {
    const ok = await copyText(listing.desc);
    setToast(ok ? "Copied description" : "Copy failed");
  }

  function onPrint() {
    window.print();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">PC</div>
          <div>
            <div className="h1">PcPricer</div>
            <div className="sub">Build cost • profit • listing</div>
          </div>
        </div>

        <div className="actions noPrint">
          <button onClick={addPart}>Add Part</button>
          <button className="primary" onClick={onPrint}>Print / Save PDF</button>
          <button className="danger" onClick={resetAll}>Reset</button>
        </div>
      </header>

      {toast ? <div className="toast noPrint">{toast}</div> : null}

      <div className="grid">
        <section className="card printArea">
          <div className="cardTitle">Parts</div>

          <div className="tableHead">
            <div>Category</div>
            <div>Model</div>
            <div>Cond</div>
            <div>Cost</div>
            <div className="noPrint"> </div>
          </div>

          <div className="table">
            {state.parts.map((p) => (
              <div key={p.id} className="row">
                <select
                  value={p.category}
                  onChange={(e) => updatePart(p.id, { category: e.target.value })}
                >
                  <option>CPU</option>
                  <option>GPU</option>
                  <option>Motherboard</option>
                  <option>RAM</option>
                  <option>Storage</option>
                  <option>PSU</option>
                  <option>Case</option>
                  <option>Cooler</option>
                  <option>Other</option>
                </select>

                <input
                  value={p.model}
                  placeholder="e.g. Ryzen 7 7800X3D"
                  onChange={(e) => updatePart(p.id, { model: e.target.value })}
                />

                <select
                  value={p.condition}
                  onChange={(e) => updatePart(p.id, { condition: e.target.value })}
                >
                  <option value="new">new</option>
                  <option value="used">used</option>
                  <option value="refurb">refurb</option>
                </select>

                <input
                  value={p.cost}
                  inputMode="decimal"
                  onChange={(e) => updatePart(p.id, { cost: safeNum(e.target.value) })}
                />

                <button className="danger noPrint" onClick={() => deletePart(p.id)}>
                  Del
                </button>
              </div>
            ))}
          </div>

          <div className="totals">
            <div className="kv">
              <div className="k">Parts total</div>
              <div className="v">{money(partsTotal)}</div>
            </div>
          </div>
        </section>

        <section className="card printArea">
          <div className="cardTitle">Sale & Profit</div>

          <div className="formGrid">
            <label>
              <span>Expected sale price</span>
              <input
                value={state.salePrice}
                inputMode="decimal"
                onChange={(e) => setField("salePrice", safeNum(e.target.value))}
              />
            </label>

            <label>
              <span>Platform fee %</span>
              <input
                value={state.feePct}
                inputMode="decimal"
                onChange={(e) => setField("feePct", safeNum(e.target.value))}
              />
            </label>

          </div>

          <div className="kpis">
            <div className="kpi">
              <div className="k">Total spend</div>
              <div className="v">{money(spend)}</div>
            </div>
            <div className="kpi">
              <div className="k">Fees</div>
              <div className="v">{money(feeValue)}</div>
            </div>
            <div className="kpi">
              <div className="k">Net profit</div>
              <div className={"v " + (profit >= 0 ? "good" : "bad")}>
                {money(profit)}
              </div>
            </div>
            <div className="kpi">
              <div className="k">ROI</div>
              <div className={"v " + (roi >= 0 ? "good" : "bad")}>
                {roi.toFixed(1)}%
              </div>
            </div>
          </div>
        </section>

        <section className="card printArea">
          <div className="cardTitle">Listing Generator</div>

          <label className="notes">
            <span>Notes (optional)</span>
            <textarea
              value={state.listingNotes}
              onChange={(e) => setField("listingNotes", e.target.value)}
              rows={3}
              placeholder="Anything you want appended to the listing..."
            />
          </label>

          <div className="listingBlock">
            <div className="blockHead">
              <div className="blockTitle">Title</div>
              <button className="noPrint" onClick={onCopyTitle}>Copy</button>
            </div>
            <textarea value={listing.title} readOnly rows={2} />
          </div>

          <div className="listingBlock">
            <div className="blockHead">
              <div className="blockTitle">Description</div>
              <button className="noPrint" onClick={onCopyDesc}>Copy</button>
            </div>
            <textarea value={listing.desc} readOnly rows={14} />
          </div>
        </section>
      </div>
    </div>
  );
}
