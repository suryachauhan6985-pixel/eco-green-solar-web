# File Summaries

Deep analysis of every important source file.

## `Dockerfile`

- **Purpose:** Supporting source file.
- **Lines of code:** 30
- **Complexity:** Low (heuristic score: 2)
- **Imports:** None
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.

---

## `package.json`

- **Purpose:** Supporting source file.
- **Lines of code:** 18
- **Complexity:** Low (heuristic score: 0)
- **Imports:** None
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `sw.js`

- **Purpose:** Supporting source file.
- **Lines of code:** 93
- **Complexity:** Low (heuristic score: 5)
- **Imports:** None
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None
- **Potential improvements:**
  - No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.

---

## `js/app.js`

- **Purpose:** Application entry point / bootstrap file.
- **Lines of code:** 1413
- **Complexity:** High (heuristic score: 254)
- **Imports:** None
- **Exports:** None
- **Functions:** showLoader(), hideLoader(), applyGlobalTableSearch(query), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), updateProfileDisplay(username, role), showApp(), saveSession(username, role, persist, token), loadSession(), clearSession(), startHeartbeat(), stopHeartbeat(), resetIdleTimer(), stopIdleTimer(), notifyServerLogout(), showLoginOverlay(message), buildLoginOverlay(), showCredsStep(), showOtpStep(maskedEmail), hideAllSteps(), showRegisterStep(), showRegisterOtpStep(maskedEmail), showForgotStep(), showResetStep(maskedEmail), finishLogin(data), attemptLogin(), attemptVerifyOtp(), attemptResendOtp(), attemptRegister(), attemptVerifyRegisterOtp(), attemptResendRegisterOtp(), attemptForgotPassword(), attemptResendForgotOtp(), attemptResetPassword(), closeProfileMenu(), endSessionAndShowLogin(), openProfileMenu(), go(id), closeConfirmDialog(result), guardField(el), guardAllFields(root), getRows(), cellValue(row, idx), uniqueValues(idx), itemCbs(), ping()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (3 statement keywords: SELECT, JOIN, UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/backup.js`

- **Purpose:** Defines 3 function(s) implementing supporting logic.
- **Lines of code:** 131
- **Complexity:** Low (heuristic score: 15)
- **Imports:** None
- **Exports:** None
- **Functions:** downloadBackup(fileName), refreshStatus(), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/bom.js`

- **Purpose:** Defines 1 class(es) implementing core logic.
- **Lines of code:** 1973
- **Complexity:** High (heuristic score: 289)
- **Imports:** None
- **Exports:** None
- **Functions:** bomSetPrintPageSize(cssSizeAndMargin), bomLoadCustomKits(), bomSaveCustomKits(obj), bomGetAllKits(), bomIsCustomKitKey(key), bomSlugify(label), bomRenumberAll(sections), bomDefaultSectionsTemplate(), bomParseQtyNumber(qtyStr), bomSplitSerials(text), bomCollectKitItemNames(), bomLoadItemMasterNames(), bomBuildItemOptionsHtml(selectedName), bomRenderScreenItemsHtml(state, opts), bomRenderPrintSheetHtml(kit, header), bomRenderChallanTemplateItemsHtml(template), bomRenderChallanEntryModalHtml(header, kit), bomCollectChallanTemplateValues(), bomChallanBuildRowGroups(template), bomRenderChallanBodyRowsHtml(groups, values), bomRenderChallanHeaderRowsHtml(header, kit, copyLabel, isCompanyCopy), bomRenderChallanTableHeadRowHtml(), bomRenderChallanFooterRowsHtml(header), bomRenderChallanPrintSheetHalfHtml(header, kit, copyLabel, templateValues, isCompanyCopy), bomRenderChallanPrintSheetHtml(header, kit, templateValues), openChallanModal(bodyHtml), closeChallanModal(), bomLoadSerialMandatoryInfo(), bomItemNeedsSerial(name), searchBomCustomerLedgers(q), searchBomCustomerShortCodes(q), fillBomCustomerDatalist(listEl, ledgers, key), wireBomCustomerAutocomplete(inputEl, listEl, matchKey, searchFn), wireBomPartyTypeAutocomplete(inputEl, listEl, ledgerType), search(q), fillList(ledgers), setVerified(isVerified), allItemsChecked(), updateVerifyButtonState(), populateKitDropdown(selectKey), refreshItemsPreview(), renderKitBuilderSections(), handleBuilderFieldEdit(e), handleItemFieldEdit(e), rerenderItemsPreview(), openBomSerialModal(si, ii), updateCountNote(), getHeaderValues(), computeAndApplyFitZoom(), bomEsc(s), bomEscAttr(s), qtyInput(sr, sizeLabel), descInput(sr), setVal(key, patch), getQty(sr, size), getDesc(sr), $(id), blankItem()
- **Classes:** in
- **API endpoints:** None
- **Database usage:** Raw SQL detected (39 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/dashboard.js`

- **Purpose:** Defines 18 function(s) implementing supporting logic.
- **Lines of code:** 441
- **Complexity:** High (heuristic score: 79)
- **Imports:** None
- **Exports:** None
- **Functions:** loadRealDashboardData(), animateCountUp(el, endValue, duration = 900), tick(now), goTo(i), timeAgo(iso), liveUsersTableHtml(), updateSummaryLabels(), refreshLiveSessions(), openLiveUsersModal(), cellValue(row, col), uniqueValues(col), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), fmt(n), setText(id, val), itemCbs()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (5 statement keywords: JOIN, SELECT)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/lowstock.js`

- **Purpose:** Defines 12 function(s) implementing supporting logic.
- **Lines of code:** 236
- **Complexity:** Medium (heuristic score: 37)
- **Imports:** None
- **Exports:** None
- **Functions:** rowToValues(r), matchesSearch(values), isRowVisible(values), loadData(), renderTable(), uniqueValues(col), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), $(id), itemCbs()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (6 statement keywords: JOIN, SELECT)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/masters.js`

- **Purpose:** Defines 8 function(s) implementing supporting logic.
- **Lines of code:** 897
- **Complexity:** High (heuristic score: 102)
- **Imports:** None
- **Exports:** None
- **Functions:** loadMastersSystemEngine(), syncWattMandatoryUI(), resetItemFormState(), loadSubtypesForCategory(cat), resetSubForm(), resetUomForm(), resetWhForm(), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (31 statement keywords: SELECT, UPDATE, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/partyledger.js`

- **Purpose:** Defines 39 function(s) implementing supporting logic.
- **Lines of code:** 910
- **Complexity:** High (heuristic score: 194)
- **Imports:** None
- **Exports:** None
- **Functions:** loadDirectory(), renderList(), selectParty(p), fetchStatementRows(partyName, type), updateLedgerFormMode(), lockPageScroll(), unlockPageScroll(), attachLedgerFormEscape(), detachLedgerFormEscape(), openLedgerForm(editing), closeLedgerForm(), downloadCsv(filename, rows), downloadTemplate(), parseCsv(text), handleImportFile(e), openStatement(), closeStatement(), renderProfile(), renderSummary(), parseDate(d), monthKey(d), monthLabel(key), refDisplay(row), updateBreadcrumb(), setHead(cols), renderLevel(), fmtFileSize(bytes), updateAttachmentsPanel(), refreshAttachmentsList(), highlightStatementRow(idx), attachStatementKeyboardNav(), detachStatementKeyboardNav(), renderMonths(tbody), renderDates(tbody), renderRefs(tbody), renderSerials(tbody), goBackLevel(), splitLine(line), valueFrom(row, keys, def = '')
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (15 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/purchase.js`

- **Purpose:** Defines 24 function(s) implementing supporting logic.
- **Lines of code:** 957
- **Complexity:** High (heuristic score: 130)
- **Imports:** None
- **Exports:** None
- **Functions:** splitSerials(text), setPurEditOpen(open), renderLineList(container, lines, emptyText), wireLineSelection(container), selectedLineIndex(container), wireProofButtons(fileInputId, attachBtnId, clearBtnId, labelId, state), renderFileList(), fillSelect(selectEl, items, placeholder), purCategoryNeedsSerial(cat), loadPurCategories(), refreshPurBrandsAndType(), refreshPurWattages(), fillSelectFromApi(selectEl, apiPath, emptyLabel, injectValue), loadPurWarehouses(injectEditValue), searchSupplierLedgers(q), searchSupplierShortCodes(q), fillSupplierDatalist(listEl, ledgers, key), applyLedgerToSupplierFields(l), wireSupplierAutocomplete(inputEl, listEl, matchKey, searchFn), clearPurchaseForm(), refreshPurEditBrandsAndType(injectBrand, injectType), refreshPurEditWattages(injectWatt), loadEditCascadeForLine(line), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (46 statement keywords: SELECT, JOIN, UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/purchase.page.js`

- **Purpose:** Defines 24 function(s) implementing supporting logic.
- **Lines of code:** 957
- **Complexity:** High (heuristic score: 130)
- **Imports:** None
- **Exports:** None
- **Functions:** splitSerials(text), setPurEditOpen(open), renderLineList(container, lines, emptyText), wireLineSelection(container), selectedLineIndex(container), wireProofButtons(fileInputId, attachBtnId, clearBtnId, labelId, state), renderFileList(), fillSelect(selectEl, items, placeholder), purCategoryNeedsSerial(cat), loadPurCategories(), refreshPurBrandsAndType(), refreshPurWattages(), fillSelectFromApi(selectEl, apiPath, emptyLabel, injectValue), loadPurWarehouses(injectEditValue), searchSupplierLedgers(q), searchSupplierShortCodes(q), fillSupplierDatalist(listEl, ledgers, key), applyLedgerToSupplierFields(l), wireSupplierAutocomplete(inputEl, listEl, matchKey, searchFn), clearPurchaseForm(), refreshPurEditBrandsAndType(injectBrand, injectType), refreshPurEditWattages(injectWatt), loadEditCascadeForLine(line), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (46 statement keywords: SELECT, JOIN, UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/purchaseregister.js`

- **Purpose:** Defines 15 function(s) implementing supporting logic.
- **Lines of code:** 279
- **Complexity:** Medium (heuristic score: 47)
- **Imports:** None
- **Exports:** None
- **Functions:** toISO(d), loadCategoryFilter(), rowToValues(r), inDateRange(dmy), matchesSearch(values), loadData(), isRowVisible(values), renderTable(), uniqueValues(col), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), $(id), itemCbs()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (8 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/reports.js`

- **Purpose:** Defines 14 function(s) implementing supporting logic.
- **Lines of code:** 281
- **Complexity:** Medium (heuristic score: 42)
- **Imports:** None
- **Exports:** None
- **Functions:** loadCategoryFilter(), rowToValues(r), matchesSearch(r), loadData(), isRowVisible(values), statusPillClass(status), renderTable(), uniqueValues(col), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), $(id), itemCbs()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (8 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/returns.js`

- **Purpose:** Defines 4 function(s) implementing supporting logic.
- **Lines of code:** 141
- **Complexity:** Low (heuristic score: 16)
- **Imports:** None
- **Exports:** None
- **Functions:** splitSerials(text), wireSerialBox(el), resetForm(), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (4 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/saleregister.js`

- **Purpose:** Defines 15 function(s) implementing supporting logic.
- **Lines of code:** 287
- **Complexity:** Medium (heuristic score: 47)
- **Imports:** None
- **Exports:** None
- **Functions:** toISO(d), loadCategoryFilter(), rowToValues(r), inDateRange(dmy), matchesSearch(values), loadData(), isRowVisible(values), renderTable(), uniqueValues(col), applyAllFilters(), closeMenu(), positionMenu(menu, btn), openMenuFor(btn), $(id), itemCbs()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (8 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/sales.js`

- **Purpose:** Defines 31 function(s) implementing supporting logic.
- **Lines of code:** 924
- **Complexity:** High (heuristic score: 150)
- **Imports:** None
- **Exports:** None
- **Functions:** fillSelect(selectEl, items, placeholder), fillSelectFromApi(selectEl, apiPath, emptyLabel, injectValue), loadCategoryWattRules(), isWattMandatory(cat), isSerialMandatory(cat), splitSerials(text), wireSerialBox(el), renderLineList(container, lines, emptyText), wireLineSelection(container), selectedLineIndex(container), wireProofButtons(fileInputId, attachBtnId, clearBtnId, labelId, state), renderFileList(), loadSaleCategories(), refreshSaleBrandsAndWatt(), refreshSaleWattage(), refreshSaleType(), updateSaleSerialFieldVisibility(), searchCustomerLedgers(q), searchCustomerShortCodes(q), fillCustomerDatalist(listEl, ledgers, key), applyLedgerToCustomerFields(l), wireCustomerAutocomplete(inputEl, listEl, matchKey, searchFn), clearSalesForm(), refreshSaleEditBrandsAndWatt(injectBrand, injectWatt), refreshSaleEditWattage(injectWatt), refreshSaleEditType(injectType), loadEditCascadeForLine(line), clearEditPanel(), findSalesOrderForEditing(term), prefillFromAssign(customerName, orderNo, mobile, address, lines), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (42 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/scansheet.js`

- **Purpose:** Defines 95 function(s) implementing supporting logic.
- **Lines of code:** 1756
- **Complexity:** High (heuristic score: 418)
- **Imports:** None
- **Exports:** None
- **Functions:** escapeHtml(str), fmtTimestamp(iso), root(), render(), renderList(), sheetCardHtml(sheet), openCreateModal(), openTemplateModal(), handleImportFile(file), parseCsv(text), importFromRows(rows, fileName), startManualCreate(prefill), startEditSheet(sheetId), renderManualCreate(), colRowHtml(col), syncDraftFromDom(), addDraftColumn(), deleteDraftColumn(id), saveDraftSheet(), backToList(), openSheetDataEntry(sheetId), renderDataEntry(), isScannableCol(col), fieldHtml(col), entryRowHtml(entry, sheet), handleImageFieldChange(inputEl), saveCurrentEntry(), deleteEntryRow(entryId), saveTextFile(content, suggestedName, mimeType, pickerTypes), exportSheetCsv(sheetId), dropdownOutsideHandler(e), closeAnyDropdown(), placeDropdown(menu, anchorBtn), openSheetCardMenu(sheetId, anchorBtn), openEntryMenu(anchorBtn), isDuplicateScanValue(sheet, colId, value), processScanValue(text, fieldId), resolveScanTargetId(), openScanner(targetFieldId), setScanStatus(msg), startCamera(), launchCamera(), onScanSuccess(decodedText), showScanResult(text), openBluetoothScanResult(text, targetId), showBluetoothScanResult(text), bindBtResultAction(btn, handler), hideScanResult(), closeBluetoothResultOverlay(), closeBluetoothResultAndResume(), retryScan(), confirmScanSave(), fillTargetField(text, fieldId), toggleTorch(), flipCamera(), closeScanner(), beep(), ensureBluetoothScannerListener(), setBluetoothScanMode(enabled), resetBluetoothScanBuffer(), clearBluetoothTargetValue(targetId), getBluetoothCaptureValue(), setTargetFieldValue(text, targetId), prepBluetoothFieldForFocus(input), releaseBluetoothFieldForScanner(input), resumeBluetoothScannerAfterResult(targetId, clearValue), focusBluetoothScanTarget(), onBluetoothScannerKeydown(e), clearBluetoothKeyBufferTimer(), addBluetoothKeyBufferChar(ch), onBluetoothScannerPaste(e), observeKeyboardWedgeScan(e), isLikelyScannerBurst(text, now), appendBluetoothScannerChar(ch, preferredField), syncBluetoothCapture(value), queueBluetoothScanValue(text, targetId), handleBluetoothScanValue(text, fieldId), setDirectScannerStatus(msg, isError), connectHidScanner(), onHidScannerInputReport(event), parseHidKeyboardReport(bytes), hidKeyCodeToChar(code, shift), addDirectScannerChar(ch, source), finishDirectScannerBuffer(source), connectSerialScanner(), readSerialScannerLoop(port), handleSerialScannerText(text), wire(), wireList(), wireManualCreate(), wireDataEntry(), pad(n), csvEscape(v), run(e), finish()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (14 statement keywords: JOIN, SELECT)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/pages/stockassign.js`

- **Purpose:** Defines 24 function(s) implementing supporting logic.
- **Lines of code:** 668
- **Complexity:** High (heuristic score: 115)
- **Imports:** None
- **Exports:** None
- **Functions:** setAssignRegOpen(open), fillSelect(selectEl, items, placeholder), renderLineList(container, lines, emptyText), wireLineSelection(container), selectedLineIndex(container), wireProofButtons(fileInputId, attachBtnId, clearBtnId, labelId, state), renderFileList(), loadCategoryWattRules(), isWattMandatory(cat), loadAssignCategories(), refreshAssignBrandsAndWatt(), refreshAssignWattage(), refreshAssignType(), searchPersonLedgers(q), searchPersonShortCodes(q), fillPersonDatalist(listEl, ledgers, key), applyLedgerToPersonFields(l), wirePersonAutocomplete(inputEl, listEl, matchKey, searchFn), refreshAvailableHint(), clearAssignForm(), renderRegisterTable(), loadAssignedRegister(), clearReleasePanel(), $(id)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (21 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - File defines a large number of functions — consider splitting into smaller modules.
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `js/data/api.js`

- **Purpose:** Defines 3 function(s) implementing supporting logic.
- **Lines of code:** 103
- **Complexity:** Low (heuristic score: 12)
- **Imports:** None
- **Exports:** None
- **Functions:** parseApiResponse(res, path), readFileAsBase64(file), uploadAttachments(refType, refNo, fileList)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `js/data/purchase-data.js`

- **Purpose:** Defines 4 function(s) implementing supporting logic.
- **Lines of code:** 42
- **Complexity:** Low (heuristic score: 12)
- **Imports:** None
- **Exports:** None
- **Functions:** parseDMY(str), dmyFromISO(iso), isoFromDMY(dmy), splitSerials(text)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `js/data/sales-data.js`

- **Purpose:** Supporting source file.
- **Lines of code:** 15
- **Complexity:** Low (heuristic score: 0)
- **Imports:** None
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `js/data/sheets-store.js`

- **Purpose:** Defines 14 function(s) implementing supporting logic.
- **Lines of code:** 159
- **Complexity:** Medium (heuristic score: 47)
- **Imports:** None
- **Exports:** None
- **Functions:** uid(prefix), persistLocalCache(), loadLocalCache(), warnSaveFailed(action, err), hydrate(), getSheets(), getSheet(id), createSheet({ name, columns }), updateSheet(id, patch), deleteSheet(id), getEntries(sheetId), addEntry(sheetId, values), deleteEntry(sheetId, entryId), clearEntries(sheetId)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/api.js`

- **Purpose:** Defines 5 function(s) implementing supporting logic.
- **Lines of code:** 138
- **Complexity:** Medium (heuristic score: 22)
- **Imports:** None
- **Exports:** None
- **Functions:** parseApiResponse(res, path), getFileExtension(fileName), validateAttachmentFile(file), readFileAsBase64(file), uploadAttachments(refType, refNo, fileList)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `api/package.json`

- **Purpose:** Supporting source file.
- **Lines of code:** 22
- **Complexity:** Low (heuristic score: 0)
- **Imports:** None
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None
- **Potential improvements:**
  - No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.

---

## `api/server.js`

- **Purpose:** Application entry point / bootstrap file.
- **Lines of code:** 69
- **Complexity:** Low (heuristic score: 1)
- **Imports:** dotenv, express, path, ./config/cors, ./db/pool, ./db/schema, ./middleware/auth, ./middleware/rateLimiters, ./services/passwords, ./services/email, ./services/stockHelpers, ./utils/route, ./utils/time, ./routes/attachments, ./routes/health, ./routes/auth, ./routes/masters, ./routes/purchase, ./routes/ledgers, ./routes/sales, ./routes/stockassign, ./routes/scansheet.routes, ./routes/reports, ./routes/backup, ./routes/challan
- **Exports:** None
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: JOIN)
- **Environment variables used:** PORT
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.

---

## `api/utils/route.js`

- **Purpose:** Provides shared utility/helper functions.
- **Lines of code:** 13
- **Complexity:** Low (heuristic score: 3)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** route(handler)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `api/utils/time.js`

- **Purpose:** Provides shared utility/helper functions.
- **Lines of code:** 15
- **Complexity:** Low (heuristic score: 4)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** getISTParts(d), ledgerTimestamp()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `api/services/challanPdf.js`

- **Purpose:** Implements business logic as a service layer.
- **Lines of code:** 553
- **Complexity:** High (heuristic score: 67)
- **Imports:** fs, os, path, crypto, child_process, exceljs
- **Exports:** module.exports
- **Functions:** runSoffice(xlsxPath, outDir), normalizeBorderSide(side), applySheetStructure(sheet, config), applySheetValues(sheet, config), applySheetFormatting(sheet, config), fillTemplateAndConvertToPdf(record), cleanup()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (6 statement keywords: JOIN)
- **Environment variables used:** SOFFICE_PATH
- **Potential improvements:**
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - process.env is used directly — confirm environment variables are validated/typed at startup.

---

## `api/services/email.js`

- **Purpose:** Implements business logic as a service layer.
- **Lines of code:** 128
- **Complexity:** Medium (heuristic score: 29)
- **Imports:** nodemailer
- **Exports:** module.exports
- **Functions:** generateOtp(), sendOtpEmail(toEmail, otp), maskEmail(email)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: JOIN)
- **Environment variables used:** BREVO_API_KEY, BREVO_FROM_EMAIL, BREVO_FROM_NAME, RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - process.env is used directly — confirm environment variables are validated/typed at startup.

---

## `api/services/passwords.js`

- **Purpose:** Implements business logic as a service layer.
- **Lines of code:** 17
- **Complexity:** Low (heuristic score: 8)
- **Imports:** bcryptjs
- **Exports:** module.exports
- **Functions:** hashPassword(plain), looksLikeBcryptHash(stored), verifyPassword(plain, stored)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `api/services/stockHelpers.js`

- **Purpose:** Implements business logic as a service layer.
- **Lines of code:** 86
- **Complexity:** Low (heuristic score: 19)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** itemNameSlug(brand, watt, solarType), getItemId(runner, category, brand, watt, solarType), validateSalesLineSerials(runner, serials, line), getOrCreateItem(conn, category, brand, watt, solarType)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (6 statement keywords: SELECT, INSERT INTO)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/attachments.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 107
- **Complexity:** Medium (heuristic score: 22)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerAttachmentsRoutes(app, deps), getFileExtension(fileName), base64ByteSize(base64)
- **Classes:** None
- **API endpoints:** POST /api/attachments, GET /api/attachments, GET /api/attachments/:id/file, DELETE /api/attachments/:id
- **Database usage:** Raw SQL detected (4 statement keywords: INSERT INTO, SELECT, DELETE FROM)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/auth.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 395
- **Complexity:** High (heuristic score: 61)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerAuthRoutes(app, deps), completeLoginSession(uname, role, res)
- **Classes:** None
- **API endpoints:** POST /api/auth/login, POST /api/auth/verify-otp, POST /api/auth/resend-otp, POST /api/auth/register, POST /api/auth/verify-register-otp, POST /api/auth/forgot-password, POST /api/auth/reset-password, POST /api/auth/logout, POST /api/auth/heartbeat, GET /api/sessions/live
- **Database usage:** Raw SQL detected (44 statement keywords: UPDATE, SELECT, INSERT INTO, DELETE FROM, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/backup.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 168
- **Complexity:** Medium (heuristic score: 33)
- **Imports:** fs, path, exceljs
- **Exports:** module.exports
- **Functions:** registerBackupRoutes(app, deps), ensureBackupLogTable(), resolveBackupDir(), exportAllTablesToExcel(destPath), backupTimestampStamp(), runBackup(backupType), checkAutoBackup()
- **Classes:** None
- **API endpoints:** GET /api/backup/status, POST /api/backup/run, GET /api/backup/download/:fileName
- **Database usage:** Raw SQL detected (10 statement keywords: CREATE TABLE, JOIN, SELECT, INSERT INTO)
- **Environment variables used:** BACKUP_NAS_PATH
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - process.env is used directly — confirm environment variables are validated/typed at startup.

---

## `api/routes/challan.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 63
- **Complexity:** Low (heuristic score: 6)
- **Imports:** ../services/challanPdf
- **Exports:** module.exports
- **Functions:** registerChallanRoutes(app, deps)
- **Classes:** None
- **API endpoints:** POST /api/challan, GET /api/challan, GET /api/challan/:id, GET /api/challan/:id/pdf
- **Database usage:** Raw SQL detected (4 statement keywords: INSERT INTO, SELECT)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/health.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 86
- **Complexity:** Low (heuristic score: 2)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerHealthRoutes(app, deps)
- **Classes:** None
- **API endpoints:** GET /api/health, GET /api/dashboard/summary, GET /api/lowstock
- **Database usage:** Raw SQL detected (9 statement keywords: SELECT, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/ledgers.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 259
- **Complexity:** Medium (heuristic score: 37)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerLedgersRoutes(app, deps), ledgerExists(name, short, excludeId)
- **Classes:** None
- **API endpoints:** GET /api/ledgers, GET /api/ledgers/shortcodes, GET /api/ledgers/directory, POST /api/ledgers, PUT /api/ledgers/:id, DELETE /api/ledgers/:id, GET /api/ledgers/statement
- **Database usage:** Raw SQL detected (12 statement keywords: SELECT, JOIN, INSERT INTO, UPDATE, DELETE FROM)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/masters.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 243
- **Complexity:** Medium (heuristic score: 30)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerMastersRoutes(app, deps)
- **Classes:** None
- **API endpoints:** GET /api/masters/categories, POST /api/masters/categories, PUT /api/masters/categories/:name/watt-rule, PUT /api/masters/categories/:name/serial-rule, DELETE /api/masters/categories/:name, GET /api/masters/subtypes/:category, POST /api/masters/subtypes, PUT /api/masters/subtypes, DELETE /api/masters/subtypes, GET /api/masters/units, POST /api/masters/units, PUT /api/masters/units, DELETE /api/masters/units, GET /api/masters/items, POST /api/masters/items, PUT /api/masters/items/:id, GET /api/masters/warehouses, POST /api/masters/warehouses, PUT /api/masters/warehouses, DELETE /api/masters/warehouses, GET /api/masters/brands, GET /api/masters/users, POST /api/masters/users, PUT /api/masters/users/password, PUT /api/masters/users/email
- **Database usage:** Raw SQL detected (39 statement keywords: SELECT, INSERT INTO, UPDATE, DELETE FROM, JOIN)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - Large number of routes in a single file — consider grouping into sub-routers by resource.

---

## `api/routes/purchase.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 451
- **Complexity:** Medium (heuristic score: 59)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerPurchaseRoutes(app, deps)
- **Classes:** None
- **API endpoints:** GET /api/purchase/brands/:category, GET /api/purchase/wattages, GET /api/purchase/check-serials, POST /api/purchase, GET /api/purchase/find, PUT /api/purchase/:invoiceNo, DELETE /api/purchase/:invoiceNo, GET /api/purchase/register
- **Database usage:** Raw SQL detected (35 statement keywords: SELECT, JOIN, INSERT INTO, UPDATE, DELETE FROM)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/purchase.route.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 451
- **Complexity:** Medium (heuristic score: 59)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerPurchaseRoutes(app, deps)
- **Classes:** None
- **API endpoints:** GET /api/purchase/brands/:category, GET /api/purchase/wattages, GET /api/purchase/check-serials, POST /api/purchase, GET /api/purchase/find, PUT /api/purchase/:invoiceNo, DELETE /api/purchase/:invoiceNo, GET /api/purchase/register
- **Database usage:** Raw SQL detected (35 statement keywords: SELECT, JOIN, INSERT INTO, UPDATE, DELETE FROM)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/reports.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 42
- **Complexity:** Low (heuristic score: 5)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerReportsRoutes(app, deps), dash(v)
- **Classes:** None
- **API endpoints:** GET /api/reports/master
- **Database usage:** Raw SQL detected (1 statement keyword: SELECT)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/sales.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 535
- **Complexity:** High (heuristic score: 76)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerSalesRoutes(app, deps), isQtyLine(line)
- **Classes:** None
- **API endpoints:** GET /api/sales/types, GET /api/sales/check-line, POST /api/sales/dispatch, POST /api/returns, GET /api/sales/find/:term, PUT /api/sales/modify/:orderNo, DELETE /api/sales/delete/:orderNo, GET /api/sales/register
- **Database usage:** Raw SQL detected (35 statement keywords: SELECT, JOIN, UPDATE, INSERT INTO)
- **Environment variables used:** None
- **Potential improvements:**
  - High branching complexity detected — consider refactoring conditional logic into smaller helpers.
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/scansheet.routes.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 128
- **Complexity:** Medium (heuristic score: 22)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerScanSheetRoutes(app, deps), mapSheet(row), mapEntry(row), findOwnedSheet(id, username)
- **Classes:** None
- **API endpoints:** GET /api/scansheet/sheets, POST /api/scansheet/sheets, PUT /api/scansheet/sheets/:id, DELETE /api/scansheet/sheets/:id, GET /api/scansheet/sheets/:id/entries, POST /api/scansheet/sheets/:id/entries, PUT /api/scansheet/sheets/:id/entries/renumber, DELETE /api/scansheet/sheets/:id/entries/:entryId, DELETE /api/scansheet/sheets/:id/entries
- **Database usage:** Raw SQL detected (12 statement keywords: SELECT, INSERT INTO, UPDATE, JOIN, DELETE FROM)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/routes/stockassign.js`

- **Purpose:** Defines HTTP route handlers (controller/router layer).
- **Lines of code:** 280
- **Complexity:** Medium (heuristic score: 41)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** registerStockassignRoutes(app, deps), releaseAssignedSerials(conn, reference)
- **Classes:** None
- **API endpoints:** GET /api/stockassign/available, POST /api/stockassign, GET /api/stockassign/register, GET /api/stockassign/lines/:reference, POST /api/stockassign/release-firm, POST /api/stockassign/release-customer
- **Database usage:** Raw SQL detected (16 statement keywords: SELECT, UPDATE, JOIN, INSERT INTO)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/middleware/auth.js`

- **Purpose:** Implements Express/Koa middleware.
- **Lines of code:** 38
- **Complexity:** Low (heuristic score: 13)
- **Imports:** crypto, jsonwebtoken
- **Exports:** module.exports
- **Functions:** issueToken(username, role), authenticateToken(req, res, next), requireRole(...roles)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** JWT_SECRET
- **Potential improvements:**
  - process.env is used directly — confirm environment variables are validated/typed at startup.

---

## `api/middleware/rateLimiters.js`

- **Purpose:** Implements Express/Koa middleware.
- **Lines of code:** 8
- **Complexity:** Low (heuristic score: 2)
- **Imports:** express-rate-limit
- **Exports:** module.exports
- **Functions:** rateLimitHandler(_req, res)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** None

---

## `api/db/pool.js`

- **Purpose:** Supporting source file.
- **Lines of code:** 26
- **Complexity:** Low (heuristic score: 1)
- **Imports:** mysql2/promise
- **Exports:** module.exports
- **Functions:** None
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (1 statement keyword: JOIN)
- **Environment variables used:** DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
  - process.env is used directly — confirm environment variables are validated/typed at startup.
  - No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.

---

## `api/db/schema.js`

- **Purpose:** Defines 10 function(s) implementing supporting logic.
- **Lines of code:** 89
- **Complexity:** Medium (heuristic score: 30)
- **Imports:** None
- **Exports:** module.exports
- **Functions:** ensureStartupSchema(pool), ensureSessionSchema(pool), ensureSerialRuleSchema(pool), ensureLedgerTypeSchema(pool), ensureAuthOtpSchema(pool), ensureEmailRoleUniqueSchema(pool), ensureAttachmentsSchema(pool), ensureScanSheetSchema(pool), ensureBomChallanSchema(pool), ensureStockQuantitySchema(pool)
- **Classes:** None
- **API endpoints:** None
- **Database usage:** Raw SQL detected (14 statement keywords: ALTER TABLE, CREATE TABLE, SELECT, UPDATE)
- **Environment variables used:** None
- **Potential improvements:**
  - Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

## `api/config/cors.js`

- **Purpose:** Defines 1 function(s) implementing supporting logic.
- **Lines of code:** 19
- **Complexity:** Low (heuristic score: 3)
- **Imports:** cors
- **Exports:** module.exports
- **Functions:** corsMiddleware()
- **Classes:** None
- **API endpoints:** None
- **Database usage:** None
- **Environment variables used:** CORS_ORIGIN
- **Potential improvements:**
  - process.env is used directly — confirm environment variables are validated/typed at startup.

---

