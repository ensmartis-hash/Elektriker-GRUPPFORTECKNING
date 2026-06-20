# Elektriker GRUPPFÖRTECKNING

Enkel, **mobil-först** webbapp för elektriker att skapa, redigera, spara och dela **gruppförteckningar** för elcentraler – med digital servicebok.

Perfekt att köra lokalt på datorn och nås från mobiltelefonen på samma WiFi-nät (ingen molntjänst behövs).

## ✨ Funktioner

### Företagsinställningar
- Företagsnamn, adress, organisationsnummer, telefon och e-post
- Ladda upp logotyp (visas automatiskt i PDF och utskrifter)
- Sparas globalt i webbläsaren

### Hantera gruppförteckningar
- Skapa obegränsat antal elcentraler / gruppförteckningar
- Sök och filtrera i listan
- Duplicera, ta bort, exportera enskilda dokument

### Editor för elcentral
- Kunduppgifter (namn, adress, telefon, e-post)
- Elcentral-info: Plats/beteckning, huvudsäkring (6–63A), fas (1 eller 3), datum, anteckningar
- **Grupper**:
  - Nr, Beskrivning, Säkring, Ledare (t.ex. 2,5 mm² EKK), Fas, Längd (m), Last (A), Kommentar
  - **Snabbknappar** för vanliga grupper: Belysning, Uttag, Spis, Tvättmaskin, Värmepump m.fl.
  - Lägg till/ta bort/redigera rader direkt
  - Mobilanpassad vy med kort (bra på telefon)
- Automatisk beräkning av total last + varning vid överlast mot huvudsäkring

### Digital servicebok
- Logga servicebesök per elcentral
- Datum, utförd av, fritext-anteckning
- Kronologisk lista

### Export & utskrift
- **Ladda ner PDF** – professionell layout med logotyp, tabell, summering och signaturrader (jsPDF + autoTable)
- **Skriv ut** – ren, utskriftsoptimerad vy med browser print
- Båda är redo att lämnas till kund

### Backup & delning
- Exportera **hela databasen** som JSON
- Importera JSON på annan enhet/dator
- All data lagras **lokalt** i webbläsarens localStorage (inget moln)

### Övrigt
- PWA-stöd – kan installeras som app på telefonen
- Helt offline efter första laddning
- Responsiv och touch-vänlig (mobil-först)

## 🚀 Kom igång

### Förutsättningar
- Node.js 18+ (rekommenderas 20+)

### Installation

```bash
# Klona repot
git clone https://github.com/<ditt-användarnamn>/Elektriker-GRUPPFORTECKNING.git
cd Elektriker-GRUPPFORTECKNING

# Installera beroenden
npm install

# Starta utvecklingsservern
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i webbläsaren.

### Bygg för produktion

```bash
npm run build
npm start
```

## 📱 Testa på telefon (LAN)

1. Kör `npm run dev` på datorn
2. Ta reda på datorns lokala IP-adress:
   - Windows: `ipconfig` (leta efter IPv4-adress under Wi-Fi)
3. På telefonen (samma WiFi) öppna:
   ```
   http://192.168.x.x:3000
   ```
   (ersätt med din IP)

**Vanliga problem & lösningar** (från ursprunglig spec):
- Telefon och dator måste vara på samma nätverk
- Stäng av "Privat DNS" tillfälligt på Android (Inställningar → Anslutningar → Mer → Privat DNS → Av)
- Prova att skriva IP-adressen exakt

## 📋 Exempel på gruppförteckning

Appen genererar dokument som innehåller:
- Företagslogotyp + uppgifter
- Kunduppgifter
- Elcentralens uppgifter + huvudsäkring
- Tabell över alla grupper
- Summering + eventuell överlastvarning
- Signaturrader för installatör och kund

## 🛠 Teknik

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- jsPDF + jspdf-autotable för PDF-export
- Sonner för toast-meddelanden
- All data i localStorage (ingen backend)

## 📁 Projektstruktur

```
app/
├── lib/
│   └── types.ts          # TypeScript-typer
├── page.tsx              # Huvudapp (SPA)
├── layout.tsx
└── globals.css
public/
├── manifest.json         # PWA-manifest
```

## 📝 Licens

MIT – använd fritt.

---

Skapad utifrån kravspec från Grok-dialog:  
https://grok.com/share/c2hhcmQtMi1jb3B5_1804eb2f-8b4d-485c-acd7-343550336fc7

Bidrag välkomna! Öppna en issue eller pull request.

