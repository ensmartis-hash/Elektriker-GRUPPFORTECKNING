"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, List, Plus, Save, Printer, Download, Upload, Trash2, Edit2, 
  Copy, ArrowLeft, Zap, User, Building2 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import type { Company, Installation, Group, ServiceEntry } from "./lib/types";

// Default company
const DEFAULT_COMPANY: Company = {
  name: "ElInstall AB",
  address: "Industrivägen 12, 123 45 Stockholm",
  orgNr: "556789-1234",
  phone: "08-123 45 67",
  email: "info@elinstall.se",
  logo: null,
};

const DEFAULT_INSTALLATIONS: Installation[] = [];

const FUSE_OPTIONS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const PHASE_OPTIONS: (1 | 3)[] = [1, 3];

const QUICK_PRESETS = [
  { label: "Belysning 10A", fuse: 10, conductor: "1.5 mm² EKK", phases: 1 as const, loadA: 8 },
  { label: "Uttag 16A", fuse: 16, conductor: "2.5 mm² EKK", phases: 1 as const, loadA: 12 },
  { label: "Spis 25A", fuse: 25, conductor: "4 mm² EKK", phases: 1 as const, loadA: 20 },
  { label: "Spis 3-fas 25A", fuse: 25, conductor: "2.5 mm² EKK", phases: 3 as const, loadA: 20 },
  { label: "Tvätt 16A", fuse: 16, conductor: "2.5 mm² EKK", phases: 1 as const, loadA: 14 },
  { label: "Värme 16A", fuse: 16, conductor: "2.5 mm² FK", phases: 1 as const, loadA: 13 },
  { label: "Värmepump 20A", fuse: 20, conductor: "4 mm² EKK", phases: 1 as const, loadA: 16 },
  { label: "Huvud 3-fas", fuse: 25, conductor: "6 mm² EKK", phases: 3 as const, loadA: 22 },
];

const STORAGE_KEYS = {
  company: "elgrupp_company",
  installations: "elgrupp_installations",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save", e);
  }
}

function newId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "yyyy-MM-dd", { locale: sv });
  } catch {
    return dateStr;
  }
}

export default function ElGruppApp() {
  // State
  const [company, setCompany] = useState<Company>(DEFAULT_COMPANY);
  const [installations, setInstallations] = useState<Installation[]>(DEFAULT_INSTALLATIONS);
  const [activeView, setActiveView] = useState<"installations" | "company">("installations");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const currentInstallation = installations.find(i => i.id === editingId) || null;

  // Load from localStorage on mount
  useEffect(() => {
    const savedCompany = loadFromStorage(STORAGE_KEYS.company, DEFAULT_COMPANY);
    const savedInstalls = loadFromStorage(STORAGE_KEYS.installations, DEFAULT_INSTALLATIONS);
    setCompany(savedCompany);
    setInstallations(savedInstalls);
  }, []);

  // Persist
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.company, company);
  }, [company]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.installations, installations);
  }, [installations]);

  // --- Company handlers ---
  function updateCompany(field: keyof Company, value: string) {
    setCompany(prev => ({ ...prev, [field]: value }));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Välj en bildfil");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompany(prev => ({ ...prev, logo: reader.result as string }));
      toast.success("Logotyp uppladdad");
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setCompany(prev => ({ ...prev, logo: null }));
  }

  // --- Installation CRUD ---
  function createNewInstallation() {
    const now = new Date().toISOString();
    const newInst: Installation = {
      id: newId(),
      updatedAt: now,
      customer: { name: "", address: "", phone: "", email: "" },
      panel: { location: "Huvudcentral", mainFuse: 25, phases: 3, date: now.slice(0, 10), notes: "" },
      groups: [],
      serviceLog: [],
    };
    setInstallations(prev => [newInst, ...prev]);
    setEditingId(newInst.id);
    setActiveView("installations");
    toast.success("Ny gruppförteckning skapad");
  }

  function duplicateInstallation(inst: Installation) {
    const copy: Installation = {
      ...JSON.parse(JSON.stringify(inst)),
      id: newId(),
      updatedAt: new Date().toISOString(),
      customer: { ...inst.customer, name: inst.customer.name + " (kopia)" },
    };
    setInstallations(prev => [copy, ...prev]);
    setEditingId(copy.id);
    toast.success("Duplicerad");
  }

  function deleteInstallation(id: string) {
    if (!confirm("Ta bort denna gruppförteckning?")) return;
    setInstallations(prev => prev.filter(i => i.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    toast.success("Borttagen");
  }

  function updateInstallation(updated: Installation) {
    const withTime = { ...updated, updatedAt: new Date().toISOString() };
    setInstallations(prev => prev.map(i => i.id === updated.id ? withTime : i));
  }

  function saveAndCloseEditor() {
    setEditingId(null);
    toast.success("Sparad");
  }

  // --- Groups management (inside current installation) ---
  function addGroup(preset?: typeof QUICK_PRESETS[0]) {
    if (!currentInstallation) return;

    const nextNr = (currentInstallation.groups.length > 0 
      ? Math.max(...currentInstallation.groups.map(g => g.nr)) + 1 
      : 1);

    const newGroup: Group = {
      id: newId(),
      nr: nextNr,
      description: preset ? preset.label.replace(/\s+\d+A$/, "") : "",
      fuse: preset ? preset.fuse : 16,
      conductor: preset ? preset.conductor : "2.5 mm² EKK",
      phases: preset ? preset.phases : 1,
      loadA: preset ? preset.loadA : undefined,
      comment: "",
    };

    const updated: Installation = {
      ...currentInstallation,
      groups: [...currentInstallation.groups, newGroup],
    };
    updateInstallation(updated);
  }

  function updateGroup(groupId: string, field: keyof Group, value: string | number) {
    if (!currentInstallation) return;

    const updatedGroups = currentInstallation.groups.map(g => {
      if (g.id !== groupId) return g;
      const copy = { ...g } as any;
      if (field === "nr" || field === "fuse" || field === "phases" || field === "lengthM" || field === "loadA") {
        copy[field] = Number(value) || (field === "phases" ? 1 : undefined);
      } else {
        copy[field] = value;
      }
      return copy as Group;
    });

    updateInstallation({ ...currentInstallation, groups: updatedGroups });
  }

  function removeGroup(groupId: string) {
    if (!currentInstallation) return;
    const updated = {
      ...currentInstallation,
      groups: currentInstallation.groups.filter(g => g.id !== groupId),
    };
    updateInstallation(updated);
  }

  function reorderGroups(fromIdx: number, toIdx: number) {
    if (!currentInstallation) return;
    const groups = [...currentInstallation.groups];
    const [moved] = groups.splice(fromIdx, 1);
    groups.splice(toIdx, 0, moved);
    // Renumber
    const renumbered = groups.map((g, idx) => ({ ...g, nr: idx + 1 }));
    updateInstallation({ ...currentInstallation, groups: renumbered });
  }

  // Calculations
  const totalGroups = currentInstallation?.groups.length || 0;
  const totalFuseLoad = currentInstallation?.groups.reduce((sum, g) => sum + (g.loadA || g.fuse || 0), 0) || 0;
  const mainFuse = currentInstallation?.panel.mainFuse || 0;
  const loadPercent = mainFuse > 0 ? Math.round((totalFuseLoad / mainFuse) * 100) : 0;
  const isOverloaded = mainFuse > 0 && totalFuseLoad > mainFuse;

  // --- Service log ---
  function addServiceEntry() {
    if (!currentInstallation) return;
    const entry: ServiceEntry = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      note: "",
      performedBy: company.name,
    };
    const updated = {
      ...currentInstallation,
      serviceLog: [entry, ...currentInstallation.serviceLog],
    };
    updateInstallation(updated);
  }

  function updateServiceEntry(entryId: string, field: keyof ServiceEntry, value: string) {
    if (!currentInstallation) return;
    const updatedLog = currentInstallation.serviceLog.map(e =>
      e.id === entryId ? { ...e, [field]: value } : e
    );
    updateInstallation({ ...currentInstallation, serviceLog: updatedLog });
  }

  function removeServiceEntry(entryId: string) {
    if (!currentInstallation) return;
    const updated = {
      ...currentInstallation,
      serviceLog: currentInstallation.serviceLog.filter(e => e.id !== entryId),
    };
    updateInstallation(updated);
  }

  // --- Search filtered list ---
  const filteredInstallations = installations
    .filter(inst => {
      const q = searchTerm.toLowerCase();
      return (
        inst.customer.name.toLowerCase().includes(q) ||
        inst.panel.location.toLowerCase().includes(q) ||
        inst.customer.address.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // --- PDF Export using jsPDF ---
  function exportToPDF(inst: Installation) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 12;

    // Header with logo if present
    if (company.logo) {
      try {
        doc.addImage(company.logo, "PNG", 12, 8, 28, 18);
      } catch {}
    }

    doc.setFontSize(16);
    doc.setTextColor(10, 102, 194);
    doc.text("GRUPPFÖRTECKNING", pageW / 2, y + 6, { align: "center" });

    y += 22;

    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(company.name, 12, y);
    doc.text(company.address, 12, y + 4);
    if (company.orgNr) doc.text(`Org.nr: ${company.orgNr}`, 12, y + 8);
    doc.text(`${company.phone}  •  ${company.email}`, 12, y + 12);

    // Right side: Kund
    doc.text("Kund", pageW - 12, y, { align: "right" });
    doc.text(inst.customer.name || "-", pageW - 12, y + 4, { align: "right" });
    doc.text(inst.customer.address || "-", pageW - 12, y + 8, { align: "right" });
    if (inst.customer.phone) doc.text(inst.customer.phone, pageW - 12, y + 12, { align: "right" });

    y += 24;

    // Panel info
    doc.setDrawColor(180);
    doc.line(12, y - 2, pageW - 12, y - 2);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Elcentral: ${inst.panel.location}`, 12, y + 4);
    doc.text(`Huvudsäkring: ${inst.panel.mainFuse}A ${inst.panel.phases}-fas`, pageW - 12, y + 4, { align: "right" });
    doc.text(`Datum: ${formatDate(inst.panel.date)}`, 12, y + 9);

    if (inst.panel.notes) {
      doc.text(`Anteckningar: ${inst.panel.notes}`, 12, y + 14);
      y += 6;
    }

    y += 16;

    // Groups table
    const tableData = inst.groups
      .sort((a, b) => a.nr - b.nr)
      .map(g => [
        g.nr,
        g.description || "",
        `${g.fuse}A`,
        g.conductor || "",
        `${g.phases}-fas`,
        g.lengthM ? `${g.lengthM} m` : "",
        g.loadA ? `${g.loadA} A` : "",
        g.comment || "",
      ]);

    autoTable(doc, {
      startY: y,
      head: [["Nr", "Beskrivning", "Säkring", "Ledare", "Fas", "Längd", "Last (A)", "Kommentar"]],
      body: tableData.length ? tableData : [["", "Inga grupper registrerade", "", "", "", "", "", ""]],
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [10, 102, 194], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 42 },
        2: { cellWidth: 16 },
        3: { cellWidth: 26 },
        4: { cellWidth: 14 },
        5: { cellWidth: 14 },
        6: { cellWidth: 16 },
        7: { cellWidth: 38 },
      },
      margin: { left: 12, right: 12 },
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – jspdf-autotable mutates doc
    y = (doc as any).lastAutoTable.finalY + 8;

    // Totals
    doc.setFontSize(9);
    const sumText = `Antal grupper: ${inst.groups.length}    Summa last: ${totalFuseLoad} A    Huvudsäkring: ${inst.panel.mainFuse}A (${loadPercent}%)`;
    doc.text(sumText, 12, y);

    if (isOverloaded) {
      doc.setTextColor(180, 0, 0);
      doc.text("VARNING: Beräknad last överskrider huvudsäkring!", 12, y + 5);
    }

    y += 14;

    // Signature area
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.text("Installatör: ________________________     Datum: ____________", 12, y);
    doc.text("Kund: ________________________     Datum: ____________", 12, y + 8);

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${company.name}  •  ${format(new Date(), "yyyy-MM-dd")}  •  ElGrupp`, pageW / 2, 287, { align: "center" });

    const filename = `gruppförteckning-${(inst.customer.name || "okand").toLowerCase().replace(/\s+/g, "-")}.pdf`;
    doc.save(filename);
    toast.success("PDF exporterad");
  }

  // Print using browser (nice styled HTML)
  function printInstallation(inst: Installation) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Tillåt popup-fönster för utskrift");
      return;
    }

    const groupsHtml = inst.groups
      .sort((a,b)=>a.nr-b.nr)
      .map(g => `
        <tr>
          <td>${g.nr}</td>
          <td>${g.description}</td>
          <td>${g.fuse} A</td>
          <td>${g.conductor}</td>
          <td>${g.phases}-fas</td>
          <td>${g.lengthM || ""}</td>
          <td>${g.loadA || ""}</td>
          <td>${g.comment || ""}</td>
        </tr>
      `).join("");

    const logoHtml = company.logo ? `<img src="${company.logo}" style="max-height:42px;max-width:120px"/>` : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Gruppförteckning - ${inst.customer.name || "Elcentral"}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: system-ui, sans-serif; font-size: 11px; color:#111; margin:0; padding:0; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0a66c2; padding-bottom:8px; margin-bottom:12px; }
          .title { font-size:18px; font-weight:700; color:#0a66c2; letter-spacing:-0.3px; }
          table { width:100%; border-collapse:collapse; margin:10px 0; }
          th, td { border:1px solid #444; padding:4px 6px; text-align:left; font-size:9.5px; }
          th { background:#0a66c2; color:white; }
          .info { margin-bottom:10px; }
          .info-row { display:flex; gap:24px; }
          .info-col { flex:1; }
          .totals { font-weight:600; margin:8px 0; }
          .sig { margin-top:22px; display:flex; gap:40px; }
          .sig > div { flex:1; }
          .warning { color:#b00; font-weight:700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>${logoHtml}<div><strong>${company.name}</strong><br/>${company.address}<br/>${company.phone} • ${company.email}<br/>Org.nr: ${company.orgNr}</div></div>
          <div style="text-align:right">
            <div class="title">GRUPPFÖRTECKNING</div>
            <div style="margin-top:4px">${formatDate(inst.panel.date)}</div>
          </div>
        </div>

        <div class="info">
          <div class="info-row">
            <div class="info-col"><strong>Kund</strong><br/>${inst.customer.name}<br/>${inst.customer.address}<br/>${inst.customer.phone}</div>
            <div class="info-col"><strong>Elcentral</strong><br/>${inst.panel.location}<br/>Huvudsäkring: ${inst.panel.mainFuse}A ${inst.panel.phases}-fas<br/>${inst.panel.notes ? "Anteckn.: " + inst.panel.notes : ""}</div>
          </div>
        </div>

        <table class="grupp-print-table">
          <thead>
            <tr><th>Nr</th><th>Beskrivning</th><th>Säkring</th><th>Ledare</th><th>Fas</th><th>Längd</th><th>Last</th><th>Kommentar</th></tr>
          </thead>
          <tbody>
            ${groupsHtml || `<tr><td colspan="8">Inga grupper</td></tr>`}
          </tbody>
        </table>

        <div class="totals">
          Antal grupper: ${inst.groups.length} &nbsp;&nbsp; Summa last: ${totalFuseLoad} A &nbsp;&nbsp; Huvudsäkring: ${mainFuse} A (${loadPercent}%)
          ${isOverloaded ? `<span class="warning"> — ÖVERSKRIDER HUVUDSÄKRING!</span>` : ""}
        </div>

        <div class="sig">
          <div>Installatör: ________________________ &nbsp;&nbsp; Datum: ____________</div>
          <div>Kund: ________________________ &nbsp;&nbsp; Datum: ____________</div>
        </div>

        <div style="margin-top:30px;font-size:9px;color:#666;text-align:center">
          ${company.name} • ElGrupp • ${format(new Date(), "yyyy-MM-dd")}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  }

  // Export all data
  function exportAllData() {
    const data = { company, installations, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elgrupp-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("All data exporterad som JSON");
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.company) setCompany(parsed.company);
        if (Array.isArray(parsed.installations)) setInstallations(parsed.installations);
        toast.success("Data importerad");
      } catch (err) {
        toast.error("Kunde inte läsa filen");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function loadDemoData() {
    const demo: Installation = {
      id: newId(),
      updatedAt: new Date().toISOString(),
      customer: {
        name: "Anna Svensson",
        address: "Kvarnvägen 7, 141 44 Huddinge",
        phone: "070-555 12 34",
        email: "anna.s@example.com",
      },
      panel: {
        location: "Huvudcentral – källare",
        mainFuse: 25,
        phases: 3,
        date: "2026-06-18",
        notes: "Nyinstallation efter renovering",
      },
      groups: [
        { id: newId(), nr: 1, description: "Belysning entré + hall", fuse: 10, conductor: "1.5 mm² EKK", phases: 1, loadA: 6, comment: "" },
        { id: newId(), nr: 2, description: "Uttag kök + diskbänk", fuse: 16, conductor: "2.5 mm² EKK", phases: 1, loadA: 14 },
        { id: newId(), nr: 3, description: "Spis", fuse: 25, conductor: "4 mm² EKK", phases: 1, loadA: 19 },
        { id: newId(), nr: 4, description: "Tvättmaskin + tork", fuse: 16, conductor: "2.5 mm² EKK", phases: 1, loadA: 13 },
        { id: newId(), nr: 5, description: "Värmepump", fuse: 20, conductor: "4 mm² FK", phases: 1, loadA: 15 },
        { id: newId(), nr: 6, description: "Uttag vardagsrum + sovrum", fuse: 16, conductor: "2.5 mm² EKK", phases: 1, loadA: 9 },
      ],
      serviceLog: [
        { id: newId(), date: "2026-06-18", note: "Installation slutförd. Alla grupper testade.", performedBy: company.name },
      ],
    };
    setInstallations([demo, ...installations.filter(i => !i.customer.name.includes("Anna"))]);
    setEditingId(demo.id);
    toast.success("Demodata inladdad");
  }

  // --- Render editor for selected installation ---
  function renderEditor(inst: Installation) {
    return (
      <div className="max-w-[1100px] mx-auto pb-20">
        <div className="flex items-center justify-between mb-4 no-print">
          <button 
            onClick={saveAndCloseEditor} 
            className="btn btn-secondary flex items-center gap-1.5"
          >
            <ArrowLeft size={16} /> Tillbaka till listan
          </button>
          <div className="flex gap-2">
            <button onClick={() => printInstallation(inst)} className="btn btn-secondary">
              <Printer size={16} /> Skriv ut
            </button>
            <button onClick={() => exportToPDF(inst)} className="btn btn-primary">
              <Download size={16} /> Ladda ner PDF
            </button>
            <button onClick={saveAndCloseEditor} className="btn btn-primary">
              <Save size={16} /> Klar
            </button>
          </div>
        </div>

        {/* Header info */}
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Kund</div>
              <input className="w-full border-b border-zinc-300 pb-1 font-semibold text-xl mb-2 bg-transparent focus:outline-none" 
                placeholder="Kundnamn" value={inst.customer.name} 
                onChange={e => updateInstallation({ ...inst, customer: { ...inst.customer, name: e.target.value } })} />
              <input className="w-full text-sm mb-1 bg-transparent border-b border-zinc-200" placeholder="Adress" value={inst.customer.address} 
                onChange={e => updateInstallation({ ...inst, customer: { ...inst.customer, address: e.target.value } })} />
              <div className="flex gap-3 text-sm">
                <input className="flex-1 bg-transparent border-b border-zinc-200" placeholder="Telefon" value={inst.customer.phone} 
                  onChange={e => updateInstallation({ ...inst, customer: { ...inst.customer, phone: e.target.value } })} />
                <input className="flex-1 bg-transparent border-b border-zinc-200" placeholder="E-post" value={inst.customer.email} 
                  onChange={e => updateInstallation({ ...inst, customer: { ...inst.customer, email: e.target.value } })} />
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Elcentral</div>
              <input className="w-full border-b pb-1 font-semibold text-xl mb-2 bg-transparent focus:outline-none" 
                placeholder="Plats / beteckning" value={inst.panel.location} 
                onChange={e => updateInstallation({ ...inst, panel: { ...inst.panel, location: e.target.value } })} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-1">
                <div>
                  <div className="text-xs text-zinc-500">Huvudsäkring</div>
                  <select className="w-full border border-zinc-300 rounded px-2 py-1" 
                    value={inst.panel.mainFuse} 
                    onChange={e => updateInstallation({ ...inst, panel: { ...inst.panel, mainFuse: parseInt(e.target.value) } })}>
                    {FUSE_OPTIONS.map(f => <option key={f} value={f}>{f} A</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Faser</div>
                  <select className="w-full border border-zinc-300 rounded px-2 py-1" 
                    value={inst.panel.phases} 
                    onChange={e => updateInstallation({ ...inst, panel: { ...inst.panel, phases: parseInt(e.target.value) as 1 | 3 } })}>
                    {PHASE_OPTIONS.map(p => <option key={p} value={p}>{p}-fas</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Datum</div>
                  <input type="date" className="w-full border border-zinc-300 rounded px-2 py-1" value={inst.panel.date}
                    onChange={e => updateInstallation({ ...inst, panel: { ...inst.panel, date: e.target.value } })} />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Anteckningar</div>
                  <input className="w-full border border-zinc-300 rounded px-2 py-1" value={inst.panel.notes || ""} 
                    onChange={e => updateInstallation({ ...inst, panel: { ...inst.panel, notes: e.target.value } })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="mb-2 flex items-center justify-between">
          <div className="section-title flex items-center gap-2">
            <Zap size={18} /> Grupper ({totalGroups})
          </div>
          <div className="text-sm">
            {isOverloaded && <span className="text-red-600 font-medium mr-3">Överlast!</span>}
            Summa last: <span className="font-semibold">{totalFuseLoad} A</span> / {mainFuse} A ({loadPercent}%)
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3 no-print">
          {QUICK_PRESETS.map((p, idx) => (
            <button key={idx} onClick={() => addGroup(p)} className="btn btn-secondary text-xs py-1.5 px-3">
              + {p.label}
            </button>
          ))}
          <button onClick={() => addGroup()} className="btn btn-primary text-xs py-1.5 px-3">
            <Plus size={15} /> Ny tom rad
          </button>
        </div>

        {/* Groups table (desktop) */}
        <div className="card overflow-hidden mb-6 hidden md:block">
          <table className="grupp-table">
            <thead>
              <tr>
                <th className="w-10">Nr</th>
                <th>Beskrivning</th>
                <th className="w-20">Säkring</th>
                <th>Ledare</th>
                <th className="w-16">Fas</th>
                <th className="w-16">Längd</th>
                <th className="w-20">Last (A)</th>
                <th>Kommentar</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {inst.groups.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-400">Inga grupper. Lägg till med knapparna ovan.</td></tr>
              )}
              {inst.groups.sort((a,b)=>a.nr-b.nr).map((g, idx) => (
                <tr key={g.id}>
                  <td><input type="number" value={g.nr} onChange={e => updateGroup(g.id, "nr", e.target.value)} className="w-12" /></td>
                  <td><input value={g.description} onChange={e => updateGroup(g.id, "description", e.target.value)} placeholder="T.ex. Uttag kök" /></td>
                  <td>
                    <select value={g.fuse} onChange={e => updateGroup(g.id, "fuse", e.target.value)}>
                      {FUSE_OPTIONS.map(f => <option key={f} value={f}>{f}A</option>)}
                    </select>
                  </td>
                  <td><input value={g.conductor} onChange={e => updateGroup(g.id, "conductor", e.target.value)} /></td>
                  <td>
                    <select value={g.phases} onChange={e => updateGroup(g.id, "phases", e.target.value)}>
                      <option value={1}>1-fas</option>
                      <option value={3}>3-fas</option>
                    </select>
                  </td>
                  <td><input type="number" value={g.lengthM ?? ""} onChange={e => updateGroup(g.id, "lengthM", e.target.value)} /></td>
                  <td><input type="number" value={g.loadA ?? ""} onChange={e => updateGroup(g.id, "loadA", e.target.value)} /></td>
                  <td><input value={g.comment || ""} onChange={e => updateGroup(g.id, "comment", e.target.value)} /></td>
                  <td>
                    <button onClick={() => removeGroup(g.id)} className="text-red-500 p-1"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: group cards */}
        <div className="md:hidden">
          {inst.groups.length === 0 && <div className="text-center py-8 text-zinc-400">Inga grupper ännu.</div>}
          {inst.groups.sort((a,b)=>a.nr-b.nr).map((g, idx) => (
            <div key={g.id} className="group-card">
              <div className="flex justify-between mb-2">
                <input type="number" className="w-14 font-bold" value={g.nr} onChange={e => updateGroup(g.id, "nr", e.target.value)} />
                <button onClick={() => removeGroup(g.id)} className="text-red-500"><Trash2 size={16} /></button>
              </div>
              <input value={g.description} placeholder="Beskrivning" className="mb-2 w-full" onChange={e => updateGroup(g.id, "description", e.target.value)} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-[10px] text-zinc-500">Säkring</div>
                  <select value={g.fuse} onChange={e => updateGroup(g.id, "fuse", e.target.value)} className="w-full">
                    {FUSE_OPTIONS.map(f => <option key={f} value={f}>{f} A</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500">Fas</div>
                  <select value={g.phases} onChange={e => updateGroup(g.id, "phases", e.target.value)} className="w-full">
                    <option value="1">1-fas</option><option value="3">3-fas</option>
                  </select>
                </div>
                <input placeholder="Ledare" value={g.conductor} onChange={e => updateGroup(g.id, "conductor", e.target.value)} />
                <div className="flex gap-2">
                  <input placeholder="m" type="number" value={g.lengthM ?? ""} onChange={e => updateGroup(g.id, "lengthM", e.target.value)} className="flex-1" />
                  <input placeholder="A" type="number" value={g.loadA ?? ""} onChange={e => updateGroup(g.id, "loadA", e.target.value)} className="flex-1" />
                </div>
              </div>
              <input value={g.comment || ""} placeholder="Kommentar" className="mt-2 w-full text-sm" onChange={e => updateGroup(g.id, "comment", e.target.value)} />
            </div>
          ))}
          <button onClick={() => addGroup()} className="btn btn-primary w-full mt-1">+ Lägg till grupp</button>
        </div>

        {/* Digital servicebok */}
        <div className="mt-8">
          <div className="section-title flex items-center gap-2"><User size={17} /> Digital servicebok</div>
          <div className="card p-4">
            <button onClick={addServiceEntry} className="btn btn-secondary mb-3 text-sm">+ Ny serviceanteckning</button>
            {inst.serviceLog.length === 0 && <div className="text-sm text-zinc-500">Inga anteckningar än.</div>}
            {inst.serviceLog.map(entry => (
              <div key={entry.id} className="border border-zinc-200 rounded-xl p-3 mb-2 bg-white">
                <div className="flex gap-2 mb-1 text-sm">
                  <input type="date" value={entry.date} onChange={e => updateServiceEntry(entry.id, "date", e.target.value)} className="border px-1 rounded" />
                  <input value={entry.performedBy || ""} placeholder="Utförd av" onChange={e => updateServiceEntry(entry.id, "performedBy", e.target.value)} className="flex-1 border px-2 rounded" />
                  <button onClick={() => removeServiceEntry(entry.id)} className="text-red-500"><Trash2 size={15} /></button>
                </div>
                <textarea value={entry.note} placeholder="Anteckning..." onChange={e => updateServiceEntry(entry.id, "note", e.target.value)} 
                  className="w-full border border-zinc-200 rounded p-2 text-sm min-h-[48px]" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-xs text-zinc-400 flex justify-between no-print">
          <div>Senast ändrad: {formatDate(inst.updatedAt)}</div>
          <button onClick={() => deleteInstallation(inst.id)} className="text-red-500 flex items-center gap-1 hover:underline"><Trash2 size={14}/> Ta bort</button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur no-print">
        <div className="max-w-[1100px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-xl tracking-tighter">
              <Zap className="text-[#0a66c2]" /> ElGrupp
            </div>
            <div className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 hidden sm:block">Gruppförteckningar</div>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <button 
              onClick={() => { setEditingId(null); setActiveView("installations"); }} 
              className={`btn px-3 py-1.5 ${activeView === "installations" && !editingId ? "bg-zinc-900 text-white" : "btn-secondary"}`}
            >
              <List size={16} /> Centraler
            </button>
            <button 
              onClick={() => { setEditingId(null); setActiveView("company"); }} 
              className={`btn px-3 py-1.5 ${activeView === "company" ? "bg-zinc-900 text-white" : "btn-secondary"}`}
            >
              <Building2 size={16} /> Företag
            </button>
            <button onClick={createNewInstallation} className="btn btn-primary ml-1">
              <Plus size={17} /> Ny
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-3 sm:px-4 py-5">
        {/* When editing an installation */}
        {editingId && currentInstallation && renderEditor(currentInstallation)}

        {/* INSTALLATIONS LIST VIEW */}
        {!editingId && activeView === "installations" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-semibold tracking-tighter">Mina gruppförteckningar</h1>
              <div className="flex gap-2">
                <button onClick={loadDemoData} className="btn btn-secondary text-xs">Ladda demodata</button>
                <label className="btn btn-secondary text-xs cursor-pointer">
                  <Upload size={14} /> Importera
                  <input type="file" accept=".json" onChange={importData} className="hidden" />
                </label>
                <button onClick={exportAllData} className="btn btn-secondary text-xs">
                  <Download size={14} /> Exportera allt
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input 
                type="text" 
                placeholder="Sök efter kund eller plats..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full max-w-sm border border-zinc-300 rounded-lg px-3 py-2 text-sm" 
              />
            </div>

            {filteredInstallations.length === 0 && (
              <div className="card p-10 text-center text-zinc-500">
                Inga sparade gruppförteckningar.<br />
                <button onClick={createNewInstallation} className="btn btn-primary mt-4">Skapa din första</button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstallations.map(inst => (
                <div key={inst.id} className="card p-4 hover:shadow transition flex flex-col">
                  <div className="text-xs text-zinc-500 flex justify-between">
                    <span>{formatDate(inst.panel.date)}</span>
                    <span>{inst.groups.length} grupper</span>
                  </div>
                  <div className="font-semibold text-xl mt-1 tracking-tight truncate">{inst.customer.name || "Namnlös kund"}</div>
                  <div className="text-sm text-zinc-600 truncate">{inst.panel.location}</div>
                  <div className="text-sm mt-auto pt-4 text-zinc-500">
                    {inst.customer.address}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setEditingId(inst.id)} className="btn btn-primary flex-1">
                      <Edit2 size={15} /> Öppna
                    </button>
                    <button onClick={() => duplicateInstallation(inst)} className="btn btn-secondary" title="Duplicera"><Copy size={15} /></button>
                    <button onClick={() => exportToPDF(inst)} className="btn btn-secondary" title="PDF"><Download size={15} /></button>
                    <button onClick={() => deleteInstallation(inst.id)} className="btn btn-danger" title="Ta bort"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center text-xs text-zinc-400">
              All data sparas lokalt i din webbläsare. Använd Exportera/Importera för att flytta mellan enheter.
            </div>
          </div>
        )}

        {/* COMPANY SETTINGS */}
        {!editingId && activeView === "company" && (
          <div className="max-w-xl">
            <h1 className="text-2xl font-semibold tracking-tighter mb-1">Företagsinställningar</h1>
            <p className="text-sm text-zinc-600 mb-6">Uppgifter och logotyp sparas lokalt och visas på alla utskrifter och PDF:er.</p>

            <div className="card p-6 space-y-5">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Företagsnamn</label>
                <input value={company.name} onChange={e => updateCompany("name", e.target.value)} className="w-full text-lg border-b pb-1" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Adress</label>
                <input value={company.address} onChange={e => updateCompany("address", e.target.value)} className="w-full border-b pb-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Organisationsnummer</label>
                  <input value={company.orgNr} onChange={e => updateCompany("orgNr", e.target.value)} className="w-full border-b pb-1" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Telefon</label>
                  <input value={company.phone} onChange={e => updateCompany("phone", e.target.value)} className="w-full border-b pb-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">E-post</label>
                <input value={company.email} onChange={e => updateCompany("email", e.target.value)} className="w-full border-b pb-1" />
              </div>

              <div>
                <label className="text-xs text-zinc-500 block mb-2">Logotyp</label>
                <div className="flex items-center gap-4">
                  {company.logo ? (
                    <div className="relative">
                      <img src={company.logo} alt="Logotyp" className="h-16 rounded border" />
                      <button onClick={removeLogo} className="absolute -top-1 -right-1 text-xs bg-white border rounded-full p-0.5">✕</button>
                    </div>
                  ) : (
                    <div className="h-16 w-24 border border-dashed flex items-center justify-center text-xs text-zinc-400 rounded">Ingen logotyp</div>
                  )}
                  <label className="btn btn-secondary cursor-pointer text-sm">
                    Ladda upp logotyp
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
                <div className="text-xs text-zinc-400 mt-1">Används i PDF och utskrifter.</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => { setActiveView("installations"); }} className="btn btn-primary">Klar – gå till centraler</button>
              <button onClick={exportAllData} className="btn btn-secondary">Exportera allt</button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs py-5 text-zinc-400 border-t no-print">
        ElGrupp — Enkel mobilanpassad app för elektriker. Testa på telefon via http://&lt;din-ip&gt;:3000
      </footer>
    </div>
  );
}
