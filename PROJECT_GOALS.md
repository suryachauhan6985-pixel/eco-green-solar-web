# eco-green-solar-web — Project Goals Tracker

> Yeh file project ke pending goals/requirements track karne ke liye hai.
> Jab bhi yeh file (ya isme se koi specific goal) dena, hum us goal ko
> **step-by-step** implement karenge — related files identify karke,
> ek-ek karke code update karenge jab tak goal fully achieve na ho jaye.

**Project:** eco-green-solar-web (Node.js + Express + MySQL)
**Status legend:** 🔴 Pending | 🟡 In Progress | 🟢 Done

---

## Goal 1 — Item Registration Panel: Dynamic Fields + Subtype Display
**Status:** 🟡 In Progress
**Related files:** `js/pages/masters.js`, `api/routes/masters.js`

- **Problem:**
  - Item registration form mein fields auto hide/show nahi hoti.
  - Agar wattage kisi item/category ke liye mandatory nahi hai, tab bhi wattage field dikhti hai.
  - Item registration panel mein subtype field dikhta hi nahi hai.
- **Expected behavior:**
  - Category select karte hi backend rule check ho (`syncWattMandatoryUI()` jaisa logic already partially exists — use/extend karna hai) — agar wattage mandatory nahi to field hide ho.
  - Subtype field panel mein visible ho aur category ke hisaab se subtypes load ho (`loadSubtypesForCategory(cat)` already exists — UI mein wire karna hai).
- **Acceptance criteria:** Item add/edit karte waqt sirf relevant fields dikhein; subtype dropdown category ke hisaab se populate ho aur save ho.

---

## Goal 2 — Purchase Inward + Sales: Conditional Serial No. Box
**Status:** 🟢 Done
**Related files:** `js/pages/purchase.js`, `js/pages/sales.js` (add + edit sections dono)

- **Problem:** Jis item ke liye serial no. mandatory nahi hai, uske liye bhi serial no. box dikhta hai.
- **Expected behavior:**
  - Sirf un items ke liye serial no. box dikhe jinke liye serial mandatory hai (rule already backend mein hai — `isWattMandatory`/serial-rule jaisa concept sales.js mein hai, purchase.js mein bhi laana hai).
  - Non-mandatory items ke liye box hidden rahe (sirf quantity input dikhe).
  - Same rule **Add** aur **Edit** dono sections mein apply ho — Purchase aur Sales dono modules mein.
- **Acceptance criteria:** Serial-mandatory item → serial box visible; non-mandatory item → serial box hidden, quantity field kaam kare — Purchase Add/Edit + Sales Add/Edit sab jagah consistent.

---

## Goal 3 — Dual Item Type Support: Serial-based AND Quantity-based
**Status:** 🟢 Done
**Related files:** `js/pages/purchase.js`, `js/pages/sales.js`, `js/pages/stockassign.js`, `api/services/stockHelpers.js`, `api/db/schema.js`

- **Problem:** Pura system abhi sirf serial-no.-based items ke liye design hai.
- **Expected behavior:** System dono type ke items handle kare:
  1. **Serial-based** (jaise abhi hai)
  2. **Quantity-based** (bina serial ke, sirf quantity track ho)
- Purchase, Sales, Stock Assign, Reports, Returns — sabhi modules mein dono types smoothly kaam karein.
- **Acceptance criteria:** Quantity-based item ko purchase/sale/assign/return karne par system serial na maange, sirf quantity se stock update ho; serial-based items ka existing flow break na ho.

---

## Goal 4 — Return/Damage Section: Conditional Serial No.
**Status:** 🟢 Done
**Related files:** `js/pages/returns.js` (aur related return/damage API routes)

- **Problem:** Return/damage section mein quantity return karte waqt serial no. dalna mandatory hai — chahe item ke liye serial mandatory ho ya na ho.
- **Expected behavior:**
  - Jis item ke liye serial mandatory hai — uske liye serial no. box appear ho.
  - Jis item ke liye serial mandatory nahi hai — sirf quantity daal ke Return ya Damaged mark ho sake, serial box na dikhe.
- **Acceptance criteria:** Return/Damage flow Goal 2/3 ke serial-rule ke saath consistent ho.

---

## Goal 5 — BOM Section: Partial Dispatch + Pending BOM Tracking
**Status:** 🔴 Pending
**Related files:** `js/pages/bom.js`, `api/routes/challan.js`, `api/services/challanPdf.js`

- **Problem:**
  - BOM mein partial dispatch ka option nahi hai (poora BOM ek saath hi dispatch hota hai).
  - Pending items ko track/track-back karne ka koi tab/register nahi hai.
- **Expected behavior:**
  - BOM se items **partially dispatch** ho sake (kuch items abhi, baaki baad mein).
  - Ek naya tab/section — **"Pending BOMs"** ya **"BOM Register"** — jaha:
    - Saare BOMs jinke items pending hain, track ho.
    - Un pending items ko baad mein select karke dispatch kiya ja sake.
- **Acceptance criteria:** Ek BOM ko multiple dispatch entries mein split kiya ja sake; pending quantity/items register mein sahi dikhein aur dobara dispatch ho sake bina duplicate/error ke.

---

## Goal 6 — Challan Template (Excel-based) — Row Count Mismatch
**Status:** 🔴 Pending
**Related files:** `api/services/challanPdf.js`, related challan template/excel file

- **Problem:**
  - Abhi sirf BOM ka hi print template ready hai.
  - Challan ke liye Excel se template liya gaya hai jisme **22 rows** hain, lekin challan entry section mein sirf **13 rows** hain — mismatch hai.
- **Expected behavior:**
  - Challan ke liye bhi proper template ready ho (jaise BOM ka hai).
  - Template rows (22) aur entry section rows (13) ka count match ho — ya to template ko 13 rows tak adjust karo, ya entry section ko 22 rows support karne layak banao (jo bhi correct business requirement ho, confirm karke implement karenge).
- **Acceptance criteria:** Challan print/PDF output mein rows sahi count mein aayein, data cut/mismatch na ho.

---

## Goal 7 — BOM User Activity Tracking (Audit Trail)
**Status:** 🔴 Pending
**Related files:** `js/pages/bom.js`, `api/routes/challan.js`, `api/db/schema.js` (naya audit table chahiye ho sakta hai)

- **Problem:** Abhi track nahi hota kisne BOM create/edit kiya, kisne kitne items verify kiye, kab kisne verify kiya.
- **Expected behavior:** Per-user, per-BOM audit log:
  - Created by (user + timestamp)
  - Edited by (user + timestamp, har edit ka)
  - Verified items — kitne items, kis user ne, kab verify kiye (item-level bhi track ho)
- **Acceptance criteria:** BOM detail view mein ek "Activity/History" section dikhe jisme yeh sab log visible ho, user-wise filter/report bhi nikal sake.

---

## Goal 8 — Multi-Device Login Support (Remove Single-Device Restriction)
**Status:** 🔴 Pending
**Related files:** `api/middleware/auth.js`, `api/routes/auth.js`, session/JWT handling logic

- **Problem:** Abhi ek user ek time par sirf ek hi device mein login kar sakta hai.
- **Expected behavior:** Instagram jaisa — ek user same time par multiple devices/sessions se login kar sake, koi restriction na ho.
- **Acceptance criteria:** Same user account do/teen alag devices/browsers se ek saath login kare bina kisi session force-logout ke; existing security (JWT/OTP) flow break na ho.

---

## Goal 9 — Real Camera + BT Scanner for Serial No. Boxes (BOM, Sales, Purchase)
**Status:** 🔴 Pending
**Related files:** `js/pages/bom.js`, `js/pages/sales.js`, `js/pages/purchase.js`, `js/pages/scansheet.js` (reference/reuse existing scan engine), `api/routes/backup.js`, `api/services/stockHelpers.js`

- **Problem:** BOM ke serial no. box mein scan button abhi dummy hai — kaam nahi karta.
- **Expected behavior:**
  1. **Two scan modes** (jaise `scansheet.js` mein already implemented hai — reuse karna hai):
     - **Camera scan** (QR/barcode scanner via camera)
     - **BT (Bluetooth) scanner** — ek toggle ON/OFF hoga; jab BT toggle ON ho, scan karte hi serial no. seedha box mein aa jaye aur apne aap next new line par cursor/entry move ho jaye (auto-advance, jaise scansheet mein hota hai).
  2. **Duplicate scan check:** Ek hi serial no. turant do baar scan na ho paye (turant duplicate scan block ho) — same jaise scansheet mein duplicate scan check hai.
  3. **Stock validation (Sales ke liye):** Scan kiya hua serial no. database/stock mein exist karta ho tabhi sale ho — agar serial stock mein hai hi nahi, to warning dikhe ("Yeh serial no. stock mein maujood nahi hai") aur sale block ho.
  4. **Excel export + backup:**
     - Jab sale complete ho jaye, scan kiye gaye saare serial no. ki ek **Excel file** banegi — usi tarah jaise abhi scansheet mein Excel banti hai.
     - Yeh Excel file backup wale location/folder mein save ho (jaha baaki backups jaate hain).
     - Folder ka naam — BOM mein jo **Order No.** hai, usi se banega.
  5. **Scope:** Yeh scanner feature — camera + BT dono — **BOM.js**, **sales.js**, aur **purchase.js** teeno mein kaam kare (consistent behavior).
  6. **Excel save ka tarika:** Feature implement karte waqt Excel save/format ka tarika thoda change hoga (existing scansheet Excel logic se derive karke naya format banayenge, order-no-wise folder ke hisaab se) — implementation ke time discuss/finalize karenge.
- **Acceptance criteria:**
  - BOM/Sales/Purchase teeno mein serial box par scan icon click karne se camera scanner khule; BT toggle ON karne par bluetooth scan seedha field mein aaye + auto-advance next line.
  - Ek hi serial no. turant dobara scan hone par duplicate warning aaye, dobara add na ho.
  - Sales mein scan hone par serial ka stock-existence check ho, na ho to warning + block.
  - Sale complete hone par order-no-named folder mein Excel backup save ho.

---

## Goal 10 — Settings Tab: Show/Hide Scansheet Tab
**Status:** 🔴 Pending
**Related files:** `js/app.js` (nav/menu rendering), naya `js/pages/settings.js` (page banani hogi), `index.html`, `api/routes/masters.js` ya naya settings route/table

- **Problem:** Abhi Settings jaisa koi tab nahi hai. Logout waghera jaha se hota hai, waha se hi Settings mein jaane ka option chahiye.
- **Expected behavior:**
  - Jaha abhi Logout option/menu hai, wahi se ek **"Settings"** option milega.
  - Settings page/tab khulega jisme toggle hoga: **Scansheet tab Hide/Unhide** — ON/OFF karne se main navigation mein Scansheet tab dikhna/chupna control hoga.
- **Acceptance criteria:** Settings se Scansheet tab hide karne par woh nav menu se gayab ho jaye; unhide karne par wapas dikhe. Setting persist ho (refresh/relogin ke baad bhi yaad rahe — per-user ya global, yeh implementation ke time confirm karenge).

---

## Goal 11 — Excel Upload se Bulk Item Creation (Masters)
**Status:** 🔴 Pending
**Related files:** `js/pages/masters.js`, `api/routes/masters.js`, (reference: Party Ledger ka existing Excel-upload-based creation flow — same pattern reuse karna hai)

- **Problem:** Abhi items sirf ek-ek karke manually create ho sakte hain. Party Ledger module mein jaisa Excel-upload-se-bulk-creation feature hai, waisa hi Items ke liye nahi hai.
- **Expected behavior:**
  - Item Registration panel mein ek **"Upload Excel"** option ho (jaise Party Ledger mein hai).
  - Ek **downloadable Excel template** provide ho jisme columns already defined ho: Item Name, Category, Subtype, Wattage (agar mandatory ho), Serial Mandatory (Yes/No), aur baaki required master fields.
  - Excel upload hone par backend row-by-row validate kare:
    - Category valid ho, uske hisaab se Subtype valid ho (Goal 1 ke subtype-load logic se consistent).
    - Wattage sirf tab mandatory treat ho jab category/item ke rule ke hisaab se mandatory ho (Goal 1 ki `syncWattMandatoryUI()` / mandatory-rule logic backend side bhi honi chahiye).
    - Serial-mandatory flag correctly set ho (Goal 3 ke dual item-type support — serial-based vs quantity-based — ke saath consistent).
  - Bulk import ke baad ek summary dikhe: kitne items successfully create hue, kitni rows mein error aaya (row number + reason ke saath), taaki user fix karke dobara try kar sake.
  - Duplicate item (same name/category) detect ho aur skip/flag ho, duplicate na bane.
- **Acceptance criteria:** User Excel template download kare → fill kare → upload kare → sabhi valid rows se items automatically create ho jayein (sahi category/subtype/wattage-mandatory/serial-mandatory ke saath), invalid rows clearly reported hon, koi duplicate na bane. Behavior Party Ledger ke existing Excel-upload flow jaisa consistent/familiar ho.

---

## Suggestions (Optional — add/discuss before implementing)
Kuch cheezein jo scan ke known-issues mein already flag hui thi, aur goals ke sath related hain — agar chaho to inhe bhi list mein add kar sakte hain:

- Route-level auth middleware missing hai (APIs abhi public dikh rahe) — security ke liye zaroori review.
- Raw SQL strings 35+ files mein hain — parameterized queries confirm karna (SQL injection risk).
- High-complexity files (`app.js`, `bom.js`, `dashboard.js`, `masters.js`, `partyledger.js`, `purchase.js`, `sales.js`, `scansheet.js`, `stockassign.js`, `challanPdf.js`) — inhe chhote modules mein split karna, taaki upar wale goals implement karte waqt maintain karna aasan rahe.

---

## Kaise use karein
1. Jab bhi kaam shuru karna ho, is file ko (ya kisi ek Goal number ko) mujhe do.
2. Main us goal ke related files check karunga, current code dekhunga, aur step-by-step changes propose/implement karunga.
3. Har step ke baad status update karte jayenge (🔴 → 🟡 → 🟢) isi file mein.
