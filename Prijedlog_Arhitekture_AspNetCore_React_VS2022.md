# Arhitektonski prijedlog: ASP.NET Core + React ERP u Visual Studio 2022

Ovaj dokument je izrađen na osnovu dostavljenog prototipa `Prototip_Zapisnik_Ulaza_ERP.html` i stručne analize `Analiza_UI_UX_ERP_Zapisnik_Ulaza.md`, sa ciljem usklađivanja sa vašim zahtjevom za **ASP.NET Core backend, React frontend i podršku za Visual Studio 2022**.

---

## 1. Analiza dostavljenog primjera i prepoznavanje alata

Pregledom koda datoteke `Prototip_Zapisnik_Ulaza_ERP.html` utvrđeno je sljedeće:

1. **Korišteni alati i tehnologije:**
   - **Tehnologija:** Čisti, samostalni **HTML5 + CSS3 + Vanilla JavaScript** (Single-file prototip, bez spoljnih CDN biblioteka).
   - **Stilski sistem:** Izgrađen pomoću prilagođenih **CSS varijabli (CSS Custom Properties)**:
     - Primarne boje: Enterprise Navy (`--navy: #17324d`), ERP Blue (`--blue: #2867b2`), pozadina (`--bg: #f4f6f9`), linije razdvajanja (`--line: #dce3eb`).
     - Statusi: Nacrt (`--orange: #b86c10`, pozadina `#fff3db`), Potvrđen (`--green: #16835f`, pozadina `#dff5e9`).
   - **Tipografija i layout:** Tipografski stack `Inter, "Segoe UI", Arial, sans-serif`. Raspored je riješen putem **CSS Grid-a** (220px fiksni sidebar + fleksibilni radni prostor) i **CSS Flexbox-a**.
   - **Logika stanja (State Management):** Čisti JavaScript u memoriji browsera (`let docs = [...]`, `renderList()`, `renderItems()`, `saveDraft()`, `confirmDoc()`), sa podrškom za dinamičku izmjenu polja direktno u redu tabele (`editField`).

2. **Glavna poruka iz prateće analize (`Analiza_UI_UX_ERP_Zapisnik_Ulaza.md`):**
   - **Kombinovani model je pobjedničko rješenje:**
     - *Lista dokumenata:* Služi za brzi pregled, filtriranje po statusu (Nacrt/Potvrđen), pretragu i selekciju.
     - *Jedinstvena forma detalja dokumenta (Single-page Workspace):* Umjesto prebacivanja korisnika kroz 3 odvojena koraka i modala, na jednom ekranu se nalaze **kompaktno zaglavlje** i **centralna tabela stavki**.
     - *Direktna izmjena u tabeli (Inline Editing):* Korisnik može kucati u ćeliju tabele, koristiti tastere `Tab` i `Enter` za prelazak na sljedeću stavku, te duplicirati stavku (`⧉ Kopiraj`).
     - *Ključno pravilo:* **„Sačuvaj nacrt“ i „Potvrdi“ nisu ista operacija.**
       - *Nacrt (Draft):* Čuva unijete podatke bez uticaja na stanje skladišta i KEP, omogućava povratak i nastavak unosa.
       - *Potvrđen (Posted):* Zaključava dokument za direktne izmjene, zadužuje/razdužuje skladište i automatski knjiži evidenciju.

---

## 2. Nova arhitektura: ASP.NET Core + React za Visual Studio 2022

Kako biste projekat mogli otvoriti direktno u **Visual Studio 2022**, pokrenuti pritiskom na `F5` / `Ctrl+F5`, te imati profesionalnu enterprise strukturu, predlažemo sljedeću organizaciju **Solution-a**:

```text
WebPos.sln
│
├── src/
│   ├── WebPos.Domain/                     # C# Class Library (.NET 8/9)
│   │   ├── Entities/                      # Document, DocumentLine, Item, Partner, Warehouse
│   │   ├── Enums/                         # DocumentStatus (Draft, Posted, Canceled), DocumentType
│   │   └── Interfaces/                    # Repositories & Domain rules
│   │
│   ├── WebPos.Application/                  # C# Class Library (.NET 8/9)
│   │   ├── Documents/Commands/            # CreateDraftCommand, UpdateDraftCommand, PostDocumentCommand
│   │   ├── Documents/Queries/             # GetDocumentsListQuery, GetDocumentByIdQuery
│   │   ├── Common/Models/                 # DTOs, PagedResult, CalculationEngine
│   │   └── Validators/                    # FluentValidation za poslovna pravila
│   │
│   ├── WebPos.Infrastructure/               # C# Class Library (.NET 8/9)
│   │   ├── Persistence/                   # PostgreSQL 17 EF Core DbContext + SQLite WAL podrška
│   │   ├── Migrations/                    # EF Core migracije
│   │   └── Services/                      # ExcelOpenXmlGenerator, PdfDocumentEngine
│   │
│   ├── WebPos.WebApi/                     # ASP.NET Core Web API (.NET 8/9)
│   │   ├── Controllers/                   # DocumentsController, ItemsController, PartnersController
│   │   ├── Middleware/                    # ErrorHandling, TenantResolution
│   │   ├── Program.cs                     # DI kontejner, Swagger/OpenAPI, CORS
│   │   └── appsettings.json               # Konekcije za bazu (PostgreSQL / SQLite)
│   │
│   └── WebPos.Web/                        # React 18/19 + TypeScript + Vite SPA
│       ├── package.json
│       ├── vite.config.ts
│       ├── src/
│       │   ├── api/                       # Typed fetch / Axios klijenti za ASP.NET Core API
│       │   ├── components/                # Enterprise UI kontrole (Tabele, Combobox, Modali)
│       │   ├── pages/documents/           # Lista zapisnika/kalkulacija i Radni ekran detalja
│       │   └── store/                     # TanStack Query / Zustand za keširanje i stanje
│       └── WebPos.Web.esproj              # Visual Studio JavaScript/TypeScript Project datoteka
```

### Zašto ovakav raspored u Visual Studio 2022?
1. **`.sln` i `.esproj` integracija:** Visual Studio 2022 ima punu nativnu podršku za `.esproj` (JavaScript/TypeScript projekat). Kada u Visual Studiju pritisnete **F5**:
   - Pokreće se ASP.NET Core Web API na npr. `https://localhost:7100` (sa Swagger dokumentacijom).
   - Automatski se pokreće React frontend koji komunicira sa API-jem.
2. **Čista poslovna logika (Clean Architecture):** Pravila o skladištu, razdvajanju nacrta i potvrde, obračunu poreza i KEP-u nalaze se u `WebPos.Domain` i `WebPos.Application`, testirani unit testovima nezavisno od baze podataka.
3. **Dvije baze podataka (Hibrid):** EF Core koristi PostgreSQL 17 za centralni ERP rad, a isti DbContext može raditi i sa SQLite baze za offline POS kasu.

---

## 3. UI/UX Prijedlog radnog ekrana: Zapisnik ulaza & Kalkulacija

Kombinujući smjernice iz dostavljenog `Analiza_UI_UX_ERP_Zapisnik_Ulaza.md` i našeg već razvijenog kalkulacijskog modula, predlažemo sljedeći izgled i funkcionalnosti ekrana:

### 3.1. Glavna lista dokumenata (ListView)
- **Zaglavlje liste:** Naziv modula, indikator aktivnog skladišta/poslovnice, dugme `＋ Novi zapisnik`.
- **Brzi filteri (uvijek vidljivi pri vrhu):**
  - Tekstualna pretraga (broj dokumenta, dobavljač, broj narudžbe).
  - Filter po statusu: *Svi*, *Nacrt (Draft)*, *Potvrđen (Posted)*.
  - Filter po skladištu i datumski opseg (*Od datuma - Do datuma*).
- **Tabela dokumenata:**
  - Prikaz: Broj, Datum, Dobavljač, Skladište, Broj stavki, Ukupna vrijednost (KM), Status bedž (`Nacrt` u narandžastoj boji, `Potvrđen` u zelenoj boji).
  - Klik na bilo koji red trenutno otvara radni ekran detalja.

### 3.2. Jedinstveni radni ekran detalja (DetailView)
- **Top bar ekrana:**
  - Dugme `← Nazad na listu` (sa automatskim upozorenjem ako ima nesnimljenih izmjena).
  - Naslov sa brojem dokumenta i statusnim bedžom.
  - Akcijska dugmad: `Sačuvaj nacrt`, `Potvrdi dokument (Zaključaj)`, `A4 Štampa`, `Izvoz u Excel`.
- **Sekcija A: Kompaktno zaglavlje (Osnovni podaci):**
  - Organizovano u pregledan grid (4 kolone na desktopu, 2 na tabletu):
    - *Dobavljač:* Brzi pretraživač partnera (JIB, PIB, naziv).
    - *Skladište prijema:* Padajući izbor (Centralno, Sirovine, MP...).
    - *Datum prijema i Datum fakture.*
    - *Broj narudžbe i Broj otpremnice dobavljača.*
    - *Napomena.*
  - Zaglavlje je kompaktno (zauzima samo ~15% gornjeg dijela ekrana) kako bi tabela stavki imala maksimalan prostor.
- **Sekcija B: Centralna tabela stavki (Glavni radni prostor):**
  - **Dva načina unosa:**
    1. *Brzi inline unos direktno u tabelu:* Korisnik u praznom redu bira artikal (pretraga "sadrži tekst"), unosi količinu i cijenu, a pritiskom na `Tab` ili `Enter` prelazi u novo polje ili novi red.
    2. *Modalni unos (za detaljniji unos):* Za artikle sa rabatima, zavisnim troškovima ili serijskim brojevima.
  - **Akcije nad stavkama:**
    - `⧉ Kopiraj zadnju stavku` (odlično za artikle sličnih cijena/osobina).
    - `✕ Obriši stavku`.
  - **Automatski obračuni:** Množenje primljene količine sa cijenom, obračun poreza i marže u realnom vremenu bez ponovnog učitavanja.
- **Sekcija C: Sumarni panel (Totals):**
  - Prikaz u donjem desnom uglu: Broj stavki, Ukupna primljena količina, Ukupna vrijednost bez PDV-a, PDV iznos i Ukupno zaduženje skladišta.
- **Sekcija D: Zaključavanje nakon potvrde:**
  - Čim korisnik klikne **„Potvrdi dokument“**, sva polja postaju read-only (zaključana), dokument dobija status `Potvrđen`, zalihe na skladištu se zadužuju, a u bazi se kreira neizbrisivi revizijski trag.

---

## 4. Plan realizacije za Visual Studio 2022 Solution

Kako bi se ovaj koncept pretočio u kompletan, kompilabilan Visual Studio 2022 projekat, predlažemo sljedeće korake:

1. **Kreiranje ASP.NET Core Solution-a:**
   - Kreiranje `WebPos.sln` sa .NET 8 / C# projektima (`Domain`, `Application`, `Infrastructure`, `WebApi`).
   - Kreiranje `WebPos.Web.esproj` koji omogućava da Visual Studio 2022 prepozna React projekat i pokrene ga u istom Solution-u.
2. **Povezivanje baze podataka (Entity Framework Core):**
   - Entiteti za Zapisnik ulaza / Kalkulaciju sa zaglavljem i stavkama.
   - Migracije za PostgreSQL (server) i SQLite (lokalni rad).
3. **Implementacija API kontrolera:**
   - `GET /api/documents/inbound` (pretraga i filtriranje).
   - `POST /api/documents/inbound/draft` (čuvanje nacrta).
   - `POST /api/documents/inbound/{id}/post` (knjiženje i potvrda).
   - `GET /api/documents/inbound/{id}/print` (A4 PDF) i `/export` (Excel).
4. **Izrada modernog React frontenda:**
   - Implementacija modernog interfejsa baziranog na konceptu iz `Prototip_Zapisnik_Ulaza_ERP.html` i `Analiza_UI_UX_ERP_Zapisnik_Ulaza.md`.
