---
name: Chakki Manager Architecture
description: Key decisions and conventions for the Kanha Chakki Manager flour-mill business app
---

# Chakki Manager — Architecture Notes

## Stack
- React + Vite artifact at `artifacts/chakki-app`, previewPath `/`
- Express API server at `artifacts/api-server`, for optional multi-device sync only
- localStorage-first — all data works offline; API is supplementary
- Drizzle ORM with PostgreSQL (`lib/db/src/schema/shops.ts` — shopsTable + shopDataTable)

## Business Rates (owner-specified, set as defaults in use-settings.ts)
- Gehu ₹2/kg, Makka ₹3/kg, Dal ₹5/kg, Besan ₹5/kg, Wata ₹2/kg

## Data Keys (localStorage)
- `chakki_records` — billing records array
- `khata_customers` — khata customers array
- `khata_transactions` — khata transactions array
- `chakki_settings` — rate settings object
- `chakki_shop_code` — sync shop code
- `chakki_theme` — "dark" or "light"

## Calculation Precision Rule
All totals: `Math.round(kg * rate * 100) / 100` — never raw multiplication.

## Dark Mode
Toggle adds/removes `.dark` class on `document.documentElement`. Theme applied before React renders in main.tsx to prevent flash.

## ANAJ_OPTIONS (complete list)
`["Gehu", "Makka", "Dal", "Besan", "Wata", "Bajra", "Jowar", "Chawal", "Anya"]`

## Sync Model
- Auto-push on localStorage changes (debounced 3s)
- Auto-pull every 30s
- Full snapshot model (not deltas) — entire dataset replaced on each sync
- API routes: POST /api/shop, GET /api/shop/:code/data, PUT /api/shop/:code/data

## Village Field
Added to KhataCustomer type (`village?` optional string). Shown in customer cards, passed through findOrCreateCustomer().
