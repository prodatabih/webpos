# Plan Implementacije — Zapisnik sa prve kontrole (WebPos ERP)

Dokument je izrađen na osnovu dostavljenog dokumenta **"Zapisnik sa prve kontrole"** i definisanih pravila u [GEMINI.md](file:///home/antigravity/GEMINI.md) i [CLAUDE.md](file:///home/antigravity/prodatabih/webpos/CLAUDE.md).

---

## 1. Novi prijedlog dizajna i UI/UX arhitekture

Dosadašnji izgled aplikacije je patio od uobičajene mane generičkih web aplikacija — forme su izgledale kao pojedinačni modalni dijalozi sa par polja, neprikladni za brz, cjelodnevan rad iskusnog trgovca, skladištara ili knjigovođe.

### Ključni stubovi novog dizajna:

1. **Spreadsheet-grade Radni Prostor (Umjesto malih pop-up formi):**
   - Za složene dokumente (Kalkulacija, Nivelacija, Popis, Međuskladišnica) uvodi se **puni radni prostor preko cijelog ekrana**.
   - **Tastaturni unos visokih performansi:** Kretanje kroz kolone tasterima `Tab` ili `Enter`, prelazak u novi red pritiskom na `Enter` na zadnjem polju, brisanje reda sa `Shift+Del`.
   - **Dvosmjerni proračun u letu:**
     - Unos fakturne cijene + rabata + marže automatski računa maloprodajnu cijenu (MPC).
     - Ručna izmjena MPC automatski preračunava maržu i razliku u cijeni.

2. **Ultra-brzi Virtualizovani Combobox (Baza od 50.000+ artikala i hiljade partnera):**
   - Standardni HTML `<select>` blokira browser već pri 1.000 stavki.
   - Implementira se virtuelizovana lista koja u memoriji drži indeks (pretraga po: šifra, barkod, dio naziva metodom `contains`), a u DOM renderuje samo 8–10 vidljivih stavki.
   - Odziv pretrage je ispod 5 milisekundi čak i na bazi od 50.000 artikala.
   - Prikaz u padajućoj listi: `[Šifra] Naziv artikla | JM | Zadnja NC | Trenutna MPC | Stanje zaliha`.

3. **Pravi Službeni A4 Dokumenti (PDF / Print Engine):**
   - Umjesto sirovog izvoza ekranske tabele, svaki dokument (Kalkulacija MP/VP, A4 Faktura, Knjiga prometa, KEP, Popisna lista, Zapisnik o višku/manjku) dobija svoj **propisani A4 obrazac**.
   - Sadrži puni memorandum firme (Naziv, sjedište, JIB, PDV, žiro računi), broj dokumenta, podatke o partneru, tačne zakonske kolone, rekapitulaciju poreza po stopama i prostor za potpise komisije/likvidatora.

4. **Pravi Excel Izvoz (`.xlsx` umjesto CSV):**
   - Uvodi se direktno generisanje standardnog Microsoft Excel OpenXML formata (`.xlsx`).
   - Brojevi se eksportuju kao numeričke vrijednosti sa odgovarajućim formatom (2 i 4 decimale), a ne kao stringovi.
   - Ukinut svaki prividni "export u Excel" koji je u pozadini nudio CSV.

5. **Čišćenje i pojednostavljenje POS terminologije:**
   - Uklanjaju se svi zbunjujući pojmovi poput *"množilac količine"*. Na računu postoji isključivo jasna `Količina` (npr. `2,00 x 1,50 KM = 3,00 KM`).

---

## 2. Detaljan plan implementacije po tačkama kontrole

### Modul 1: Ulazne Kalkulacije (Primke) i Zavisni Troškovi (ZTR)
- **Zaglavlje dokumenta:**
  - Poslovni partner (brzi autocomplete sa JIB, PIB, gradom i definisanim ugovornim rabatom).
  - Broj fakture dobavljača, datum fakture, datum prijema robe, valuta plaćanja.
  - Izbor skladišta: Maloprodaja (zaduženje po MPC sa PDV), Veleprodaja (po VPC bez PDV ili NC), Magacin sirovina (po NC).
- **Zavisni troškovi (ZTR):**
  - Panel za unos troškova: Prevoz, Carina, Špedicija, Istovar/Manipulacija, Ostalo.
  - Automatska raspodjela na stavke:
    - *Opcija A:* Proporcionalno neto fakturnoj vrijednosti (najčešći zakonski model).
    - *Opcija B:* Proporcionalno težini (kg) ili količini.
- **Tabela stavki kalkulacije:**
  - Kolone: R.br, Šifra, Naziv, JM, Količina, Fakturna cijena, Rabat %, Iznos rabata, Neto fakturna cijena, ZTR po jedinici, Nabavna cijena (NC), Ukupna nabavna vrijednost, Marža %, Iznos marže, Prodajna cijena bez PDV, Stopa PDV (17%), MPC sa PDV, Ukupna MP vrijednost.
- **Zakonska štampa:**
  - A4 Maloprodajna kalkulacija cijena.
  - A4 Veleprodajna kalkulacija cijena.

### Modul 2: Upravljanje Artikli-Cijene-Zalihe i Automatsko Šifriranje
- **Kontrola promjene prodajne cijene:**
  - Ako artikal ima zalihu $> 0$ u izabranom skladištu: **Strogo zabranjena direktna promjena MPC u šifarniku**.
  - Korisnik dobija jasno obavještenje: *"Artikal ima zalihu na stanju (X kom). Promjena cijene je dozvoljena isključivo kroz Nivelaciju cijena."*
  - **Sistemska postavka (Global Config):** Prekidač *"Dozvoli promjenu cijena bez nivelacije i odlazak zaliha u minus"* (za specifične režime rada i korisnike koji to izričito žele).
- **Mehanizam za određivanje šifara artikala:**
  - Hijerarhijsko šifriranje: Izbor robne grupe (npr. `MLI` - Mliječni proizvodi) automatski nudi sljedeći slobodan broj (npr. `MLI-00142`).
  - Mogućnost unosa numeričkog opsega ili prefiksa, kao i ručnog unosa.
  - Dodavanje atributa artiklu (ambalaža, proizvođač, porijeklo, carinska tarifa, min/max zaliha).

### Modul 3: Pregledi Dnevnog Prometa i Finansijski Izvještaji
- **Filter za period:** Bira se tačan datum ili raspon `Od datuma - Do datuma`.
- **6 analitičkih dimenzija pregleda prometa:**
  1. Po artiklima (količina, nabavna vrijednost, realizovana marža, prodajna vrijednost, porez).
  2. Po načinima plaćanja (gotovina, kartice, virman, vaučeri, kuponi).
  3. Po pojedinačnim računima (vrijeme, broj, kasir, iznos, fiskalni broj).
  4. Po blagajnama / radnim stanicama (POS-1, POS-2...).
  5. Po prodajnim objektima (konsolidovano na nivou cijelog preduzeća).
  6. Po operaterima / kasirima (smjenski izvještaj radnika).
- **Zvanični dokumenti:**
  - Štampa Dnevnog finansijskog izvještaja (Z-izvještaj / presjek stanja).
  - Zakonski propisana Trgovačka knjiga na malo (KEP) i Knjiga prometa (KPR) u PDF i `.xlsx`.

### Modul 4: Robne Kartice i Praćenje Zaliha
- Izbor prodajnog objekta / skladišta.
- Filteri: *"Prikaži samo artikle sa zalihom"* (inicijalno uključeno) vs *"Prikaži sve artikle uključujući nultu zalihu"*.
- Robna kartica artikla: Hronološki pregled svih ulaza i izlaza (Početno stanje, Kalkulacija, Nivelacija, Račun POS, Međuskladišnica, Popis) sa datumom, brojem dokumenta, količinom, cijenom i saldom.

### Modul 5: POS Blagajna i Računi
- **Pregled računa:**
  - Napredni filter (po broju, datumu, blagajniku, kupcu, načinu plaćanja).
  - Dugme **Naknadna štampa** (kopija računa za kupca ili interni slip).
  - Dugme **Fiskalizacija** (ponovno slanje na fiskalni uređaj u slučaju zastoja).
  - Dugme **Štampa porezne fakture A4** (za pravna lica, sa punim podacima kupca, JIB, PDV brojem, specifikacijom stopa i rokom plaćanja).
- **Brza tabela na POS kasi:**
  - Instant pretraga artikla po nazivu, šifri ili barkodu sa prikazom trenutne zalihe.

### Modul 6: Veleprodajna, Nabavna Skladišta i Normativi
- **Vrste skladišta:**
  - MP (Maloprodajno skladište — zaduženje u MPC sa PDV).
  - VP (Veleprodajno skladište — vodi se po veleprodajnim cijenama bez PDV-a ili po nabavnim cijenama).
  - MAT / REP (Magacin repromaterijala / sirovina — vodi se isključivo po nabavnim cijenama NC).
- **Normativi artikala:**
  - Definicija sastavnice (recepture) za gotov proizvod.
  - Za svaku komponentu normativa bira se **izlazno skladište** iz kojeg se roba/sirovina automatski razdužuje prilikom prodaje ili proizvodnje.

### Modul 7: Popis Robe (Inventura), Nivelacije i Međuskladišnice
- **Popis robe (Inventura):**
  - Zakonski propisan obrazac popisne liste (knjigovodstvena količina, stvarna količina, razlika, MPC, finansijski iznos).
  - **Režim rada sa barkod skenerom:** Operater hoda skladištem i skenira barkodove; sistem automatski sabira očitane komade i puni popis.
  - **Knjiženje popisa:**
    - Automatsko kreiranje *Zapisnika o višku* (zadužuje zalihu).
    - Automatsko kreiranje *Zapisnika o manjku* (razdužuje zalihu, obračunava zakonski PDV na nepriznati manjak).
  - Zasebna štampa: Lista viškova, Lista manjkova, Zbirni inventurni elaborat.
- **Nivelacija cijena:**
  - Propisani dokument sa kolonama: Stara MPC, Nova MPC, Razlika, Trenutna zaliha, Ukupno povećanje/smanjenje zalihe, Efekat na PDV i maržu.
- **Međuskladišnica:**
  - Prenos robe sa skladišta A na skladište B uz automatsko usklađivanje zaliha i cijena.

---

## 3. Pitanja i Odluke za Vlasnika

U skladu sa pravilom iz [GEMINI.md](file:///home/antigravity/GEMINI.md) da za sve poslovne, zakonske i logičke odluke konačnu riječ daje korisnik:

1. **Zakonski propis za Trgovačku knjigu (KEP) i Knjigu prometa:**
   - Koji entitet/kanton/zakonski okvir je primaran za propisani izgled obrazaca (Federacija BiH - KEP/KPR, Republika Srpska ili univerzalni format)?
2. **Obračun PDV-a na manjak pri popisu:**
   - Da li manjak po popisu automatski tereti firmu sa 17% PDV-a (kao nepriznati manjak / izuzimanje), ili želite opciju unosa dozvoljenog kala/rastura koji je oslobođen poreza?
3. **Format šifriranja artikala:**
   - Da li preferirate automatski numerički brojač (npr. `000001`, `000002`), prefiks po grupama (npr. `HR-0001`, `PI-0001`) ili slobodan unos uz predloženi sljedeći broj?
4. **Validacija novog mokapa kalkulacije:**
   - Da li izgled i proračun u novom interaktivnom mokapu kalkulacije [Mokap_Kalkulacije_ERP.html](file:///home/antigravity/prodatabih/webpos/Mokap_Kalkulacije_ERP.html) odgovara vašim očekivanjima za radni proces kalkulacije?
