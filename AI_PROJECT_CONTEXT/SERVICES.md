# Services

| File | Functions | Classes | Purpose |
| --- | --- | --- | --- |
| api/services/challanPdf.js | getPaper, getPageHeightPt, getPageWidthPt, stretchRowsToFillPage, widthCharsToPt, ptToWidthChars, stretchColumnsToFillPage, runSoffice, fillTemplateAndConvertToPdf, cleanup |  | Implements business logic as a service layer. |
| api/services/email.js | generateOtp, sendOtpEmail, maskEmail |  | Implements business logic as a service layer. |
| api/services/passwords.js | hashPassword, looksLikeBcryptHash, verifyPassword |  | Implements business logic as a service layer. |
| api/services/stockHelpers.js | itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem |  | Implements business logic as a service layer. |

