# Hallazgos detallados de incumplimiento — Guía v3

Total hallazgos detectados automáticamente: **1547**

## Resumen por requisito

- **V3-3-BUTTON-STANDARD**: 920
- **V3-2-COLOR-HARDCODE**: 334
- **V3-6-ARIA-ICON-BUTTON**: 81
- **V3-5-CHART-PALETTE**: 54
- **V3-6-DIV-ONCLICK**: 47
- **V3-2-DARK-OVERLAY**: 39
- **V3-6-TOUCH-44**: 33
- **V3-2-TEAL-IMPORTE**: 21
- **V3-3-INPUT-FOCUS**: 16
- **V3-4-DELETE-KEBAB**: 2

## Listado completo

| Archivo | Línea | Requisito | Incumplimiento | Evidencia |
|---|---:|---|---|---|
| `src/index.css` | 55 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 141 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 141 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 142 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 248 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 279 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/index.css` | 315 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 322 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 331 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FDF1EE` |
| `src/index.css` | 331 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#F0C4B8` |
| `src/index.css` | 335 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FDF5E0` |
| `src/index.css` | 336 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FDF1EE` |
| `src/index.css` | 354 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/index.css` | 421 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FDF5E0` |
| `src/index.css` | 422 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FDF1EE` |
| `src/index.css` | 362 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `--teal` |
| `src/index.css` | 351 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `:focus {   outline: none` |
| `src/App.tsx` | 159 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/features/inbox/OcrPanel.tsx` | 244 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/features/inbox/OcrPanel.tsx` | 502 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/features/inbox/OcrPanel.tsx` | 550 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/features/inbox/OcrPanel.tsx` | 754 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/features/inbox/OcrPanel.tsx` | 887 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/features/inbox/OcrPanel.tsx` | 895 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/RealEstatePortfolioPage.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/RealEstatePortfolioPage.tsx` | 72 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/RealEstatePortfolioPage.tsx` | 95 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/SettingsPage.tsx` | 217 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/SettingsPage.tsx` | 242 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/SettingsPage.tsx` | 292 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/SettingsPage.tsx` | 309 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 231 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 238 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 348 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 355 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 373 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/ProfileSeederPage.tsx` | 405 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 706 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1091 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1112 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1144 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1152 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1254 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1268 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/InboxPage.tsx` | 1152 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                     onClick={handleBulkDelete}                     className="flex items-center gap-1` |
| `src/pages/InboxPage.tsx` | 1159 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                     onClick={handleBulkReassign}                     className="atlas-atlas-atlas-atlas-atlas-atlas-btn-primary flex items-center gap-1` |
| `src/pages/DesignBiblePage.tsx` | 241 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 249 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 257 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 270 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 278 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 286 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 299 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 307 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 336 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/DesignBiblePage.tsx` | 199 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div               key={section.title}               onClick={() =>` |
| `src/pages/account/AccountPage.tsx` | 41 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/MigracionTab.tsx` | 60 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EBF3FF` |
| `src/pages/account/MigracionTab.tsx` | 176 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#E8F8EF` |
| `src/pages/account/MigracionTab.tsx` | 132 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 221 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FFF8E7` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 276 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EBF3FF` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 295 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f2f2f2` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 215 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 231 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 273 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarContratos.tsx` | 313 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 193 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EBF3FF` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 279 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EBF3FF` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 343 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EBF3FF` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 383 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 428 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 165 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 226 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 317 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarValoraciones.tsx` | 420 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/account/migracion/ImportarMovimientos.tsx` | 41 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#E8F8EF` |
| `src/pages/account/migracion/ImportarMovimientos.tsx` | 14 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/auth/RegisterPage.tsx` | 56 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/pages/auth/RegisterPage.tsx` | 133 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/pages/auth/LoginPage.tsx` | 72 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ReformBreakdownComponent.tsx` | 195 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ReformBreakdownComponent.tsx` | 201 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ImageDescriptionComponent.tsx` | 178 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ImageDescriptionComponent.tsx` | 266 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ImageDescriptionComponent.tsx` | 297 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/ImageDescriptionComponent.tsx` | 178 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={handleClearImage}               className="text-gray-400 hover:text-gray-600"             >               <X className="h-5 w-5"` |
| `src/components/ImageDescriptionComponent.tsx` | 142 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className="border-2 border-dashed border-gray-300 p-8 text-center hover:border-gray-400 cursor-pointer"           onClick={() =>` |
| `src/components/DocumentPreview.tsx` | 169 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/DocumentPreview.tsx` | 274 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                  key={index}                 className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer"                 onClick={(` |
| `src/components/InvoiceBreakdownModal.tsx` | 348 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 384 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 394 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 428 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 616 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 622 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 687 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/InvoiceBreakdownModal.tsx` | 348 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="h-6 w-6" />           </bu` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 169 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 201 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 304 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 312 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 372 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/fiscalidad/PropertyImprovements.tsx` | 201 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               type="button"               onClick={resetForm}               className="text-neutral-500 hover:text-neutral-700"             >` |
| `src/components/fiscalidad/AmortizationDetail.tsx` | 138 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/MovementQuickActions.tsx` | 61 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/MovementQuickActions.tsx` | 109 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/MovementQuickActions.tsx` | 129 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/MovementQuickActions.tsx` | 120 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                className="fixed inset-0 z-10"                onClick={() =>` |
| `src/components/treasury/treasury-reconciliation.css` | 9 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f8f9fa` |
| `src/components/treasury/treasury-reconciliation.css` | 38 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 50 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f5f5` |
| `src/components/treasury/treasury-reconciliation.css` | 55 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1a4e8f` |
| `src/components/treasury/treasury-reconciliation.css` | 64 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1a4e8f` |
| `src/components/treasury/treasury-reconciliation.css` | 69 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1a4e8f` |
| `src/components/treasury/treasury-reconciliation.css` | 97 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 108 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f5f5` |
| `src/components/treasury/treasury-reconciliation.css` | 114 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 138 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 158 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 174 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#bbb` |
| `src/components/treasury/treasury-reconciliation.css` | 181 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 189 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1a4e8f` |
| `src/components/treasury/treasury-reconciliation.css` | 198 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f5f5` |
| `src/components/treasury/treasury-reconciliation.css` | 224 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 235 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#c0c0c0` |
| `src/components/treasury/treasury-reconciliation.css` | 236 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 305 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 323 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 348 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#666` |
| `src/components/treasury/treasury-reconciliation.css` | 500 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 597 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 790 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 801 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f8ff` |
| `src/components/treasury/treasury-reconciliation.css` | 806 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eef3ff` |
| `src/components/treasury/treasury-reconciliation.css` | 821 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#555` |
| `src/components/treasury/treasury-reconciliation.css` | 827 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 829 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 838 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 850 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 863 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 873 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 883 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f5f5` |
| `src/components/treasury/treasury-reconciliation.css` | 892 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fafafa` |
| `src/components/treasury/treasury-reconciliation.css` | 897 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f8fafc` |
| `src/components/treasury/treasury-reconciliation.css` | 903 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#64748b` |
| `src/components/treasury/treasury-reconciliation.css` | 913 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fcfdff` |
| `src/components/treasury/treasury-reconciliation.css` | 928 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#c0c0c0` |
| `src/components/treasury/treasury-reconciliation.css` | 959 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 976 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f5f5f5` |
| `src/components/treasury/treasury-reconciliation.css` | 977 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 984 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eef3ff` |
| `src/components/treasury/treasury-reconciliation.css` | 992 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 1012 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#d1d5db` |
| `src/components/treasury/treasury-reconciliation.css` | 1013 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f8fafc` |
| `src/components/treasury/treasury-reconciliation.css` | 1014 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#64748b` |
| `src/components/treasury/treasury-reconciliation.css` | 1026 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eef3ff` |
| `src/components/treasury/treasury-reconciliation.css` | 1059 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eef3ff` |
| `src/components/treasury/treasury-reconciliation.css` | 1104 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1105 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#555` |
| `src/components/treasury/treasury-reconciliation.css` | 1109 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#555` |
| `src/components/treasury/treasury-reconciliation.css` | 1115 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/components/treasury/treasury-reconciliation.css` | 1116 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 1120 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 1121 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#555` |
| `src/components/treasury/treasury-reconciliation.css` | 1128 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 1157 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1164 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 1165 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#333` |
| `src/components/treasury/treasury-reconciliation.css` | 1185 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e8e8e8` |
| `src/components/treasury/treasury-reconciliation.css` | 1208 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1214 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#444` |
| `src/components/treasury/treasury-reconciliation.css` | 1239 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 1255 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 1284 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1301 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 1305 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 1320 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0f0f0` |
| `src/components/treasury/treasury-reconciliation.css` | 1344 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eef3fc` |
| `src/components/treasury/treasury-reconciliation.css` | 1345 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1a4e8f` |
| `src/components/treasury/treasury-reconciliation.css` | 1371 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ccc` |
| `src/components/treasury/treasury-reconciliation.css` | 1376 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#6b8aad` |
| `src/components/treasury/treasury-reconciliation.css` | 1381 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#555` |
| `src/components/treasury/treasury-reconciliation.css` | 1388 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#999` |
| `src/components/treasury/treasury-reconciliation.css` | 1402 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 1416 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/treasury/treasury-reconciliation.css` | 1437 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1457 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#888` |
| `src/components/treasury/treasury-reconciliation.css` | 1466 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 1482 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 1530 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/treasury/treasury-reconciliation.css` | 236 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/treasury-reconciliation.css` | 597 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/treasury-reconciliation.css` | 1239 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/treasury-reconciliation.css` | 1255 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/treasury-reconciliation.css` | 1402 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/treasury-reconciliation.css` | 1416 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/treasury/DayMovementsModal.tsx` | 77 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/DayMovementsModal.tsx` | 145 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/DayMovementsModal.tsx` | 152 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/DayMovementsModal.tsx` | 159 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/DayMovementsModal.tsx` | 77 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="h-6 w-6" />           </bu` |
| `src/components/treasury/BankMappingAssistant.tsx` | 140 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankMappingAssistant.tsx` | 285 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankMappingAssistant.tsx` | 292 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankMappingAssistant.tsx` | 140 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button              onClick={onClose}             className="p-2"           >             <X className="w-5 h-5" />           </button>` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 353 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 400 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 549 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 559 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 565 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/BankStatementPreviewModal.tsx` | 353 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="h-6 w-6" />           </bu` |
| `src/components/treasury/TreasuryUXComponents.tsx` | 293 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryUXComponents.tsx` | 304 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/AccountCard.tsx` | 69 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div        className={`account-card ${isComplete ? 'account-card--complete' : ''} ${disabled ? 'account-card--disabled' : ''}`}       onClick={handleClick}` |
| `src/components/treasury/ReconciliationModal.tsx` | 77 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/ReconciliationModal.tsx` | 115 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/ReconciliationModal.tsx` | 122 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/ReconciliationModal.tsx` | 140 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/ReconciliationModal.tsx` | 146 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/ReconciliationModal.tsx` | 65 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div className="reconciliation-modal-overlay" onClick={handleOverlayClick}>` |
| `src/components/treasury/CSVImportModal.tsx` | 180 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 205 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 314 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 429 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 467 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 480 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/CSVImportModal.tsx` | 491 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 161 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f3f4f6` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 162 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#4b5563` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 863 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 873 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 880 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 972 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1008 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1041 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1067 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1074 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1081 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1088 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1099 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1128 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1153 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1154 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1180 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1181 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1181 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1182 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1182 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1221 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1222 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1249 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1257 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1263 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1264 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1302 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1387 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1390 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1298 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div className="add-movement-modal-overlay" onClick={() =>` |
| `src/components/treasury/TreasuryReconciliationView.tsx` | 1299 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div className="add-movement-modal" onClick={e =>` |
| `src/components/navigation/Header.tsx` | 43 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/navigation/Header.tsx` | 61 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/navigation/Header.tsx` | 78 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Header.tsx` | 108 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Header.tsx` | 115 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Header.tsx` | 122 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Header.tsx` | 130 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Sidebar.tsx` | 57 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/navigation/Sidebar.tsx` | 45 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/navigation/Sidebar.tsx` | 72 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Sidebar.tsx` | 85 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/navigation/Sidebar.tsx` | 73 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/navigation/Sidebar.tsx` | 44 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div         className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${           sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'` |
| `src/components/documents/AutoSaveToggle.tsx` | 42 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 265 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 288 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 330 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 344 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 361 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 487 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 493 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 510 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 521 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 531 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 553 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 560 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 567 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 582 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 609 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 615 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 742 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 748 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentViewer.tsx` | 609 | `V3-4-DELETE-KEBAB` | Acción destructiva fuera de patrón kebab+modal | `<button                  className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"                 onClick={handleDelete}` |
| `src/components/documents/DocumentUploader.tsx` | 396 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentUploader.tsx` | 407 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentUploader.tsx` | 418 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentUploader.tsx` | 434 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentUploader.tsx` | 442 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentUploader.tsx` | 467 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/QueueStatusComponent.tsx` | 88 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div          className="flex items-center justify-between p-3 cursor-pointer"         onClick={() =>` |
| `src/components/documents/DocumentClassificationPanel.tsx` | 241 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentClassificationPanel.tsx` | 260 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentClassificationPanel.tsx` | 279 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentList.tsx` | 138 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/documents/DocumentList.tsx` | 153 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                  className="flex-1 cursor-pointer"                 onClick={() =>` |
| `src/components/personal/gastos/GastoPuntualForm.tsx` | 141 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-opacity-90` |
| `src/components/personal/gastos/GastoPuntualForm.tsx` | 132 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoPuntualForm.tsx` | 139 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 194 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 210 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 217 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 275 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 282 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastosManager.tsx` | 194 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button           onClick={handleAddNew}           className="inline-flex items-center gap-1` |
| `src/components/personal/gastos/GastoRecurrenteList.tsx` | 86 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoRecurrenteList.tsx` | 93 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoRecurrenteList.tsx` | 100 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoPuntualList.tsx` | 83 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoRecurrenteForm.tsx` | 236 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-opacity-90` |
| `src/components/personal/gastos/GastoRecurrenteForm.tsx` | 227 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/GastoRecurrenteForm.tsx` | 234 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 108 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 131 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-gray-900` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 114 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 125 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 194 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 315 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 368 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 375 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/gastos/PersonalExpenseForm.tsx` | 114 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button onClick={onCancel} className="text-gray-400 hover:text-gray-600">             <X className="h-5 w-5" />           </button>` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 27 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 42 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 216 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 230 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 262 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 266 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 350 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 392 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 393 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 416 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 420 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 442 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 500 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 501 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 524 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 528 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 246 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 364 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 369 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 374 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 470 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 475 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 480 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoManager.tsx` | 492 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/personal/autonomo/AutonomoForm.tsx` | 275 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/AutonomoForm.tsx` | 282 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/IngresoForm.tsx` | 197 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/IngresoForm.tsx` | 204 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/GastoForm.tsx` | 251 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/GastoForm.tsx` | 267 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/autonomo/GastoForm.tsx` | 274 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanForm.tsx` | 500 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanForm.tsx` | 507 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanesManager.tsx` | 149 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanesManager.tsx` | 214 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanesManager.tsx` | 247 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanesManager.tsx` | 328 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/planes/PlanesManager.tsx` | 335 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionForm.tsx` | 225 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionForm.tsx` | 260 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionForm.tsx` | 267 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionManager.tsx` | 131 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionManager.tsx` | 177 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionManager.tsx` | 235 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/pension/PensionManager.tsx` | 242 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaManager.tsx` | 96 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaManager.tsx` | 117 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaManager.tsx` | 163 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaManager.tsx` | 170 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaManager.tsx` | 264 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `--c2` |
| `src/components/personal/nomina/NominaManager.tsx` | 283 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `--c2` |
| `src/components/personal/nomina/NominaForm.tsx` | 289 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 295 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 295 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/components/personal/nomina/NominaForm.tsx` | 323 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#d1d5db` |
| `src/components/personal/nomina/NominaForm.tsx` | 324 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#d1fae5` |
| `src/components/personal/nomina/NominaForm.tsx` | 325 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#065f46` |
| `src/components/personal/nomina/NominaForm.tsx` | 325 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#9ca3af` |
| `src/components/personal/nomina/NominaForm.tsx` | 334 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/personal/nomina/NominaForm.tsx` | 341 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#d1d5db` |
| `src/components/personal/nomina/NominaForm.tsx` | 856 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 856 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/components/personal/nomina/NominaForm.tsx` | 864 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/components/personal/nomina/NominaForm.tsx` | 864 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 865 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#9ca3af` |
| `src/components/personal/nomina/NominaForm.tsx` | 879 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/components/personal/nomina/NominaForm.tsx` | 893 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/components/personal/nomina/NominaForm.tsx` | 301 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 317 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 439 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 485 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 486 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 510 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 511 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 535 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 572 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 716 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 858 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 873 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 886 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/nomina/NominaForm.tsx` | 289 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 295 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 295 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#eee` |
| `src/components/personal/nomina/NominaForm.tsx` | 323 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#d1d5db` |
| `src/components/personal/nomina/NominaForm.tsx` | 324 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#d1fae5` |
| `src/components/personal/nomina/NominaForm.tsx` | 325 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#065f46` |
| `src/components/personal/nomina/NominaForm.tsx` | 325 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#9ca3af` |
| `src/components/personal/nomina/NominaForm.tsx` | 341 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#d1d5db` |
| `src/components/personal/nomina/NominaForm.tsx` | 856 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 856 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#eee` |
| `src/components/personal/nomina/NominaForm.tsx` | 864 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#ddd` |
| `src/components/personal/nomina/NominaForm.tsx` | 864 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#f9fafb` |
| `src/components/personal/nomina/NominaForm.tsx` | 865 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#9ca3af` |
| `src/components/personal/nomina/NominaForm.tsx` | 879 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#fff` |
| `src/components/personal/nomina/NominaForm.tsx` | 893 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#fff` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 206 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 222 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 343 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 350 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 389 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 417 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 424 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/personal/otros/OtrosIngresosManager.tsx` | 222 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600">               <X className="w-5 h-5" />             </button>` |
| `src/components/onboarding/OnboardingWizard.tsx` | 236 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/onboarding/OnboardingWizard.tsx` | 298 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/onboarding/OnboardingWizard.tsx` | 332 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/onboarding/OnboardingWizard.tsx` | 341 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/onboarding/OnboardingWizard.tsx` | 351 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/onboarding/OnboardingWizard.tsx` | 360 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/atlas/AtlasBadge.tsx` | 13 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#856404` |
| `src/components/atlas/AtlasBadge.tsx` | 13 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ffeaa7` |
| `src/components/atlas/AtlasComponents.tsx` | 360 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/atlas/AtlasComponents.tsx` | 360 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-opacity-50` |
| `src/components/atlas/AtlasComponents.tsx` | 30 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/atlas/AtlasComponents.tsx` | 264 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/atlas/AtlasComponents.tsx` | 318 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/atlas/AtlasComponents.tsx` | 378 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/atlas/AtlasComponents.tsx` | 264 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="ml-1 p-0.5 rounded hover:bg-gray-100">         <Info size={16} style={{ color: 'var(--text-gray)' }} />       </button>` |
| `src/components/atlas/AtlasComponents.tsx` | 318 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button           onClick={onDismiss}           className="flex-shrink-0 ml-3 p-1 rounded hover:bg-gray-100"         >           <X size={16} style={{ color: 'v` |
| `src/components/atlas/AtlasComponents.tsx` | 378 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onClose}               className="p-1 rounded hover:bg-gray-100"             >               <X size={20} style={{ color: 'var(--` |
| `src/components/atlas/AtlasComponents.tsx` | 359 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div          className="absolute inset-0 bg-black bg-opacity-50"         onClick={onClose}       />` |
| `src/components/atlas/AtlasComponents.tsx` | 264 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button className="ml-1 p-0` |
| `src/components/atlas/AtlasComponents.tsx` | 318 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button           onClick={onDismiss}           className="flex-shrink-0 ml-3 p-1` |
| `src/components/atlas/AtlasComponents.tsx` | 378 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button               onClick={onClose}               className="p-1` |
| `src/components/atlas/AtlasButton.tsx` | 20 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#021530` |
| `src/components/atlas/AtlasButton.tsx` | 22 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#b02a37` |
| `src/components/atlas/AtlasButton.tsx` | 22 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#8b1f2a` |
| `src/components/atlas/AtlasButton.tsx` | 43 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 77 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 132 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 178 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 244 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 317 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleResumen.tsx` | 325 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 114 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 152 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-gray-900` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 121 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 146 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 218 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 327 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 380 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 387 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/OpexRuleForm.tsx` | 121 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button onClick={onCancel} className="text-gray-400 hover:text-gray-600">             <X className="h-5 w-5" />           </button>` |
| `src/components/inmuebles/Step3Coste.tsx` | 570 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 454 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 488 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 559 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 345 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 365 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 383 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 431 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 438 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 441 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 460 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 470 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 494 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 546 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 549 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 571 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 494 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button onClick={resetOneOffForm} className="text-gray-400 hover:text-gray-600">                 <X className="h-4 w-4" />               </button>` |
| `src/components/inmuebles/InmueblePresupuestoTab.tsx` | 345 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button           onClick={openCreateFlow}           className="inline-flex items-center gap-1` |
| `src/components/inmuebles/InmuebleFormCompact.tsx` | 438 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleFormCompact.tsx` | 527 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleFormCompact.tsx` | 673 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleFormCompact.tsx` | 785 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleFormCompact.tsx` | 791 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleWizardLayout.tsx` | 58 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleWizard.tsx` | 525 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleWizard.tsx` | 534 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleWizard.tsx` | 542 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inmuebles/InmuebleWizard.tsx` | 550 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 215 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 234 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 243 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 251 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 259 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 266 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 274 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 421 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 434 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 446 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 458 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/PendingQueue.tsx` | 325 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div               key={doc.id}               className="p-4 cursor-pointer"               onClick={() =>` |
| `src/components/inbox/BankStatementModal.tsx` | 143 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 175 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 195 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 242 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 259 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 266 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementModal.tsx` | 195 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="w-5 h-5" />           </bu` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 70 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 106 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 107 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 68 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 90 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/FEINReviewDrawer.tsx` | 90 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onClose}               className="p-2 hover:bg-gray-100 rounded-lg transition-colors"               style={{ color: 'var(--text-g` |
| `src/components/inbox/DocumentActions.tsx` | 102 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 112 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 151 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 161 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 171 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 177 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentActions.tsx` | 102 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button         onClick={handleView}         className="p-1.5 text-neutral-600 hover:text-neutral-800"         title="Ver documento"       >         <Eye classN` |
| `src/components/inbox/DocumentActions.tsx` | 112 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button           onClick={handleAssign}           className={`p-1.5 ${             isAssigned                ? 'text-primary-600 hover:text-primary-800'` |
| `src/components/inbox/DocumentActions.tsx` | 129 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={handleViewFEINFields}             className="atlas-atlas-atlas-atlas-atlas-btn-primary p-1.5 text-atlas-blue hover:text-primary-800` |
| `src/components/inbox/DocumentActions.tsx` | 139 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={handleOpenInFinanciacion}               className="atlas-atlas-atlas-atlas-atlas-btn-primary p-1.5 text-success-600 hover:text-su` |
| `src/components/inbox/DocumentActions.tsx` | 151 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button         onClick={handleDownload}         className="p-1.5 text-neutral-600 hover:text-neutral-800"         title="Descargar documento"       >         <` |
| `src/components/inbox/DocumentActions.tsx` | 102 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button         onClick={handleView}         className="p-1` |
| `src/components/inbox/DocumentActions.tsx` | 129 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button             onClick={handleViewFEINFields}             className="atlas-atlas-atlas-atlas-atlas-btn-primary p-1` |
| `src/components/inbox/DocumentActions.tsx` | 139 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button               onClick={handleOpenInFinanciacion}               className="atlas-atlas-atlas-atlas-atlas-btn-primary p-1` |
| `src/components/inbox/DocumentActions.tsx` | 151 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button         onClick={handleDownload}         className="p-1` |
| `src/components/inbox/DocumentEditPanel.tsx` | 235 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 253 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 260 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 266 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 630 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 637 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 646 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentEditPanel.tsx` | 235 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="ml-4 h-6 w-6 flex items-center justify-center"           >             <X className="h-5 w-5 text-g` |
| `src/components/inbox/ReformInvoiceEditor.tsx` | 208 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/ReformInvoiceEditor.tsx` | 530 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/ReformInvoiceEditor.tsx` | 537 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/ReformInvoiceEditor.tsx` | 208 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="p-2"           >             <X className="w-5 h-5" />           </button>` |
| `src/components/inbox/BankStatementWizard.tsx` | 493 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 566 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 582 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 833 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 844 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 852 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 864 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/BankStatementWizard.tsx` | 493 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="p-2"           >             <X className="w-5 h-5" />           </button>` |
| `src/components/inbox/DocumentCorrectionWorkflow.tsx` | 269 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentCorrectionWorkflow.tsx` | 355 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentCorrectionWorkflow.tsx` | 420 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/inbox/DocumentCorrectionWorkflow.tsx` | 431 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 83 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/modals/AccountSelectionModal.tsx` | 122 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 158 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 201 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 283 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 315 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 325 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountSelectionModal.tsx` | 122 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={handleCancel}                 className="text-gray-400 hover:text-gray-600"               >                 <X className="w-5 h` |
| `src/components/modals/AccountSelectionModal.tsx` | 81 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className="fixed inset-0 transition-opacity"            style={{ backgroundColor: 'rgba(156, 163, 175, 0.1)' }}           onClick={handleCancel}` |
| `src/components/modals/AccountAssignmentModal.tsx` | 75 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountAssignmentModal.tsx` | 213 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountAssignmentModal.tsx` | 222 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/modals/AccountAssignmentModal.tsx` | 75 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={handleCancel}             className="text-gray-400 hover:text-gray-600"           >             <X className="h-5 w-5" />` |
| `src/components/common/DataTable.tsx` | 146 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/SubTabs.tsx` | 118 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FeatureTour.tsx` | 224 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/common/FeatureTour.tsx` | 240 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/common/FeatureTour.tsx` | 261 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FeatureTour.tsx` | 275 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FeatureTour.tsx` | 290 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FeatureTour.tsx` | 298 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FeatureTour.tsx` | 290 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                   onClick={handlePrevious}                   className="flex items-center gap-1` |
| `src/components/common/FeatureTour.tsx` | 298 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                 onClick={handleNext}                 className="flex items-center gap-1` |
| `src/components/common/KpiCard.tsx` | 29 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div       className={`         bg-white rounded-lg border border-gray-200 p-6          ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-gray-300 tr` |
| `src/components/common/FormFooter.tsx` | 34 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FormFooter.tsx` | 41 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ProgressiveDisclosure.tsx` | 32 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/MobileTable.tsx` | 69 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div             key={index}             onClick={() =>` |
| `src/components/common/FloatingActionButton.tsx` | 94 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FloatingActionButton.tsx` | 141 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FloatingActionButton.tsx` | 81 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div             className="fixed inset-0 -z-10"             onClick={() =>` |
| `src/components/common/SettingsSearch.tsx` | 162 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/SettingsSearch.tsx` | 191 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CommandPalette.tsx` | 285 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CommandPalette.tsx` | 312 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CommandPalette.tsx` | 281 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/common/CommandPalette.tsx` | 254 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div        className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"       onClick={onClose}       role="dialog"       aria-modal="true"` |
| `src/components/common/CommandPalette.tsx` | 265 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div          className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"         onClick={e =>` |
| `src/components/common/CommandPalette.tsx` | 285 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button             onClick={onClose}             className="p-1` |
| `src/components/common/KeyboardShortcutsModal.tsx` | 119 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/KeyboardShortcutsModal.tsx` | 96 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div        className="fixed inset-0 z-50 flex items-center justify-center p-4"       onClick={onClose}       role="dialog"       aria-modal="true"       aria-l` |
| `src/components/common/KeyboardShortcutsModal.tsx` | 107 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div          className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"         onClick={e =>` |
| `src/components/common/ViewModeToggle.tsx` | 27 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ViewModeToggle.tsx` | 43 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ProgressBar.tsx` | 155 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ProgressBar.tsx` | 177 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ModuleSelector.tsx` | 17 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ModuleSelector.tsx` | 28 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ConfirmationModal.tsx` | 104 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ConfirmationModal.tsx` | 117 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ConfirmationModal.tsx` | 133 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ConfirmationModal.tsx` | 70 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className="fixed inset-0 bg-white/80 backdrop-blur-sm transition-opacity"            onClick={onClose}           aria-hidden="true"         />` |
| `src/components/common/Tooltip.tsx` | 58 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Tooltip.tsx` | 50 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div        className="relative inline-flex items-center"       onMouseEnter={handleMouseEnter}       onMouseLeave={handleMouseLeave}       onClick={handleClick` |
| `src/components/common/Tooltip.tsx` | 58 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button            className="ml-1.5 p-0` |
| `src/components/common/ErrorBoundary.tsx` | 70 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/ErrorBoundary.tsx` | 78 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Drawer.tsx` | 91 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Drawer.tsx` | 109 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Drawer.tsx` | 118 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Drawer.tsx` | 72 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div         className="absolute inset-0 bg-gray-200 transition-opacity"         onClick={onClose}       />` |
| `src/components/common/PageHeader.tsx` | 75 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/PageHeader.tsx` | 102 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/PageHeader.tsx` | 112 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FormErrorSummary.tsx` | 63 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FavoritesWidget.tsx` | 141 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/FavoritesWidget.tsx` | 234 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/EmptyState.tsx` | 43 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Glossary.tsx` | 153 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/common/Glossary.tsx` | 102 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Glossary.tsx` | 117 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/Glossary.tsx` | 212 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CopilotWidget.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CopilotWidget.tsx` | 95 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/common/CopilotWidget.tsx` | 109 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/properties/PropertyForm.tsx` | 116 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/properties/PropertyCard.tsx` | 12 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div        className={`bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow ${         isSelected ? 'ring-2 ring-atlas-blue'` |
| `src/components/tours/TourManager.tsx` | 80 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/tours/TourManager.tsx` | 107 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/tours/TourManager.tsx` | 107 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/components/tours/TourManager.tsx` | 116 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/kpi/KpiBuilder.tsx` | 233 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/kpi/KpiBuilder.tsx` | 500 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/kpi/KpiBuilder.tsx` | 509 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/kpi/KpiBuilder.tsx` | 528 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/kpi/KpiBuilder.tsx` | 193 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/MesaAtlasPlanDrawer.tsx` | 28 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/FlujosGrid.tsx` | 97 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/FlujosGrid.tsx` | 167 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/FlujosGrid.tsx` | 237 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/FlujosGrid.tsx` | 97 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/FlujosGrid.tsx` | 167 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/FlujosGrid.tsx` | 237 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/FlujosGrid.tsx` | 80 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/FlujosGrid.tsx` | 150 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/FlujosGrid.tsx` | 220 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 25 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 27 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 46 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 49 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 28 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 41 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 41 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 41 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 42 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 61 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/PulsePresetShowcase.tsx` | 74 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/InvestorAlertsCard.tsx` | 131 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/InvestorAlertsCard.tsx` | 120 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div               key={alert.id}               onClick={() =>` |
| `src/components/dashboard/KpiCard.tsx` | 8 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/components/dashboard/KpiCard.tsx` | 14 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/components/dashboard/KpiCard.tsx` | 14 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/components/dashboard/KpiCard.tsx` | 14 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `teal-` |
| `src/components/dashboard/LiquidezSection.tsx` | 79 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/LiquidezSection.tsx` | 312 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/LiquidezSection.tsx` | 313 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/LiquidezSection.tsx` | 79 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/QuickActions.tsx` | 60 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#03356b` |
| `src/components/dashboard/QuickActions.tsx` | 62 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/QuickActions.tsx` | 98 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/QuickActions.tsx` | 40 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/QuickActions.tsx` | 75 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/QuickActions.tsx` | 112 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/QuickActions.tsx` | 60 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#03356b` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 64 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 66 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 95 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 95 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 97 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 131 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 133 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 98 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 108 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 108 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 108 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 109 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 133 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 133 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardBlockBase.tsx` | 133 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 125 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 134 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 154 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 173 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 180 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 211 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 211 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 125 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 134 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 154 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 173 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#e0e0e0` |
| `src/components/dashboard/InvestorDashboardV2.tsx` | 180 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#e0e0e0` |
| `src/components/dashboard/SaludFinanciera.tsx` | 82 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/SaludFinanciera.tsx` | 82 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/MesaAtlasCard.tsx` | 38 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/BolsilloCard.tsx` | 64 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/BolsilloCard.tsx` | 75 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/BolsilloCard.tsx` | 80 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/BolsilloCard.tsx` | 64 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/BolsilloCard.tsx` | 75 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/BolsilloCard.tsx` | 80 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/BolsilloCard.tsx` | 54 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/RecentItemsWidget.tsx` | 192 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/RecentItemsWidget.tsx` | 205 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardConfig.tsx` | 293 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardConfig.tsx` | 350 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardConfig.tsx` | 359 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardConfig.tsx` | 368 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/DashboardConfig.tsx` | 329 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `brand-teal` |
| `src/components/dashboard/DashboardConfig.tsx` | 427 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                   key={blockId}                   className={`                     border border-neutral-200 p-4 cursor-pointer                     ${isAct` |
| `src/components/dashboard/DashboardConfig.tsx` | 293 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button             {...attributes}             {...listeners}             className="text-neutral-400 hover:text-neutral-600 cursor-grab active:cursor-grabbing` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 50 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 56 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 60 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 60 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 168 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 168 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 169 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 169 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 177 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 177 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 96 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 107 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 157 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 99 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 111 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/dashboard/PulseDashboardHero.tsx` | 163 | `V3-3-INPUT-FOCUS` | Focus obligatorio (border --blue + outline + focus-ring) | `focus:outline-none` |
| `src/components/dashboard/TesoreriaPanel.tsx` | 77 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/TesoreriaPanel.tsx` | 90 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/PatrimonioHeader.tsx` | 156 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 152 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 170 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 417 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 152 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 170 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 205 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 253 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 393 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 409 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 417 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#fff` |
| `src/components/dashboard/ActualizacionValoresDrawer.tsx` | 147 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div         onClick={onClose}         style={{           position: 'fixed',           inset: 0,           backgroundColor: 'rgba(0,0,0,0.35)',           zIndex` |
| `src/components/dashboard/AlertasSection.tsx` | 113 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/AlertasSection.tsx` | 166 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/AlertasSection.tsx` | 231 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/dashboard/AlertasSection.tsx` | 113 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/AlertasSection.tsx` | 166 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/AlertasSection.tsx` | 231 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0, 0, 0,` |
| `src/components/dashboard/AlertasSection.tsx` | 211 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dev/DiagnosticDashboard.tsx` | 68 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dev/QADashboard.tsx` | 112 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dev/QADashboard.tsx` | 163 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/dev/QADashboard.tsx` | 112 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="p-2"           >             <XCircle className="h-5 w-5" />           </button>` |
| `src/components/financiacion/FEINValidation.tsx` | 113 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 148 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 161 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 338 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 352 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 835 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 844 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINValidation.tsx` | 148 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-atlas transition-colors">               <ArrowLeft className="h-5 w-5" />             </button` |
| `src/components/financiacion/FEINExtractionDrawer.tsx` | 49 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/components/financiacion/FEINExtractionDrawer.tsx` | 47 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINExtractionDrawer.tsx` | 70 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINExtractionDrawer.tsx` | 70 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onClose}               className="p-2"             >               <X className="h-5 w-5" style={{ color: 'var(--text-gray)' }} /` |
| `src/components/financiacion/FEINUploader.tsx` | 210 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/components/financiacion/FEINUploader.tsx` | 259 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/utils/accountHelpers.ts` | 103 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EC0000` |
| `src/utils/accountHelpers.ts` | 110 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#004481` |
| `src/utils/accountHelpers.ts` | 117 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0066CC` |
| `src/utils/accountHelpers.ts` | 124 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0063B2` |
| `src/utils/accountHelpers.ts` | 131 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FF6600` |
| `src/utils/accountHelpers.ts` | 138 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#00A000` |
| `src/utils/accountHelpers.ts` | 195 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `hsl(` |
| `src/services/promptService.tsx` | 81 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button               onClick={handleCancel}               className="atlas-atlas-atlas-atlas-atlas-atlas-btn-ghost p-1` |
| `src/services/fiscalConciliationService.ts` | 1 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/services/toastService.tsx` | 55 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/services/__tests__/fiscalConciliationService.test.ts` | 1 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/services/__tests__/irpfCalculationService.test.ts` | 1 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/services/__tests__/irpfCalculationService.test.ts` | 101 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/services/__tests__/nominaService.test.ts` | 1 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/services/__tests__/nominaService.test.ts` | 1 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#414` |
| `src/tests/irpfAccesorios.test.ts` | 1 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#414` |
| `src/modules/personal/components/ProfileView.tsx` | 20 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/personal/components/ProfileView.tsx` | 50 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#D1D5DB` |
| `src/modules/personal/components/ProfileView.tsx` | 280 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/personal/components/ProfileView.tsx` | 294 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/personal/components/ProfileView.tsx` | 45 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/personal/components/ProfileView.tsx` | 522 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/personal/components/ProfileView.tsx` | 568 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/personal/components/ProfileView.tsx` | 656 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/personal/components/ProfileView.tsx` | 719 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/personal/components/ProfileView.tsx` | 737 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/cobros/pendientes/CobrosPendientes.tsx` | 140 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/automatizaciones/reglas/AutomatizacionesReglas.tsx` | 14 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 77 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 84 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 126 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 129 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 141 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 204 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 207 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 210 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 126 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">                   <Search className="h-4 w-4" />                 </button>` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 129 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">                   <Filter className="h-4 w-4" />                 </button>` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 204 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="text-neutral-400 hover:text-neutral-600">                             <Edit2 className="h-4 w-4" />                           </button>` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 207 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="text-neutral-400 hover:text-primary-600">                             <Link className="h-4 w-4" />                           </button>` |
| `src/modules/pulse/tesoreria-personal/movimientos/TPMovimientos.tsx` | 210 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="text-neutral-400 hover:text-error-600">                             <Trash2 className="h-4 w-4" />                           </button>` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 176 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 176 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 241 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 241 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 253 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 253 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 291 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 291 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 300 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 300 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 317 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 317 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 340 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 340 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 185 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/firmas/plantillas/PandaDocTemplateBuilder.tsx` | 366 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/tareas/pendientes/TareasPendientes.tsx` | 14 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/pulse/contratos/lista/ContratosLista.tsx` | 178 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/InversionesPage.tsx` | 170 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/InversionesPage.tsx` | 187 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/InversionesPage.tsx` | 227 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/InversionesPage.tsx` | 240 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/InversionesPage.tsx` | 337 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/CarteraResumen.tsx` | 81 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionCard.tsx` | 112 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionCard.tsx` | 124 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionCard.tsx` | 112 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/modules/horizon/inversiones/components/PosicionCard.tsx` | 198 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 46 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 55 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FFFFFF` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 56 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#E2E5EE` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 57 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 79 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 171 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 188 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/ActualizarValorModal.tsx` | 79 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--gray-500)' }}` |
| `src/modules/horizon/inversiones/components/RendimientosTab.tsx` | 131 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 57 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f97316` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 58 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#8b5cf6` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 71 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 80 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FFFFFF` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 81 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#E2E5EE` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 82 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 334 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0d9488` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 334 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#dc2626` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 115 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 239 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 385 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 405 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 425 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionDetailModal.tsx` | 115 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--gray-500)' }}` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 402 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FFFFFF` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 412 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 430 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 431 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#E2E5EE` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 830 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 73 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 454 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 882 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 1101 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 1118 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/PosicionForm.tsx` | 454 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             type="button"             onClick={onClose}             style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', c` |
| `src/modules/horizon/inversiones/components/PreviewCard.tsx` | 43 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f0fdfa` |
| `src/modules/horizon/inversiones/components/PreviewCard.tsx` | 44 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#99f6e4` |
| `src/modules/horizon/inversiones/components/PreviewCard.tsx` | 48 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0d9488` |
| `src/modules/horizon/inversiones/components/PreviewCard.tsx` | 72 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0d9488` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 106 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 222 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0d9488` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 222 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#dc2626` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 106 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 136 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 259 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 262 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inversiones/components/AportacionForm.tsx` | 136 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-gray)' }` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 13 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fef9c3` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 13 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#854d0e` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 14 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ccfbf1` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 14 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#0d9488` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 15 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#dbeafe` |
| `src/modules/horizon/inversiones/components/StatusBadge.tsx` | 15 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1d4ed8` |
| `src/modules/horizon/fiscalidad/historico/HistoricoPage.tsx` | 98 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/fiscalidad/historico/HistoricoPage.tsx` | 130 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/fiscalidad/historico/HistoricoPage.tsx` | 130 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 237 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 261 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 341 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 363 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 371 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 475 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 483 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 601 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 363 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                 title="Ver conciliación"                                 className="text-primary-600 hover:text-primary-800"` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 371 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                 title="Ver contrato"                                 className="text-cyan-700 hover:text-cyan-900"` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 475 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                       title="Ver conciliación bancaria"                                       className="text-cyan-700 hover:text-cyan-9` |
| `src/modules/horizon/fiscalidad/detalle/Detalle.tsx` | 483 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                       title="Ver documento"                                       className="text-primary-600 hover:text-primary-800"` |
| `src/modules/horizon/fiscalidad/resumen/Resumen.tsx` | 342 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/components/HistoricalReconstructionModal.tsx` | 121 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/components/HistoricalReconstructionModal.tsx` | 279 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/components/HistoricalReconstructionModal.tsx` | 288 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/components/HistoricalReconstructionModal.tsx` | 308 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/components/HistoricalReconstructionModal.tsx` | 121 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             disabled={isProcessing}             className="text-gray-400 hover:text-gray-600 disabled:opacity-50"` |
| `src/modules/horizon/fiscalidad/simulador/SimuladorPage.tsx` | 136 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/simulador/SimuladorPage.tsx` | 157 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/simulador/SimuladorPage.tsx` | 182 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/simulador/SimuladorPage.tsx` | 196 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/pagos/PagosPage.tsx` | 133 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/pagos/PagosPage.tsx` | 180 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/fiscalidad/declaracion/DeclaracionPage.tsx` | 17 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `--atlas-teal` |
| `src/modules/horizon/panel/components/AccountsSection.tsx` | 214 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AccountsSection.tsx` | 224 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AccountsSection.tsx` | 231 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AccountsSection.tsx` | 238 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 129 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 135 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 157 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 162 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 167 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 172 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 177 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 199 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 206 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/HorizonVisualPanel.tsx` | 238 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/CompactAlertsSection.tsx` | 98 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/CompactAlertsSection.tsx` | 108 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/CompactAlertsSection.tsx` | 118 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/RentsSection.tsx` | 86 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/RentsSection.tsx` | 101 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AccountsCompactSection.tsx` | 196 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AccountsCompactSection.tsx` | 196 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="p-0.5 text-hz-neutral-400 hover:text-hz-neutral-600 flex-shrink-0">                 <MoreHorizontal className="w-3 h-3" />               </bu` |
| `src/modules/horizon/panel/components/AccountsCompactSection.tsx` | 196 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button className="p-0` |
| `src/modules/horizon/panel/components/AlertsSection.tsx` | 203 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AlertsSection.tsx` | 210 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AlertsSection.tsx` | 217 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/AlertsSection.tsx` | 224 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/ExpensesCompactSection.tsx` | 113 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/ExpensesCompactSection.tsx` | 113 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button            onClick={handleOpenBudget}           className="flex items-center gap-1` |
| `src/modules/horizon/panel/components/RentsCompactSection.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/RentsCompactSection.tsx` | 84 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/RentsCompactSection.tsx` | 60 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button              onClick={handleOpenContracts}             className="flex items-center gap-1` |
| `src/modules/horizon/panel/components/RentsCompactSection.tsx` | 84 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button            onClick={handleOpenContracts}           className="flex items-center gap-1` |
| `src/modules/horizon/panel/components/IncomeExpensesSection.tsx` | 96 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/ExpensesSection.tsx` | 120 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/TimelineSection.tsx` | 98 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/panel/components/TimelineSection.tsx` | 98 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button            onClick={handleOpenRadar}           className="flex items-center gap-1` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 171 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 388 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 183 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 196 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 290 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 306 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 313 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 400 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 413 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 112 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div              onClick={() =>` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 130 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div              onClick={() =>` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 148 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div              onClick={() =>` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 170 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                  className="fixed inset-0 bg-black/40 transition-opacity"                 onClick={() =>` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 245 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                     key={scenario.id}                     onClick={() =>` |
| `src/modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones.tsx` | 387 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                  className="fixed inset-0 bg-black/40 transition-opacity"                 onClick={() =>` |
| `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` | 168 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f9fafb` |
| `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` | 58 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/valoraciones/Valoraciones.tsx` | 168 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#f9fafb` |
| `src/modules/horizon/proyeccion/presupuesto/PresupuestosView.tsx` | 53 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/ProyeccionPresupuesto.tsx` | 88 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/ProyeccionPresupuesto.tsx` | 126 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepRevisionNuevo.tsx` | 216 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepRevisionNuevo.tsx` | 224 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 230 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 323 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 330 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 230 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                     onClick={onAddLine}                     className="p-1 text-primary-600 hover:text-primary-800"                     title="Añadir fi` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 207 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div         onClick={() =>` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetTableEditor.tsx` | 230 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                     onClick={onAddLine}                     className="p-1` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepAlcance.tsx` | 180 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepAlcance.tsx` | 187 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepAlcance.tsx` | 258 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoLineaModal.tsx` | 161 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoLineaModal.tsx` | 453 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoLineaModal.tsx` | 489 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoLineaModal.tsx` | 161 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onCancel}               className="text-gray-400 hover:text-gray-600"             >               <X className="h-6 w-6" />` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoTablaLineas.tsx` | 143 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoTablaLineas.tsx` | 150 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoTablaLineas.tsx` | 157 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepConfiguracion.tsx` | 297 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/ScopedBudgetView.tsx` | 145 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/ScopedBudgetView.tsx` | 161 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoHeader.tsx` | 72 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoHeader.tsx` | 89 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/PresupuestoHeader.tsx` | 97 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | 103 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | 110 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | 118 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | 126 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetList.tsx` | 103 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button className="p-2 text-gray-400 hover:text-gray-600">                     <MoreVertical className="h-4 w-4" />                   </button>` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetWizard.tsx` | 131 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetWizard.tsx` | 144 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/BudgetWizard.tsx` | 144 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onCancel}               className="text-gray-400 hover:text-gray-600 transition-colors"             >               <X className=` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepScopeSelection.tsx` | 263 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepScopeSelection.tsx` | 72 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className={`relative border-2 p-6 cursor-pointer transition-all ${             selectedScopes.includes('PERSONAL')               ? 'border-prima` |
| `src/modules/horizon/proyeccion/presupuesto/components/WizardStepScopeSelection.tsx` | 115 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className={`relative border-2 p-6 cursor-pointer transition-all ${             selectedScopes.includes('INMUEBLES')               ? 'border-prim` |
| `src/modules/horizon/proyeccion/escenarios/ProyeccionEscenarios.tsx` | 80 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 183 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 226 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 237 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 257 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 294 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/escenarios/components/ScenarioManagement.tsx` | 308 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx` | 114 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx` | 183 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativas/ProyeccionComparativas.tsx` | 343 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx` | 132 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#031F47` |
| `src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx` | 130 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/ProyeccionComparativa.tsx` | 132 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#031F47` |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | 87 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | 104 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | 122 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | 150 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/ExportModal.tsx` | 87 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600 transition-colors"           >             <X className="h-6 w-6"` |
| `src/modules/horizon/proyeccion/comparativa/components/MonthlyDetailModal.tsx` | 109 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/MonthlyDetailModal.tsx` | 144 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/comparativa/components/MonthlyDetailModal.tsx` | 109 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600 transition-colors"           >             <X className="h-6 w-6"` |
| `src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx` | 279 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/mensual/ProyeccionMensual.tsx` | 298 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx` | 24 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx` | 33 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx` | 51 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/mensual/components/YearSelector.tsx` | 59 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 73 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 203 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 215 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 221 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 73 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onClose}               className="p-2"             >               <X className="h-5 w-5 text-gray-500" />             </button>` |
| `src/modules/horizon/proyeccion/base/components/AdjustAssumptionsModal.tsx` | 56 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className="fixed inset-0 bg-gray-500 transition-opacity"           onClick={onClose}         />` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 23 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#042C5E` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 24 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#5B8DB8` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 25 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1DA0BA` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 26 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#C8D0DC` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 27 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#6C757D` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 28 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#EEF1F5` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 29 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#FFFFFF` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 30 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#C8D0DC` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 67 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 23 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#042C5E` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 24 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `--c2` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 24 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#5B8DB8` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 25 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#1DA0BA` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 26 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#C8D0DC` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 27 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#6C757D` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 28 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#EEF1F5` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 29 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#FFFFFF` |
| `src/modules/horizon/proyeccion/base/components/ProjectionChart.tsx` | 30 | `V3-5-CHART-PALETTE` | Asignación de paleta no estable c1..c6 | `#C8D0DC` |
| `src/modules/horizon/tesoreria/AccountDetailPage.tsx` | 256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/AccountDetailPage.tsx` | 305 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/AccountDetailPage.tsx` | 316 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/TreasuryMainView.tsx` | 320 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/TreasuryMainView.tsx` | 355 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                   key={account.id}                   className={`rounded-lg border p-6 cursor-pointer transition-all ${                     isInactive` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 288 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 344 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 405 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 488 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 495 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/NewMovementModal.tsx` | 288 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={handleClose}               className="text-hz-neutral-500 hover:text-hz-text"             >               <X className="w-5 h-5"` |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | 186 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | 249 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | 327 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | 335 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/ImportModal.tsx` | 186 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={handleClose}                 className="text-hz-neutral-500 hover:text-hz-text"               >                 <X className="w` |
| `src/modules/horizon/tesoreria/movimientos/Movimientos.tsx` | 258 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/Movimientos.tsx` | 371 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/Movimientos.tsx` | 377 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/Movimientos.tsx` | 388 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/movimientos/Movimientos.tsx` | 397 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/radar/Radar.tsx` | 274 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/radar/Radar.tsx` | 373 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/CAPEXPanel.tsx` | 153 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/CAPEXPanel.tsx` | 340 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/CAPEXPanel.tsx` | 455 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/CAPEXPanel.tsx` | 462 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/IngresosPanel.tsx` | 178 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/IngresosPanel.tsx` | 361 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/IngresosPanel.tsx` | 502 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/IngresosPanel.tsx` | 509 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/RadarPanel.tsx` | 241 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/RadarPanel.tsx` | 382 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 296 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 304 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 312 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 403 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 427 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 508 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 514 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 531 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 554 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 560 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 650 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 657 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovimientosPanel.tsx` | 427 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={cancelEdit}                 className="text-gray-400 hover:text-gray-600"               >                 <X className="w-5 h-5` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 185 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 384 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 392 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 434 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 440 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 454 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 471 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 185 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               onClick={onClose}               className="p-2"             >               <X className="h-5 w-5 text-hz-neutral-700" />             </bu` |
| `src/modules/horizon/tesoreria/components/MovementDrawer.tsx` | 172 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div          className="absolute inset-0 bg-gray-200"         onClick={onClose}       />` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 88 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 115 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 127 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 139 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 202 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 209 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/PaidWithoutStatementModal.tsx` | 88 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="w-5 h-5" />           </bu` |
| `src/modules/horizon/tesoreria/components/GastosPanel.tsx` | 217 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/GastosPanel.tsx` | 393 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/GastosPanel.tsx` | 556 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/GastosPanel.tsx` | 563 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/ImportStatementModal.tsx` | 190 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/ImportStatementModal.tsx` | 309 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/ImportStatementModal.tsx` | 316 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/ImportStatementModal.tsx` | 190 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={handleClose}             className="text-hz-neutral-500 hover:text-hz-neutral-700"           >             <X className="h-6 w-6" /` |
| `src/modules/horizon/tesoreria/components/AccountCard.tsx` | 79 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 221 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 233 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 243 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 268 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 289 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 300 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 308 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 315 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 438 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 573 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 579 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AutomatizacionesPanel.tsx` | 438 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={closeModal}                 className="text-gray-400 hover:text-gray-600"               >                 <X className="w-5 h-5` |
| `src/modules/horizon/tesoreria/components/AccountCalendar.tsx` | 254 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AccountCalendar.tsx` | 269 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AccountCalendar.tsx` | 299 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AccountCalendar.tsx` | 402 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/AccountCalendar.tsx` | 383 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                         key={movement.id}                         className={getMovementStyle(movement)}                         onClick={() =>` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 195 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 298 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 318 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 326 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 195 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="p-2 text-hz-neutral-600 hover:text-hz-neutral-900"           >             <X size={20} />` |
| `src/modules/horizon/tesoreria/components/DayMovementDrawer.tsx` | 291 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                               onClick={handleSaveEdit}                               className="atlas-atlas-atlas-atlas-atlas-btn-primary flex items-cen` |
| `src/modules/horizon/tesoreria/components/NewTransferModal.tsx` | 160 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/NewTransferModal.tsx` | 182 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/NewTransferModal.tsx` | 337 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/NewTransferModal.tsx` | 345 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/tesoreria/components/NewTransferModal.tsx` | 160 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={handleClose}             className="text-gray-400 hover:text-gray-600"           >             <X className="h-6 w-6" />` |
| `src/modules/horizon/personal/Personal.tsx` | 228 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 95 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 117 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 132 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 249 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 259 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/PrestamoDetail.tsx` | 117 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                onClick={onBack}               className="text-gray-500 hover:text-atlas-blue transition-colors"             >               <ChevronRigh` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationPanel.tsx` | 62 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationPanel.tsx` | 111 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 42 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 42 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 44 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 44 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 44 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1DA0BA` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 79 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/StandardBonificationsSelector.tsx` | 91 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 78 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 92 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 164 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 181 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 287 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 92 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={onClose}                 className="text-gray-500 hover:text-gray-700 transition-colors"               >                 <X cla` |
| `src/modules/horizon/inmuebles/prestamos/components/AmortizationSimulator.tsx` | 76 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div            className="fixed inset-0 transition-opacity"           style={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)' }}` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 102 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 109 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 128 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 143 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 390 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 109 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button               type="button"               onClick={onRemove}               className="text-error-500 hover:text-error-700"             >               <` |
| `src/modules/horizon/inmuebles/prestamos/components/BonificationForm.tsx` | 128 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button           type="button"           onClick={onRemove}           className="text-error-500 hover:text-error-700"         >           <X className="h-4 w-4` |
| `src/modules/horizon/inmuebles/gastos/Gastos.tsx` | 344 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos/Gastos.tsx` | 507 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/ingresos/Ingresos.tsx` | 274 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/ingresos/Ingresos.tsx` | 391 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/Contratos.tsx` | 114 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 818 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 950 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 964 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 1140 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 1151 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 1168 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsNuevo.tsx` | 1175 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 362 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 369 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 380 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 389 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 413 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 475 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 482 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCobros.tsx` | 389 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                           className="text-neutral-600 hover:text-neutral-800 transition-colors"                           title="Adjuntar justificante"` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 452 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 458 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 545 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 564 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 572 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 600 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 609 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 618 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 627 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 636 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 645 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 654 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 663 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 672 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 767 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 781 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 796 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 805 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 814 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 831 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsListaEnhanced.tsx` | 839 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 308 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 315 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 324 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 411 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 418 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 427 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 308 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                               onClick={saveEdit}                               className="text-success-600 hover:text-success-800 transition-colors"` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 315 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                               onClick={cancelEdit}                               className="text-neutral-600 hover:text-neutral-800 transition-colors"` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 411 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                     onClick={saveEdit}                                     className="text-success-600 hover:text-success-800 transition` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsCalendario.tsx` | 418 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                                     onClick={cancelEdit}                                     className="text-neutral-600 hover:text-neutral-800 transiti` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 194 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 289 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 297 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 305 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 314 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/contratos/components/ContractsLista.tsx` | 297 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                             className="text-neutral-600 hover:text-neutral-800 transition-colors"                             title="Adjuntos"` |
| `src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx` | 263 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx` | 275 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx` | 317 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx` | 711 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/PropertyDetail.tsx` | 722 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 261 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 296 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 409 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 416 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 426 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 432 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 438 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 444 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 451 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/cartera/Cartera.tsx` | 459 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/GastosCapex.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 388 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 417 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 487 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 495 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 502 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 509 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 487 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                             className="text-brand-navy hover:text-navy-800 p-1"                             title="Ver documento"` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 495 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                             className="text-success-600 hover:text-success-800 p-1"                             title="Conciliar"` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 487 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                             className="text-brand-navy hover:text-navy-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/GastosTab.tsx` | 495 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                             className="text-success-600 hover:text-success-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ExpenseFormModal.tsx` | 141 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ExpenseFormModal.tsx` | 373 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ExpenseFormModal.tsx` | 380 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ExpenseFormModal.tsx` | 141 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600 transition-colors"           >             <XIcon className="h-6` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 217 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 239 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 429 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 437 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 444 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 453 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 429 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             className="text-brand-navy hover:text-navy-800 p-1"             title="Ver detalles"           >             <EyeIcon className="h-4 w-4" />` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 437 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={onEdit}                 className="text-brand-navy hover:text-navy-800 p-1"                 title="Editar"               >` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 444 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={onClose}                 className="text-success-600 hover:text-success-800 p-1"                 title="Cerrar reforma"` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 453 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onDelete}             className="text-error-600 hover:text-error-800 p-1"             title="Eliminar"           >             <Tra` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 429 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button             className="text-brand-navy hover:text-navy-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 437 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                 onClick={onEdit}                 className="text-brand-navy hover:text-navy-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 444 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button                 onClick={onClose}                 className="text-success-600 hover:text-success-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/CapexTab.tsx` | 453 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button             onClick={onDelete}             className="text-error-600 hover:text-error-800 p-1` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ReformFormModal.tsx` | 84 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ReformFormModal.tsx` | 186 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ReformFormModal.tsx` | 193 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ReformFormModal.tsx` | 84 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button             onClick={onClose}             className="text-gray-400 hover:text-gray-600 transition-colors"           >             <XIcon className="h-6` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ResumenTab.tsx` | 276 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ResumenTab.tsx` | 276 | `V3-2-TEAL-IMPORTE` | --teal no se usa para KPIs/importes | `teal` |
| `src/modules/horizon/inmuebles/gastos-capex/components/ResumenTab.tsx` | 216 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/components/PropertySaleModal.tsx` | 109 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `bg-black` |
| `src/modules/horizon/inmuebles/components/PropertySaleModal.tsx` | 180 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/components/PropertySaleModal.tsx` | 183 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/analisis/Analisis.tsx` | 39 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#D1D5DB` |
| `src/modules/horizon/inmuebles/analisis/Analisis.tsx` | 40 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#374151` |
| `src/modules/horizon/inmuebles/analisis/Analisis.tsx` | 41 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#1D4ED8` |
| `src/modules/horizon/inmuebles/analisis/Analisis.tsx` | 42 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#059669` |
| `src/modules/horizon/inmuebles/analisis/components/RecommendationActionSection.tsx` | 44 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/analisis/components/RecommendationActionSection.tsx` | 52 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/analisis/components/RecommendationActionSection.tsx` | 60 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/capex/CAPEX.tsx` | 329 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/inmuebles/capex/CAPEX.tsx` | 465 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx` | 146 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx` | 155 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx` | 203 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx` | 249 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx` | 256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 147 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 160 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 174 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 209 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 285 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 305 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 311 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 341 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 368 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/preferencias-datos/PreferenciasDatos.tsx` | 375 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/CuentasNewContainer.tsx` | 51 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 343 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 351 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 368 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 383 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 550 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 558 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 599 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 607 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/CuentasManagement.tsx` | 374 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middl` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 369 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 420 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 428 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 439 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 452 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 461 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 512 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 574 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 582 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 626 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/ReglasAlertas.tsx` | 632 | `V3-4-DELETE-KEBAB` | Acción destructiva fuera de patrón kebab+modal | `<button                 onClick={handleConfirmDelete}                 className="atlas-atlas-atlas-atlas-atlas-btn-destructive inline-flex items-center px-4 py-` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 429 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 475 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 482 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 506 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 605 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 663 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 671 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 715 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 722 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/BancosManagement.tsx` | 506 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                   onClick={handleCloseModal}                   className="text-text-gray hover:text-atlas-navy-1"                 >                   <X` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 465 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 484 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 496 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 508 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 528 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 566 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 641 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 807 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 814 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 847 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 892 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 898 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 641 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={handleCloseModal}                 className="text-gray-400 hover:text-gray-600"               >                 <X className="w` |
| `src/modules/horizon/configuracion/cuentas/components/AtlasBancosManagement.tsx` | 474 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div              className="fixed inset-0 z-10"              onClick={() =>` |
| `src/modules/horizon/configuracion/cuentas/components/AccountAnalytics.tsx` | 176 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 376 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 384 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 392 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 433 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 457 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 472 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 609 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/configuracion/email-entrante/EmailEntrante.tsx` | 633 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/CollapsibleSection.tsx` | 23 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/LiveCalculationFooter.tsx` | 25 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/LiveCalculationFooter.tsx` | 26 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 236 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 262 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 284 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 292 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 299 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#f3f4f6` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 324 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 331 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 448 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 486 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 331 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 354 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 361 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 368 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 349 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div             className="group-hover:opacity-100"             style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }}             onClic` |
| `src/modules/horizon/financiacion/components/PrestamosList.tsx` | 424 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div           style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, cursor: 'pointer', userSelect: 'none' }}` |
| `src/modules/horizon/financiacion/components/PrestamoDetailPage.tsx` | 79 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailPage.tsx` | 90 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/AutosaveIndicator.tsx` | 21 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosCreation.tsx` | 382 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosCreation.tsx` | 403 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosCreation.tsx` | 418 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosCreation.tsx` | 461 | `V3-6-DIV-ONCLICK` | Interacción en div no semántico | `<div                className="px-6 py-4 border-b border-gray-200 cursor-pointer"               onClick={() =>` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 270 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 338 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 340 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 359 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 387 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 407 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 340 | `V3-2-DARK-OVERLAY` | Uso de overlays/temas oscuros no alineados con sistema v3 | `rgba(0,0,0,` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 279 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 350 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 376 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamosWizard.tsx` | 397 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/ProgressBar.tsx` | 28 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/CuadroAmortizacion.tsx` | 226 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/CuadroAmortizacion.tsx` | 234 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/Stepper.tsx` | 20 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/Stepper.tsx` | 41 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/Stepper.tsx` | 44 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/Stepper.tsx` | 77 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/Stepper.tsx` | 24 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 46 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 188 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 195 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 397 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 188 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={handleExportPDF}                 className="p-2 text-text-gray hover:text-atlas-blue transition-colors"                 title="` |
| `src/modules/horizon/financiacion/components/PrestamoDetailDrawer.tsx` | 195 | `V3-6-ARIA-ICON-BUTTON` | Botón icon-only sin nombre accesible | `<button                 onClick={handleExportExcel}                 className="p-2 text-text-gray hover:text-atlas-blue transition-colors"                 title` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 157 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 203 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 336 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 347 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 488 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/CondicionesFinancierasBlock.tsx` | 499 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/BonificacionesBlock.tsx` | 296 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/BonificacionesBlock.tsx` | 324 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/BonificacionesBlock.tsx` | 380 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/BonificacionesBlock.tsx` | 390 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/BonificacionesBlock.tsx` | 500 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx` | 103 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx` | 121 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx` | 158 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx` | 208 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/blocks/IdentificacionBlock.tsx` | 340 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 19 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 136 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 223 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 281 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 286 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 304 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 304 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ResumenStep.tsx` | 256 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 32 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 118 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 121 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 142 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 172 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 174 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 194 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 234 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 270 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#fff` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 280 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 135 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 183 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 214 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 262 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/BonificacionesStep.tsx` | 278 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 15 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 19 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 39 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 86 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 86 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 150 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 150 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 94 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 97 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/ImportacionStep.tsx` | 100 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/EstructuraStep.tsx` | 11 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/EstructuraStep.tsx` | 15 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/EstructuraStep.tsx` | 35 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/EstructuraStep.tsx` | 106 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/EstructuraStep.tsx` | 135 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx` | 14 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx` | 18 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx` | 38 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx` | 74 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/IdentificacionStep.tsx` | 176 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/steps/ConfiguracionStep.tsx` | 21 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#ddd` |
| `src/modules/horizon/financiacion/components/steps/ConfiguracionStep.tsx` | 37 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#eee` |
| `src/modules/horizon/financiacion/components/steps/ConfiguracionStep.tsx` | 123 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/ConciliacionSection.tsx` | 36 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/ConciliacionSection.tsx` | 68 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/ConciliacionSection.tsx` | 76 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/ConciliacionSection.tsx` | 65 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/ConciliacionSection.tsx` | 73 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 69 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 70 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 82 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 133 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `#e5e7eb` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 134 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 180 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 128 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 218 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/CalendarioPagosSection.tsx` | 225 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 54 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 54 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 59 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 66 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 71 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 76 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `<button` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 66 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button onClick={onSimular} className="flex items-center gap-1` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 71 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button onClick={onEdit} className="flex items-center gap-1` |
| `src/modules/horizon/financiacion/components/detail/HeaderSection.tsx` | 76 | `V3-6-TOUCH-44` | Touch target potencialmente <44x44 | `<button onClick={onDelete} className="flex items-center gap-1` |
| `src/modules/horizon/financiacion/components/detail/BonificacionesSection.tsx` | 45 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/BonificacionesSection.tsx` | 85 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/BonificacionesSection.tsx` | 86 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/BonificacionesSection.tsx` | 86 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/modules/horizon/financiacion/components/detail/BonificacionesSection.tsx` | 98 | `V3-2-COLOR-HARDCODE` | Prohibido hardcodear colores en componentes | `rgba(` |
| `src/hooks/useButtonStyles.ts` | 12 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/hooks/useButtonStyles.ts` | 13 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
| `src/hooks/useButtonStyles.ts` | 14 | `V3-3-BUTTON-STANDARD` | Botones fuera de variantes/componentes base estandarizados | `btn-` |
