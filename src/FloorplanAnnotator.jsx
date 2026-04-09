import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const ICON_TYPES = {
  extinguisher: { symbol: "🧯", label: "Fire Extinguisher" },
  firstaid:     { symbol: "✚", label: "First Aid Kit" },
  smokeAlarm:   { symbol: "⌾", label: "Smoke Alarm" },
};

const ROUTE_COLORS = { primary: "#e53e3e", secondary: "#ecc94b" };
const ARROW_SIZE = 10;
const DEFAULT_LEGEND = {
  sqft: "",
  showRoute: true,
  showExtinguisher: true,
  showFirstAid: true,
  showSmoke: true,
  showOccupancy: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function routeMidpoint(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  return points[Math.floor(points.length / 2)];
}

function buildPdfFilename(unit, name) {
  const u = unit.trim();
  const n = name.trim();
  if (!u && !n) return "[unit number] - [Floorplan name]";
  return `${u || "[unit number]"} - ${n || "[Floorplan name]"}`;
}

// ─── Arrow drawing helper ─────────────────────────────────────────────────────
function drawArrow(ctx, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(mx - Math.cos(angle) * ARROW_SIZE, my - Math.sin(angle) * ARROW_SIZE);
  ctx.lineTo(mx + Math.cos(angle) * ARROW_SIZE, my + Math.sin(angle) * ARROW_SIZE);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx + Math.cos(angle) * ARROW_SIZE, my + Math.sin(angle) * ARROW_SIZE);
  ctx.lineTo(
    mx + Math.cos(angle + 2.5) * ARROW_SIZE * 0.8,
    my + Math.sin(angle + 2.5) * ARROW_SIZE * 0.8
  );
  ctx.lineTo(
    mx + Math.cos(angle - 2.5) * ARROW_SIZE * 0.8,
    my + Math.sin(angle - 2.5) * ARROW_SIZE * 0.8
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Draw route polyline with arrows on every segment ────────────────────────
function drawRoute(ctx, points, color) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 1; i < points.length; i++) {
    drawArrow(ctx, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color);
  }
  ctx.restore();
}

// ─── Draw icon ────────────────────────────────────────────────────────────────
function drawIcon(ctx, item) {
  ctx.save();
  ctx.font = "22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.symbol, item.x, item.y);
  ctx.restore();
}

// ─── Draw occupancy label ─────────────────────────────────────────────────────
function drawOccupancy(ctx, item) {
  const txt = item.label || `Max: ${item.count}`;
  ctx.save();
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "#1a202c";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(txt, item.x, item.y);
  ctx.fillText(txt, item.x, item.y);
  ctx.restore();
}

// ─── Draw exit label ─────────────────────────────────────────────────────────
function drawExit(ctx, item) {
  ctx.save();
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#276749";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText("EXIT", item.x, item.y);
  ctx.fillText("EXIT", item.x, item.y);
  ctx.restore();
}

// ─── Draw legend ─────────────────────────────────────────────────────────────
function drawLegend(ctx, legend, canvasW, canvasH) {
  const PAD = 10;
  const lineH = 20;
  const lines = [];
  if (legend.sqft) lines.push({ text: `📐 ${legend.sqft} sq ft`, icon: null });
  if (legend.showRoute) {
    lines.push({ text: " Primary Route", color: ROUTE_COLORS.primary });
    lines.push({ text: " Secondary Route", color: ROUTE_COLORS.secondary });
  }
  if (legend.showExtinguisher) lines.push({ text: "🧯 Fire Extinguisher" });
  if (legend.showFirstAid)     lines.push({ text: "✚ First Aid Kit" });
  if (legend.showSmoke)        lines.push({ text: "⌾ Smoke Alarm" });
  if (legend.showOccupancy)    lines.push({ text: "👥 Max Occupancy" });

  if (lines.length === 0) return;

  const boxW = 180;
  const boxH = lines.length * lineH + PAD * 2;
  const bx = canvasW - boxW - PAD;
  const by = canvasH - boxH - PAD;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "#cbd5e0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  lines.forEach((line, i) => {
    const tx = bx + PAD;
    const ty = by + PAD + i * lineH + lineH / 2;
    if (line.color) {
      ctx.fillStyle = line.color;
      ctx.fillRect(tx, ty - 5, 18, 3);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#1a202c";
      ctx.textBaseline = "middle";
      ctx.fillText(line.text, tx + 22, ty);
    } else {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#1a202c";
      ctx.textBaseline = "middle";
      ctx.fillText(line.text, tx, ty);
    }
  });
  ctx.restore();
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function FloorplanAnnotator() {
  const canvasRef    = useRef(null);
  const imageRef     = useRef(null);
  const fileRef      = useRef(null);
  const idCounter    = useRef(0);
  const newId        = () => `ann-${idCounter.current++}`;

  const [imageSrc, setImageSrc]         = useState(null);
  const [originalFileName, setOriginalFileName] = useState("");
  const [canvasSize, setCanvasSize]     = useState({ w: 800, h: 600 });
  const [jsonText, setJsonText]         = useState("");
  const [jsonError, setJsonError]       = useState("");
  const [annotations, setAnnotations]   = useState({
    primaryRoutes: [],   // [{id, points: [{x,y},...]}]
    secondaryRoutes: [], // [{id, points: [{x,y},...]}]
    icons: [],           // [{id, symbol, x, y}]
    occupancy: [],       // [{id, label, x, y}]
    exits: [],           // [{id, x, y}]
  });
  const [legend, setLegend]             = useState(DEFAULT_LEGEND);
  const [placingMode, setPlacingMode]   = useState(null);
  const [occupancyInput, setOccupancyInput] = useState("");
  const [showLegendEditor, setShowLegendEditor] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  // PDF dialog state
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfUnit, setPdfUnit]             = useState("");
  const [pdfFloorName, setPdfFloorName]   = useState("");

  // ── Redraw canvas ──────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img && imageSrc) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    annotations.primaryRoutes.forEach(route =>
      drawRoute(ctx, route.points, ROUTE_COLORS.primary));
    annotations.secondaryRoutes.forEach(route =>
      drawRoute(ctx, route.points, ROUTE_COLORS.secondary));
    annotations.icons.forEach(item => drawIcon(ctx, item));
    annotations.occupancy.forEach(item => drawOccupancy(ctx, item));
    annotations.exits.forEach(item => drawExit(ctx, item));
    drawLegend(ctx, legend, canvas.width, canvas.height);
  }, [imageSrc, annotations, legend]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── Load image ─────────────────────────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOriginalFileName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const maxW = Math.min(img.naturalWidth, 1200);
      const scale = maxW / img.naturalWidth;
      setCanvasSize({ w: maxW, h: Math.round(img.naturalHeight * scale) });
      setImageSrc(url);
    };
    img.src = url;
  };

  const scaleCoord = useCallback((val, dim) => {
    return val <= 1 ? val * dim : val;
  }, []);

  // ── Parse + apply JSON ─────────────────────────────────────────────────────
  const applyJson = () => {
    setJsonError("");
    let data;
    try { data = JSON.parse(jsonText); }
    catch { setJsonError("Invalid JSON — check syntax and try again."); return; }

    const cw = canvasSize.w;
    const ch = canvasSize.h;

    const normalise = (pts) =>
      pts.map(p => ({ x: scaleCoord(p.x, cw), y: scaleCoord(p.y, ch) }));

    const primaryRoutes = (data.primaryRoutes || []).map(r => ({
      id: newId(),
      points: normalise(r.points || r),
    }));
    const secondaryRoutes = (data.secondaryRoutes || []).map(r => ({
      id: newId(),
      points: normalise(r.points || r),
    }));

    const icons = (data.icons || []).map(ic => ({
      id: newId(),
      symbol: ICON_TYPES[ic.type]?.symbol || "?",
      x: scaleCoord(ic.x, cw),
      y: scaleCoord(ic.y, ch),
    }));

    const occupancy = (data.occupancy || []).map(o => ({
      id: newId(),
      label: o.label || `Max: ${o.count || "?"}`,
      x: scaleCoord(o.x, cw),
      y: scaleCoord(o.y, ch),
    }));

    const exits = (data.exits || []).map(ex => ({
      id: newId(),
      x: scaleCoord(ex.x, cw),
      y: scaleCoord(ex.y, ch),
    }));

    setAnnotations(prev => ({
      primaryRoutes:   [...prev.primaryRoutes,   ...primaryRoutes],
      secondaryRoutes: [...prev.secondaryRoutes, ...secondaryRoutes],
      icons:           [...prev.icons,           ...icons],
      occupancy:       [...prev.occupancy,        ...occupancy],
      exits:           [...prev.exits,            ...exits],
    }));

    if (data.sqft) setLegend(l => ({ ...l, sqft: String(data.sqft) }));
    setJsonText("");
  };

  // ── Canvas click → place annotation ───────────────────────────────────────
  const handleCanvasClick = (e) => {
    if (!placingMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize.w / rect.width;
    const scaleY = canvasSize.h / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top)  * scaleY;

    if (ICON_TYPES[placingMode]) {
      setAnnotations(prev => ({
        ...prev,
        icons: [...prev.icons, { id: newId(), symbol: ICON_TYPES[placingMode].symbol, x, y }],
      }));
    } else if (placingMode === "occupancy") {
      const label = occupancyInput.trim() || "Max: ?";
      setAnnotations(prev => ({
        ...prev,
        occupancy: [...prev.occupancy, { id: newId(), label, x, y }],
      }));
    } else if (placingMode === "exit") {
      setAnnotations(prev => ({
        ...prev,
        exits: [...prev.exits, { id: newId(), x, y }],
      }));
    }
  };

  // ── Delete single annotation ───────────────────────────────────────────────
  const deleteAnnotation = (type, id) => {
    setAnnotations(prev => ({
      ...prev,
      [type]: prev[type].filter(item => item.id !== id),
    }));
  };

  // ── Clear all ──────────────────────────────────────────────────────────────
  const clearAll = () => {
    setAnnotations({ primaryRoutes: [], secondaryRoutes: [], icons: [], occupancy: [], exits: [] });
    setLegend(DEFAULT_LEGEND);
    setJsonText("");
    setJsonError("");
  };

  // ── Export to PDF ──────────────────────────────────────────────────────────
  const exportPdf = () => {
    setShowPdfDialog(true);
  };

  const doExportPdf = async () => {
    setShowPdfDialog(false);
    setExportStatus("Generating PDF…");
    try {
      const { jsPDF } = window.jspdf;
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pxW = canvas.width;
      const pxH = canvas.height;
      const ptW = pxW * (72 / 96);
      const ptH = pxH * (72 / 96);
      const pdf = new jsPDF({ orientation: ptW > ptH ? "landscape" : "portrait", unit: "pt", format: [ptW, ptH] });
      pdf.addImage(imgData, "JPEG", 0, 0, ptW, ptH);
      pdf.save(`${buildPdfFilename(pdfUnit, pdfFloorName)}.pdf`);
      setExportStatus("PDF saved!");
      setTimeout(() => setExportStatus(""), 3000);
    } catch (err) {
      setExportStatus("Error: " + err.message);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f7fafc", padding: "1rem" }}>

      {/* ── PDF Naming Dialog ── */}
      {showPdfDialog && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: "24px 28px",
            width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ margin: "0 0 18px", fontSize: "1.1rem", fontWeight: 700, color: "#1a202c" }}>
              Export PDF
            </h2>

            {originalFileName && (
              <div style={{ marginBottom: 14 }}>
                <div style={labelStyle}>Original file</div>
                <div style={{ fontSize: "0.85rem", color: "#4a5568", background: "#f7fafc", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  {originalFileName}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Unit number (optional)</div>
              <input
                value={pdfUnit}
                onChange={e => setPdfUnit(e.target.value)}
                placeholder="e.g. 101"
                style={inputStyle}
                autoFocus
                onKeyDown={e => e.key === "Enter" && doExportPdf()}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Floorplan name (optional)</div>
              <input
                value={pdfFloorName}
                onChange={e => setPdfFloorName(e.target.value)}
                placeholder="e.g. 2BR Master Suite"
                style={inputStyle}
                onKeyDown={e => e.key === "Enter" && doExportPdf()}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Export filename</div>
              <div style={{
                fontSize: "0.85rem", color: "#2b6cb0", fontWeight: 600,
                background: "#ebf8ff", padding: "7px 10px", borderRadius: 6,
                border: "1px solid #bee3f8",
              }}>
                {buildPdfFilename(pdfUnit, pdfFloorName)}.pdf
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowPdfDialog(false)}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #cbd5e0", background: "#fff", cursor: "pointer", fontSize: "0.9rem" }}
              >
                Cancel
              </button>
              <button
                onClick={doExportPdf}
                style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#2b6cb0", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#1a202c" }}>
              🏠 Floorplan Emergency Route Annotator
            </h1>
            <p style={{ margin: "2px 0 0", color: "#718096", fontSize: "0.85rem" }}>
              Upload a floorplan, paste LLM-generated JSON, or click to place annotations manually.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={clearAll} style={{ background: "#fff3f3", color: "#c53030", border: "1px solid #feb2b2", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
              🗑 Clear All
            </button>
            <button onClick={exportPdf} style={{ background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
              📄 Export PDF
            </button>
            {exportStatus && <span style={{ color: "#2b6cb0", fontSize: "0.85rem" }}>{exportStatus}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", alignItems: "start" }}>
          {/* ── Left Panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

            {/* Upload */}
            <Panel title="1. Upload Floorplan">
              <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleImageUpload} />
              <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "10px", background: "#ebf8ff", border: "2px dashed #63b3ed", borderRadius: 8, cursor: "pointer", color: "#2b6cb0", fontWeight: 600 }}>
                {imageSrc ? "✓ Image loaded — click to replace" : "Click to upload JPEG / PNG"}
              </button>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#718096" }}>
                For PDF floorplans, take a screenshot first, then upload the image.
              </p>
            </Panel>

            {/* JSON Input */}
            <Panel title="2. Paste LLM JSON">
              <textarea
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
                placeholder={'{\n  "primaryRoutes": [...],\n  "secondaryRoutes": [...],\n  "icons": [...],\n  "occupancy": [...],\n  "exits": [...]\n}'}
                style={{ width: "100%", height: 140, fontFamily: "monospace", fontSize: "0.75rem", borderRadius: 6, border: "1px solid #cbd5e0", padding: 8, resize: "vertical", boxSizing: "border-box" }}
              />
              {jsonError && <p style={{ color: "#c53030", fontSize: "0.78rem", margin: "2px 0" }}>{jsonError}</p>}
              <button onClick={applyJson} style={{ width: "100%", padding: "8px", background: "#276749", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, marginTop: 4 }}>
                Apply JSON →
              </button>
            </Panel>

            {/* Manual placement */}
            <Panel title="3. Place Manually (click canvas)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(ICON_TYPES).map(([key, { symbol, label }]) => (
                  <button key={key} onClick={() => setPlacingMode(placingMode === key ? null : key)}
                    style={activeModeStyle(placingMode === key)}>
                    {symbol} {label.split(" ")[0]}
                  </button>
                ))}
                <button onClick={() => setPlacingMode(placingMode === "exit" ? null : "exit")}
                  style={activeModeStyle(placingMode === "exit")}>
                  🚪 Exit
                </button>
                <button onClick={() => setPlacingMode(placingMode === "occupancy" ? null : "occupancy")}
                  style={activeModeStyle(placingMode === "occupancy")}>
                  👥 Occupancy
                </button>
              </div>
              {placingMode === "occupancy" && (
                <input
                  value={occupancyInput}
                  onChange={e => setOccupancyInput(e.target.value)}
                  placeholder="Label e.g. Max 2"
                  style={{ width: "100%", marginTop: 6, padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e0", fontSize: "0.85rem", boxSizing: "border-box" }}
                />
              )}
              {placingMode && (
                <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#2b6cb0" }}>
                  Click on the canvas to place. Click button again to stop.
                </p>
              )}
            </Panel>

            {/* Legend editor */}
            <Panel title="4. Legend">
              <button onClick={() => setShowLegendEditor(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#2b6cb0", fontSize: "0.85rem", padding: 0, marginBottom: 4 }}>
                {showLegendEditor ? "▾ Hide editor" : "▸ Edit legend"}
              </button>
              {showLegendEditor && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={labelStyle}>Square footage label</label>
                  <input value={legend.sqft} onChange={e => setLegend(l => ({ ...l, sqft: e.target.value }))}
                    placeholder="e.g. 950" style={inputStyle} />
                  {[
                    ["showRoute",       "Evacuation Routes"],
                    ["showExtinguisher","Fire Extinguisher"],
                    ["showFirstAid",    "First Aid Kit"],
                    ["showSmoke",       "Smoke Alarm"],
                    ["showOccupancy",   "Max Occupancy"],
                  ].map(([key, txt]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                      <input type="checkbox" checked={legend[key]} onChange={e => setLegend(l => ({ ...l, [key]: e.target.checked }))} />
                      {txt}
                    </label>
                  ))}
                </div>
              )}
            </Panel>

            {/* Annotation counts */}
            <Panel title="Annotations">
              <div style={{ fontSize: "0.82rem", color: "#4a5568", lineHeight: 1.8 }}>
                <div>🔴 Primary routes: {annotations.primaryRoutes.length}</div>
                <div>🟡 Secondary routes: {annotations.secondaryRoutes.length}</div>
                <div>🧯 Fire extinguishers: {annotations.icons.filter(i => i.symbol === "🧯").length}</div>
                <div>✚ First aid kits: {annotations.icons.filter(i => i.symbol === "✚").length}</div>
                <div>⌾ Smoke alarms: {annotations.icons.filter(i => i.symbol === "⌾").length}</div>
                <div>🚪 Exits: {annotations.exits.length}</div>
                <div>👥 Occupancy labels: {annotations.occupancy.length}</div>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#a0aec0" }}>
                Hover over any annotation on the canvas to delete it.
              </p>
            </Panel>
          </div>

          {/* ── Canvas area ── */}
          <div style={{ position: "relative" }}>
            <div style={{
              border: "2px solid #cbd5e0",
              borderRadius: 8,
              overflow: "hidden",
              background: "#fff",
              cursor: placingMode ? "crosshair" : "default",
              display: "inline-block",
              maxWidth: "100%",
              position: "relative",
            }}>
              <canvas
                ref={canvasRef}
                width={canvasSize.w}
                height={canvasSize.h}
                style={{ display: "block", maxWidth: "100%", height: "auto" }}
                onClick={handleCanvasClick}
              />

              {/* ── Annotation delete overlay ── */}
              {!placingMode && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>

                  {/* Icons */}
                  {annotations.icons.map(item => (
                    <AnnotationMarker
                      key={item.id}
                      x={item.x} y={item.y}
                      cw={canvasSize.w} ch={canvasSize.h}
                      onDelete={() => deleteAnnotation("icons", item.id)}
                    />
                  ))}

                  {/* Exits */}
                  {annotations.exits.map(item => (
                    <AnnotationMarker
                      key={item.id}
                      x={item.x} y={item.y}
                      cw={canvasSize.w} ch={canvasSize.h}
                      onDelete={() => deleteAnnotation("exits", item.id)}
                    />
                  ))}

                  {/* Occupancy */}
                  {annotations.occupancy.map(item => (
                    <AnnotationMarker
                      key={item.id}
                      x={item.x} y={item.y}
                      cw={canvasSize.w} ch={canvasSize.h}
                      onDelete={() => deleteAnnotation("occupancy", item.id)}
                    />
                  ))}

                  {/* Primary routes — X at midpoint */}
                  {annotations.primaryRoutes.map(route => {
                    const mid = routeMidpoint(route.points);
                    return (
                      <AnnotationMarker
                        key={route.id}
                        x={mid.x} y={mid.y}
                        cw={canvasSize.w} ch={canvasSize.h}
                        onDelete={() => deleteAnnotation("primaryRoutes", route.id)}
                        accentColor={ROUTE_COLORS.primary}
                      />
                    );
                  })}

                  {/* Secondary routes — X at midpoint */}
                  {annotations.secondaryRoutes.map(route => {
                    const mid = routeMidpoint(route.points);
                    return (
                      <AnnotationMarker
                        key={route.id}
                        x={mid.x} y={mid.y}
                        cw={canvasSize.w} ch={canvasSize.h}
                        onDelete={() => deleteAnnotation("secondaryRoutes", route.id)}
                        accentColor={ROUTE_COLORS.secondary}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {!imageSrc && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#a0aec0", fontSize: "1rem", pointerEvents: "none",
              }}>
                Upload a floorplan image to begin →
              </div>
            )}
          </div>
        </div>

        {/* ── Instructions footer ── */}
        <details style={{ marginTop: "1.5rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#2d3748" }}>📋 How to use this app</summary>
          <ol style={{ marginTop: 10, paddingLeft: 20, fontSize: "0.88rem", color: "#4a5568", lineHeight: 2 }}>
            <li><strong>Upload</strong> your apartment floorplan (JPEG or PNG screenshot).</li>
            <li><strong>Copy the prompt template</strong> (see file <code>LLM-Prompt-Template.md</code>) and send it along with your floorplan image to any vision LLM (Claude, ChatGPT, Gemini, etc.).</li>
            <li><strong>Copy the JSON</strong> the LLM returns, paste it into the JSON box, and click <em>Apply JSON</em>.</li>
            <li>Use the <strong>manual placement</strong> buttons to add or correct icons by clicking directly on the canvas.</li>
            <li><strong>Hover over any annotation</strong> on the canvas to reveal an × button and delete it individually.</li>
            <li>Edit the <strong>legend</strong> with your square footage and toggle which items appear.</li>
            <li>Click <strong>Export PDF</strong> to name and save the annotated floorplan.</li>
          </ol>
          <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#718096" }}>
            Coordinate tip: the LLM should return values between 0 and 1 (normalised to image width/height). The app also accepts raw pixel coordinates.
          </p>
        </details>
      </div>
    </div>
  );
}

// ─── Annotation delete marker (overlay) ──────────────────────────────────────
function AnnotationMarker({ x, y, cw, ch, onDelete, accentColor }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        position: "absolute",
        left: `${(x / cw) * 100}%`,
        top: `${(y / ch) * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 36,
        height: 36,
        pointerEvents: "all",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete annotation"
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: accentColor || "#e53e3e",
            color: "#fff",
            border: "2px solid #fff",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
            fontWeight: 700,
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────
function Panel({ title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: "0.85rem", fontWeight: 700, color: "#2d3748", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h3>
      {children}
    </div>
  );
}

function activeModeStyle(active) {
  return {
    padding: "7px 6px",
    borderRadius: 6,
    border: active ? "2px solid #3182ce" : "1px solid #cbd5e0",
    background: active ? "#ebf8ff" : "#f7fafc",
    color: active ? "#2b6cb0" : "#4a5568",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: active ? 700 : 400,
    textAlign: "center",
  };
}

const labelStyle = { fontSize: "0.8rem", color: "#718096", marginBottom: 2 };
const inputStyle = {
  width: "100%", padding: "5px 8px", borderRadius: 6,
  border: "1px solid #cbd5e0", fontSize: "0.85rem", boxSizing: "border-box",
};
