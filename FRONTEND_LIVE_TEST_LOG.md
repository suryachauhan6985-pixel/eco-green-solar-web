# FRONTEND LIVE BROWSER TEST LOG

> **Test Execution Mode**: Automated Real-Browser Drive (Google Chrome via Puppeteer-Core)
> **Base URL**: `http://localhost:5000`
> **Date & Time**: 2026-08-25T10:08:29.358Z
> **Total Tabs Tested**: 18
> **Total Interactive Elements Physically Clicked**: 309
> **Browser Engine**: Google Chrome / Windows 11

---

## SUMMARY BY TAB

| Tab Key | Tab Title | Elements Clicked | Status | Verification Summary |
|---|---|---|---|---|
| `#dashboard` | Dashboard | 43 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#bom` | Bill of Material (BOM) | 6 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#purchase` | Purchase Inward | 15 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#sales` | Project Sales & Dispatch | 16 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#masters` | Item & Product Master | 71 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#partyledger` | Party Ledger Statement | 12 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#reports` | Master Inventory Report | 59 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#financialreports` | Trial Balance Statement | 5 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#vouchers` | Payment Voucher (F5) | 7 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#returns` | Sales Return & Damage | 1 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#saleregister` | Sale Register | 8 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#purchaseregister` | Purchase Register | 9 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#lowstock` | Low Stock Alert | 3 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#scansheet` | Serial Number Scan Sheet | 6 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#stockassign` | Stock Allocation & Journal | 9 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#saas_tenants` | SaaS Tenant & White-Label Studio | 8 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#template_designer` | Print Template Designer Studio | 17 | **PASS** | Physical click observed, zero unhandled exceptions |
| `#backup` | Backup & Restore Hub | 14 | **PASS** | Physical click observed, zero unhandled exceptions |

---

## DETAILED ELEMENT-BY-ELEMENT INTERACTION LOG

### TAB: #dashboard (Dashboard)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Cards View | `BUTTON` | None | None | **PASS** |
| 2 | Presentation Mode | `BUTTON` | None | None | **PASS** |
| 3 | BOM & Challan | `BUTTON` | None | GET /masters/items (200) | **PASS** |
| 4 | Inward | `BUTTON` | None | GET /masters/categories (200)<br>GET /challan/category-map (200) | **PASS** |
| 5 | Sales | `BUTTON` | None | GET /bom/kits (200) | **PASS** |
| 6 | Scan Sheets | `BUTTON` | None | None | **PASS** |
| 7 | Customize | `BUTTON` | None | None | **PASS** |
| 8 | Refresh Live Data | `BUTTON` | None | None | **PASS** |
| 9 | Review Low Stock | `A` | None | None | **PASS** |
| 10 | SOLAR PANELS IN STOCK 27 KW 50 Panels • Active Gen Stock | `DIV` | None | None | **PASS** |
| 11 | INVERTERS READY 0 Units Single & 3-Phase Inverters | `DIV` | None | None | **PASS** |
| 12 | BATTERY SYSTEMS 0 Units Li-Ion & Solar Batteries | `DIV` | None | None | **PASS** |
| 13 | REGISTERED MASTER CATALOG 68 SKUs Active Products & Categori | `DIV` | None | None | **PASS** |
| 14 | AVAILABLE STOCK All Godown Inventory 1 / 2 50 NOS Total All  | `DIV` | None | None | **PASS** |
| 15 | 1 / 2 | `DIV` | None | None | **PASS** |
| 16 | Previous Category | `BUTTON` | None | None | **PASS** |
| 17 | Next Category | `BUTTON` | None | None | **PASS** |
| 18 | View Report | `SPAN` | None | None | **PASS** |
| 19 | ASSIGNED STOCK Allocated to Projects 1 / 2 0 NOS Total All S | `DIV` | None | None | **PASS** |
| 20 | 1 / 2 | `DIV` | None | None | **PASS** |
| 21 | Previous Category | `BUTTON` | None | None | **PASS** |
| 22 | Next Category | `BUTTON` | None | None | **PASS** |
| 23 | View Register | `SPAN` | None | None | **PASS** |
| 24 | TOTAL DISPATCHED Delivered to Clients 1 / 2 0 NOS Total All  | `DIV` | None | None | **PASS** |
| 25 | 1 / 2 | `DIV` | None | None | **PASS** |
| 26 | Previous Category | `BUTTON` | None | None | **PASS** |
| 27 | Next Category | `BUTTON` | None | None | **PASS** |
| 28 | View Register | `SPAN` | None | None | **PASS** |
| 29 | DAMAGED / RMA Quality & Inspection 1 / 2 0 NOS Total All Sto | `DIV` | None | None | **PASS** |
| 30 | 1 / 2 | `DIV` | None | None | **PASS** |
| 31 | Previous Category | `BUTTON` | None | None | **PASS** |
| 32 | Next Category | `BUTTON` | None | None | **PASS** |
| 33 | View Returns | `SPAN` | None | None | **PASS** |
| 34 | INWARD RECEIVED (TODAY) 0 Nos 0 Inward Invoices | `DIV` | None | None | **PASS** |
| 35 | DISPATCHED TO PROJECTS 0 Nos 0 Delivery Challans | `DIV` | None | None | **PASS** |
| 36 | BOM & PROJECT CHALLANS 1 Challans Active Site Dispatches | `DIV` | None | None | **PASS** |
| 37 | ACTIVE GODOWNS 1 Hubs Multi-Godown Live Sync | `DIV` | None | None | **PASS** |
| 38 | All Categories | `BUTTON` | None | None | **PASS** |
| 39 | Solar Panels | `BUTTON` | None | POST /auth/heartbeat (200) | **PASS** |
| 40 | Inverters | `BUTTON` | None | None | **PASS** |
| 41 | Structures | `BUTTON` | None | None | **PASS** |
| 42 | Civil & BOS | `BUTTON` | None | None | **PASS** |
| 43 | View in Master Reports | `BUTTON` | None | None | **PASS** |

### TAB: #bom (Bill of Material (BOM))

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Back (Esc) | `BUTTON` | None | None | **PASS** |
| 2 | Print BOM | `BUTTON` | None | GET /bom/orders?status=Open (200) | **PASS** |
| 3 | Generate BOM | `BUTTON` | None | None | **PASS** |
| 4 | Track BOM | `BUTTON` | None | None | **PASS** |
| 5 | New Kit | `BUTTON` | None | None | **PASS** |
| 6 | Tick All | `BUTTON` | None | None | **PASS** |

### TAB: #purchase (Purchase Inward)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Add Attachment | `BUTTON` | None | None | **PASS** |
| 2 | Clear All | `BUTTON` | None | None | **PASS** |
| 3 | Add Product Line | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 4 | Inward from BOM Kit | `BUTTON` | None | GET /bom/kits (304) | **PASS** |
| 5 | Remove Line | `BUTTON` | None | None | **PASS** |
| 6 | Execute Stock Inward | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 7 | Clear Form | `BUTTON` | None | None | **PASS** |
| 8 | Find | `BUTTON` | Modal: "Search Required" | None | **PASS** |
| 9 | Add Attachment | `BUTTON` | None | None | **PASS** |
| 10 | Keep Existing | `BUTTON` | None | None | **PASS** |
| 11 | Add Line | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 12 | Remove Line | `BUTTON` | None | None | **PASS** |
| 13 | Apply Modifications | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 14 | Clear Changes | `BUTTON` | None | None | **PASS** |
| 15 | Delete Invoice | `BUTTON` | None | None | **PASS** |

### TAB: #sales (Project Sales & Dispatch)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Add Attachment | `BUTTON` | None | None | **PASS** |
| 2 | Clear All | `BUTTON` | None | None | **PASS** |
| 3 | Add Product Line | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 4 | Remove Line | `BUTTON` | None | None | **PASS** |
| 5 | Confirm Dispatch | `BUTTON` | Modal: "Missing Fields" | None | **PASS** |
| 6 | Create Challan | `BUTTON` | Modal: "Customer Name Required" | None | **PASS** |
| 7 | Challan Register | `BUTTON` | Modal: "Saved Challan Register" | GET /challan (200) | **PASS** |
| 8 | Clear Form | `BUTTON` | None | GET /sales/types?category=BATTERY&brand=LUMIOUS&watt=10 (304) | **PASS** |
| 9 | Find | `BUTTON` | Modal: "Search Required" | None | **PASS** |
| 10 | Add Attachment | `BUTTON` | None | None | **PASS** |
| 11 | Keep Existing | `BUTTON` | None | None | **PASS** |
| 12 | Add Line | `BUTTON` | Modal: "Line Error" | None | **PASS** |
| 13 | Remove Line | `BUTTON` | None | POST /auth/heartbeat (200) | **PASS** |
| 14 | Apply Modifications | `BUTTON` | Modal: "Not Found" | None | **PASS** |
| 15 | Clear Changes | `BUTTON` | None | None | **PASS** |
| 16 | Delete Transaction | `BUTTON` | None | None | **PASS** |

### TAB: #masters (Item & Product Master)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Save Product Profile | `BUTTON` | Modal: "Validation Warning" | None | **PASS** |
| 2 | Upload Excel | `BUTTON` | None | None | **PASS** |
| 3 | Download Template | `BUTTON` | None | None | **PASS** |
| 4 | Delete item | `BUTTON` | None | None | **PASS** |
| 5 | Delete item | `BUTTON` | None | None | **PASS** |
| 6 | Delete item | `BUTTON` | None | None | **PASS** |
| 7 | Delete item | `BUTTON` | None | None | **PASS** |
| 8 | Delete item | `BUTTON` | None | None | **PASS** |
| 9 | Delete item | `BUTTON` | None | None | **PASS** |
| 10 | Delete item | `BUTTON` | None | None | **PASS** |
| 11 | Delete item | `BUTTON` | None | None | **PASS** |
| 12 | Delete item | `BUTTON` | None | None | **PASS** |
| 13 | Delete item | `BUTTON` | None | None | **PASS** |
| 14 | Delete item | `BUTTON` | None | None | **PASS** |
| 15 | Delete item | `BUTTON` | None | None | **PASS** |
| 16 | Delete item | `BUTTON` | None | None | **PASS** |
| 17 | Delete item | `BUTTON` | None | None | **PASS** |
| 18 | Delete item | `BUTTON` | None | None | **PASS** |
| 19 | Delete item | `BUTTON` | None | None | **PASS** |
| 20 | Delete item | `BUTTON` | None | None | **PASS** |
| 21 | Delete item | `BUTTON` | None | None | **PASS** |
| 22 | Delete item | `BUTTON` | None | None | **PASS** |
| 23 | Delete item | `BUTTON` | None | None | **PASS** |
| 24 | Delete item | `BUTTON` | None | None | **PASS** |
| 25 | Delete item | `BUTTON` | None | None | **PASS** |
| 26 | Delete item | `BUTTON` | None | None | **PASS** |
| 27 | Delete item | `BUTTON` | None | None | **PASS** |
| 28 | Delete item | `BUTTON` | None | None | **PASS** |
| 29 | Delete item | `BUTTON` | None | None | **PASS** |
| 30 | Delete item | `BUTTON` | None | None | **PASS** |
| 31 | Delete item | `BUTTON` | None | None | **PASS** |
| 32 | Delete item | `BUTTON` | None | None | **PASS** |
| 33 | Delete item | `BUTTON` | None | None | **PASS** |
| 34 | Delete item | `BUTTON` | None | None | **PASS** |
| 35 | Delete item | `BUTTON` | None | None | **PASS** |
| 36 | Delete item | `BUTTON` | None | None | **PASS** |
| 37 | Delete item | `BUTTON` | None | None | **PASS** |
| 38 | Delete item | `BUTTON` | None | None | **PASS** |
| 39 | Delete item | `BUTTON` | None | None | **PASS** |
| 40 | Delete item | `BUTTON` | None | None | **PASS** |
| 41 | Delete item | `BUTTON` | None | POST /auth/heartbeat (200) | **PASS** |
| 42 | Delete item | `BUTTON` | None | None | **PASS** |
| 43 | Delete item | `BUTTON` | None | None | **PASS** |
| 44 | Delete item | `BUTTON` | None | None | **PASS** |
| 45 | Delete item | `BUTTON` | None | None | **PASS** |
| 46 | Delete item | `BUTTON` | None | None | **PASS** |
| 47 | Delete item | `BUTTON` | None | None | **PASS** |
| 48 | Delete item | `BUTTON` | None | None | **PASS** |
| 49 | Delete item | `BUTTON` | None | None | **PASS** |
| 50 | Delete item | `BUTTON` | None | None | **PASS** |
| 51 | Delete item | `BUTTON` | None | None | **PASS** |
| 52 | Delete item | `BUTTON` | None | None | **PASS** |
| 53 | Delete item | `BUTTON` | None | None | **PASS** |
| 54 | Delete item | `BUTTON` | None | None | **PASS** |
| 55 | Delete item | `BUTTON` | None | None | **PASS** |
| 56 | Delete item | `BUTTON` | None | None | **PASS** |
| 57 | Delete item | `BUTTON` | None | None | **PASS** |
| 58 | Delete item | `BUTTON` | None | None | **PASS** |
| 59 | Delete item | `BUTTON` | None | None | **PASS** |
| 60 | Delete item | `BUTTON` | None | None | **PASS** |
| 61 | Delete item | `BUTTON` | None | None | **PASS** |
| 62 | Delete item | `BUTTON` | None | None | **PASS** |
| 63 | Delete item | `BUTTON` | None | None | **PASS** |
| 64 | Delete item | `BUTTON` | None | None | **PASS** |
| 65 | Delete item | `BUTTON` | None | None | **PASS** |
| 66 | Delete item | `BUTTON` | None | None | **PASS** |
| 67 | Delete item | `BUTTON` | None | None | **PASS** |
| 68 | Delete item | `BUTTON` | None | None | **PASS** |
| 69 | Delete item | `BUTTON` | None | None | **PASS** |
| 70 | Delete item | `BUTTON` | None | None | **PASS** |
| 71 | Delete item | `BUTTON` | None | None | **PASS** |

### TAB: #partyledger (Party Ledger Statement)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Refresh | `BUTTON` | None | None | **PASS** |
| 2 | Statement | `BUTTON` | None | None | **PASS** |
| 3 | Statement | `BUTTON` | None | GET /ledgers/statement?name=ASIYANI+JITENDRABHAI+PARSOTAMBHAI&type=Customer (200) | **PASS** |
| 4 | Statement | `BUTTON` | None | GET /ledgers/statement?name=Dhwarkesh+Solar+Projects+LLP&type=Supplier (200) | **PASS** |
| 5 | Statement | `BUTTON` | None | GET /ledgers/statement?name=JAY+AMBE+SOLAR+LLP&type=Supplier (200) | **PASS** |
| 6 | Statement | `BUTTON` | None | None | **PASS** |
| 7 | Statement | `BUTTON` | None | GET /ledgers/statement?name=JHAPADA+GABHRUBHAI+BHIKHABHAI&type=Customer (200)<br>GET /ledgers/statement?name=KHAKHI+YASIN+SALIMBHAI&type=Customer (200) | **PASS** |
| 8 | Statement | `BUTTON` | None | GET /ledgers/statement?name=Nisar+Power+-+Morbi&type=Dealer (200) | **PASS** |
| 9 | Statement | `BUTTON` | None | GET /ledgers/statement?name=PATEL+RASIKBHAI+NATHABHAI&type=Customer (200) | **PASS** |
| 10 | Statement | `BUTTON` | None | GET /ledgers/statement?name=SUMIT+CHAUHAN&type=Customer (200) | **PASS** |
| 11 | Statement | `BUTTON` | None | GET /ledgers/statement?name=UNADKAT+CHIRAGBHAI+AMULAKHBHAI&type=Customer (200) | **PASS** |
| 12 | Open Statement | `BUTTON` | None | None | **PASS** |

### TAB: #reports (Master Inventory Report)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | All Inventory | `DIV` | None | None | **PASS** |
| 2 | Available In-Stock | `DIV` | None | None | **PASS** |
| 3 | Assigned / In-Transit | `DIV` | None | GET /reports/master (304) | **PASS** |
| 4 | Sold Out | `DIV` | None | None | **PASS** |
| 5 | Damaged / RMA | `DIV` | None | None | **PASS** |
| 6 | Save View | `BUTTON` | None | None | **PASS** |
| 7 | Clear Filters | `BUTTON` | None | None | **PASS** |
| 8 | Refresh | `BUTTON` | None | GET /reports/master (304) | **PASS** |
| 9 | Export | `BUTTON` | None | None | **PASS** |
| 10 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 11 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 12 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 13 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 14 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 15 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 16 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 17 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 18 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 19 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 20 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 21 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 22 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 23 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 24 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 25 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 26 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 27 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 28 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 29 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 30 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 31 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 32 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 33 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 34 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 35 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 36 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 37 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 38 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 39 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 40 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 41 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 42 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 43 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 44 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 45 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 46 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 47 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 48 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 49 | event.stopPropagation() | `TD` | None | POST /auth/heartbeat (200) | **PASS** |
| 50 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 51 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 52 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 53 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 54 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 55 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 56 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 57 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 58 | event.stopPropagation() | `TD` | None | None | **PASS** |
| 59 | event.stopPropagation() | `TD` | None | None | **PASS** |

### TAB: #financialreports (Trial Balance Statement)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Trial Balance | `BUTTON` | None | None | **PASS** |
| 2 | Profit & Loss A/c | `BUTTON` | None | None | **PASS** |
| 3 | Balance Sheet | `BUTTON` | None | None | **PASS** |
| 4 | Day Book | `BUTTON` | None | None | **PASS** |
| 5 | Refresh Statements | `BUTTON` | None | GET /financial/statements (304) | **PASS** |

### TAB: #vouchers (Payment Voucher (F5))

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Payment (F5) | `BUTTON` | None | GET /vouchers?type=Payment (304) | **PASS** |
| 2 | Receipt (F6) | `BUTTON` | None | GET /vouchers?type=Receipt (200) | **PASS** |
| 3 | Journal (F7) | `BUTTON` | None | GET /vouchers?type=Journal (200) | **PASS** |
| 4 | Debit Note (Alt+F5) | `BUTTON` | None | GET /vouchers?type=DebitNote (200) | **PASS** |
| 5 | Credit Note (Alt+F6) | `BUTTON` | None | GET /vouchers?type=CreditNote (200) | **PASS** |
| 6 | Reset | `BUTTON` | None | None | **PASS** |
| 7 | Post Voucher | `BUTTON` | None | None | **PASS** |

### TAB: #returns (Sales Return & Damage)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Execute Stock Adjustment | `BUTTON` | None | None | **PASS** |

### TAB: #saleregister (Sale Register)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | All Dispatches | `DIV` | None | None | **PASS** |
| 2 | Today's Dispatches | `DIV` | None | None | **PASS** |
| 3 | Solar Panels | `DIV` | Modal: "No Records" | None | **PASS** |
| 4 | Inverters | `DIV` | None | GET /sales/register (304) | **PASS** |
| 5 | Save View | `BUTTON` | None | None | **PASS** |
| 6 | Clear Column Filters | `BUTTON` | None | None | **PASS** |
| 7 | Export | `BUTTON` | Modal: "No Records" | None | **PASS** |
| 8 | Refresh | `BUTTON` | None | GET /sales/register (304) | **PASS** |

### TAB: #purchaseregister (Purchase Register)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | All Inwards | `DIV` | None | None | **PASS** |
| 2 | Today's Inward | `DIV` | None | None | **PASS** |
| 3 | Solar Panels | `DIV` | None | None | **PASS** |
| 4 | Inverters | `DIV` | None | GET /purchase/register (304) | **PASS** |
| 5 | Save View | `BUTTON` | None | None | **PASS** |
| 6 | Clear Column Filters | `BUTTON` | None | None | **PASS** |
| 7 | Export | `BUTTON` | None | None | **PASS** |
| 8 | Refresh | `BUTTON` | None | GET /purchase/register (304) | **PASS** |
| 9 | event.stopPropagation() | `TD` | None | None | **PASS** |

### TAB: #lowstock (Low Stock Alert)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Clear Filters | `BUTTON` | None | None | **PASS** |
| 2 | Export | `BUTTON` | None | None | **PASS** |
| 3 | Refresh | `BUTTON` | None | GET /lowstock (200) | **PASS** |

### TAB: #scansheet (Serial Number Scan Sheet)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Sheets | `BUTTON` | None | None | **PASS** |
| 2 | Enterprise | `BUTTON` | None | None | **PASS** |
| 3 | Files | `BUTTON` | None | None | **PASS** |
| 4 | Create New Sheet | `BUTTON` | Modal: "Create New Sheet" | None | **PASS** |
| 5 | Create new sheet | `BUTTON` | Modal: "Create New Sheet" | None | **PASS** |
| 6 | Go Pro+ | `BUTTON` | None | None | **PASS** |

### TAB: #stockassign (Stock Allocation & Journal)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Add Attachment | `BUTTON` | None | None | **PASS** |
| 2 | Clear All | `BUTTON` | None | None | **PASS** |
| 3 | Add Product Line | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 4 | Remove Line | `BUTTON` | None | None | **PASS** |
| 5 | Reserve / Assign Stock | `BUTTON` | Modal: "Validation Error" | None | **PASS** |
| 6 | Clear Form | `BUTTON` | None | GET /stockassign/available?category=BATTERY&brand=LUMIOUS&watt=10&type=LI-ION (304) | **PASS** |
| 7 | Refresh | `BUTTON` | None | GET /sales/types?category=BATTERY&brand=LUMIOUS&watt=10 (304)<br>GET /stockassign/available?category=BATTERY&brand=LUMIOUS&watt=10&type=LI-ION (304) | **PASS** |
| 8 | Release to Firm | `BUTTON` | Modal: "Nothing Loaded" | None | **PASS** |
| 9 | Release to Customer | `BUTTON` | None | None | **PASS** |

### TAB: #saas_tenants (SaaS Tenant & White-Label Studio)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Refresh | `BUTTON` | None | GET /saas/tenants (304) | **PASS** |
| 2 | Register New Tenant | `BUTTON` | Modal: "✨ Register New Tenant Organization" | None | **PASS** |
| 3 | TOTAL ORGANIZATIONS 1 | `DIV` | None | GET /public/tenant-branding (304) | **PASS** |
| 4 | ACTIVE SAAS WORKSPACES 1 | `DIV` | None | None | **PASS** |
| 5 | TOTAL TENANT USERS 6 | `DIV` | None | GET /saas/tenants/00000000-0000-0000-0000-000000000001 (200) | **PASS** |
| 6 | STORAGE ALLOCATION 4.9 GB | `DIV` | None | POST /auth/heartbeat (200) | **PASS** |
| 7 | Active Workspace | `BUTTON` | None | GET /public/tenant-branding (304) | **PASS** |
| 8 | Edit | `BUTTON` | None | None | **PASS** |

### TAB: #template_designer (Print Template Designer Studio)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | + Blank Template | `BUTTON` | Modal: "⚙️ White-Label Studio: Eco Green Solar" | None | **PASS** |
| 2 | Clone | `BUTTON` | None | None | **PASS** |
| 3 | Export | `BUTTON` | None | None | **PASS** |
| 4 | Import | `BUTTON` | None | None | **PASS** |
| 5 | Set Default | `BUTTON` | None | None | **PASS** |
| 6 | Save Layout | `BUTTON` | None | None | **PASS** |
| 7 | Test Print | `BUTTON` | None | None | **PASS** |
| 8 | Canvas | `BUTTON` | None | None | **PASS** |
| 9 | Columns | `BUTTON` | None | None | **PASS** |
| 10 | Typography | `BUTTON` | None | None | **PASS** |
| 11 | Media & Uploads | `BUTTON` | None | None | **PASS** |
| 12 | Watermark | `BUTTON` | None | None | **PASS** |
| 13 | Page-Fit | `BUTTON` | None | None | **PASS** |
| 14 | Portrait | `BUTTON` | None | None | **PASS** |
| 15 | Landscape | `BUTTON` | None | None | **PASS** |
| 16 | Fit | `BUTTON` | None | None | **PASS** |
| 17 | 100% | `BUTTON` | None | None | **PASS** |

### TAB: #backup (Backup & Restore Hub)

| # | Element Name / Label | Tag | Modal Observed | Network Traffic | Result |
|---|---|---|---|---|---|
| 1 | Download Latest Backup | `BUTTON` | None | None | **PASS** |
| 2 | Backup Now (Force) | `BUTTON` | None | None | **PASS** |
| 3 | Download | `BUTTON` | None | None | **PASS** |
| 4 | Download | `BUTTON` | None | POST /backup/run (200) | **PASS** |
| 5 | Download | `BUTTON` | None | GET /backup/status (200) | **PASS** |
| 6 | Download | `BUTTON` | None | None | **PASS** |
| 7 | Download | `BUTTON` | None | None | **PASS** |
| 8 | Download | `BUTTON` | None | None | **PASS** |
| 9 | Download | `BUTTON` | None | None | **PASS** |
| 10 | Download | `BUTTON` | None | None | **PASS** |
| 11 | Download | `BUTTON` | None | None | **PASS** |
| 12 | Download | `BUTTON` | None | None | **PASS** |
| 13 | Download | `BUTTON` | None | None | **PASS** |
| 14 | Download | `BUTTON` | None | None | **PASS** |

