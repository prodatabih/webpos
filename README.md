# WebPOS Enterprise — Hibridni Multi-Tenant POS & ERP Sistem

Moderna Multi-Tenant POS kasa i robno-materijalno knjigovodstvo u kojem se **svi tenanti i sve poslovne godine** nalaze u jednoj bazi podataka sa minimalnom potrošnjom resursa (SQLite WAL / PostgreSQL).

## Ključne funkcionalnosti (Faza 1 — Baza, Tabele, Multi-Tenant Onboarding i Sistem Logovanja)

1. **Jedna baza za sve Tenante i sve Poslovne Godine (`tenant_id` + `fiscal_year`):**
   - Kompletne SQL šeme za **SQLite WAL** (`database/schema_sqlite.sql`) i **PostgreSQL 16** (`database/schema_postgresql.sql`).
   - Tabele: `tenants`, `fiscal_years`, `users`, `password_reset_tokens`, `email_notifications_outbox`, `user_sessions`, `stores`, `pos_terminals`, `tax_rates`, `categories`, `partners`, `items`, `item_barcodes`, `item_normatives`, `store_item_state`, `pos_receipts`, `pos_receipt_items`, `warehouse_documents`, `warehouse_document_items`, `inventory_counts`, `inventory_scans`, `label_templates`.
2. **Sistemski Super-Admin i Slanje Administratorskog Računa Tenantu:**
   - Vlasnik sistema (`SUPER_ADMIN`) kreira novog tenanta, definiše njegovu početnu poslovnu godinu i šalje administratorski račun (`TENANT_ADMIN`) direktno iz Super-Admin konzole.
   - Mogućnost otvaranja novih poslovnih godina (`2025`, `2026`, `2027`...) u istoj bazi sa automatskim prenosom šifarnika i početnog stanja zaliha/cijena.
3. **Sistem Logovanja i Zaboravljena Lozinka:**
   - Prijava pomoću emaila ili korisničkog imena uz odabir aktivne poslovne godine.
   - Kompletan tok **Zaboravljena lozinka** (`POST /api/auth/forgot-password` i `POST /api/auth/reset-password`) pomoću 6-cifrenog sigurnosnog koda sa rokom važenja od 30 minuta.
4. **Glavna Forma (Main Form) sa Pozivanjem Registara i POS Kasom:**
   - Brzi poziv svih registara (`Registar artikala F2`, `Cjenovnici po objektima F3`, `Registar partnera F4`, `Registar objekata i kasa`, `Šabloni deklaracija`), robnih dokumenata (`Ulazne kalkulacije`, `Prelokacije između objekata`, `Nivelacije`) i `POS Kase (F1)`.

## Pokretanje

```bash
npm run db:init
npm test
npm start
```
