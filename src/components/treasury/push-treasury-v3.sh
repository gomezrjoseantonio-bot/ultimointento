#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  ATLAS · Treasury Redesign v3 — Push to GitHub
#  Uso: bash push-treasury-v3.sh TU_TOKEN_GITHUB
# ═══════════════════════════════════════════════════════════════════

set -e

TOKEN="${1:-}"
REPO="gomezrjoseantonio-bot/ultimointento"
BRANCH="feat/treasury-redesign-v3"
BASE_BRANCH="main"

# ── 1. Validaciones ─────────────────────────────────────────────────
if [ -z "$TOKEN" ]; then
  echo ""
  echo "  ❌  Falta el token de GitHub."
  echo ""
  echo "  Crea uno en: https://github.com/settings/tokens"
  echo "  Permisos mínimos necesarios: repo (full)"
  echo ""
  echo "  Uso:  bash push-treasury-v3.sh ghp_TU_TOKEN_AQUI"
  echo ""
  exit 1
fi

# Comprobamos que los ficheros fuente existen junto al script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TSX_FILE="$SCRIPT_DIR/TreasuryReconciliationView.tsx"
CSS_FILE="$SCRIPT_DIR/treasury-reconciliation.css"

if [ ! -f "$TSX_FILE" ] || [ ! -f "$CSS_FILE" ]; then
  echo ""
  echo "  ❌  No encuentro los ficheros fuente junto a este script."
  echo "  Necesito:"
  echo "    - TreasuryReconciliationView.tsx"
  echo "    - treasury-reconciliation.css"
  echo ""
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ATLAS · Treasury Redesign v3 → GitHub PR"
echo "═══════════════════════════════════════════════════"

# ── 2. Clonar repo ───────────────────────────────────────────────────
TMP_DIR="$(mktemp -d)"
echo "📂 Clonando repo en $TMP_DIR…"
git clone --depth=1 "https://${TOKEN}@github.com/${REPO}.git" "$TMP_DIR"
cd "$TMP_DIR"

# ── 3. Crear rama feature ────────────────────────────────────────────
echo "🌿 Creando rama $BRANCH…"
git checkout -b "$BRANCH"

# ── 4. Localizar destino ─────────────────────────────────────────────
TREASURY_DIR="src/components/treasury"
if [ ! -d "$TREASURY_DIR" ]; then
  echo "⚠️  Carpeta $TREASURY_DIR no encontrada — buscando alternativa…"
  TREASURY_DIR=$(find src -type d -iname "treasury" 2>/dev/null | head -1)
  if [ -z "$TREASURY_DIR" ]; then
    echo "❌ No se encontró ninguna carpeta treasury en src/. Abortando."
    rm -rf "$TMP_DIR"
    exit 1
  fi
  echo "✅ Encontrada: $TREASURY_DIR"
fi

TARGET_TSX="$TREASURY_DIR/TreasuryReconciliationView.tsx"
TARGET_CSS="$TREASURY_DIR/treasury-reconciliation.css"

# ── 5. Copia ficheros ─────────────────────────────────────────────────
echo "📋 Copiando ficheros…"
cp "$TSX_FILE" "$TARGET_TSX"
cp "$CSS_FILE" "$TARGET_CSS"

# ── 6. Commit ─────────────────────────────────────────────────────────
git config user.email "atlas-bot@noreply.github.com"
git config user.name  "Atlas Redesign Bot"
git add "$TARGET_TSX" "$TARGET_CSS"
git commit -m "feat(treasury): redesign TreasuryReconciliationView v3

- Hero mes con grid azul --blue, CF neto 28px monospace
- 4 columnas métricas (ingresos/gastos/financiación/punteado) con barras teal
- Chips bancarios verticales con barra de progreso y estado semántico
- Banner alerta condicional para saldos negativos (BBVA, Bankinter)
- Lista movimientos agrupada por fecha con sticky headers
- Barra roja 3px en filas vencidas (date < today && status === 'previsto')
- Toggle punteo en un clic (previsto ↔ confirmado + opacity .45 + line-through)
- Drawer lateral deslizante reemplaza el modal (showAddModal)
- Edición inline de importes con acciones Ajustar / Dejar pendiente
- Grupos rentas habitaciones colapsables con badge progreso
- Botón primary único: Generar previsiones
- CSS completo con tokens Design Guide v3 (--blue, --teal, --s-pos, --s-neg)"

# ── 7. Push ───────────────────────────────────────────────────────────
echo "🚀 Subiendo rama a origin…"
git push "https://${TOKEN}@github.com/${REPO}.git" "$BRANCH"

# ── 8. Crear Pull Request vía API ─────────────────────────────────────
echo "🔗 Creando Pull Request…"
PR_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/pulls" \
  -d "{
    \"title\": \"feat(treasury): redesign TreasuryReconciliationView v3\",
    \"body\": \"## Cambios principales\\n\\n### Hero mes\\n- Bloque azul \`--blue\` con cashflow neto 28px monospace como protagonista\\n- 4 columnas: Ingresos · Gastos · Financiación · Punteado con barras de progreso teal\\n- Navegación mes con barra de conciliación\\n\\n### Balance bancario\\n- Chips verticales con barra de progreso por banco\\n- Badge estado (✓ / ⚠ / ○) con semántica correcta\\n- Saldo negativo en rojo (BBVA, Bankinter)\\n- Banner de alerta condicional encima del hero\\n\\n### Movimientos\\n- Agrupación por fecha con sticky headers y totales del día\\n- Barra roja 3px en filas vencidas\\n- Toggle punteo con un clic: opacity 0.45 + tachado\\n- Drawer lateral en lugar de modal\\n- Edición inline de importes\\n- Grupos alquiler habitaciones colapsables\\n\\n### Reglas Design Guide v3 respetadas\\n- Mono obligatorio en todos los importes\\n- Teal NUNCA en KPIs\\n- Un solo botón primary por pantalla\\n- Kebab oculto salvo hover, Trash2 eliminado\\n\\n**Ficheros modificados:**\\n- \`src/components/treasury/TreasuryReconciliationView.tsx\`\\n- \`src/components/treasury/treasury-reconciliation.css\`\",
    \"head\": \"${BRANCH}\",
    \"base\": \"${BASE_BRANCH}\"
  }")

PR_URL=$(echo "$PR_RESPONSE" | grep '"html_url"' | head -1 | sed 's/.*"html_url": "\(.*\)".*/\1/')

# ── 9. Limpieza ───────────────────────────────────────────────────────
cd /
rm -rf "$TMP_DIR"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅  LISTO"
echo "═══════════════════════════════════════════════════"
if [ -n "$PR_URL" ] && [[ "$PR_URL" == https* ]]; then
  echo "  PR:  $PR_URL"
else
  echo "  Revisa tus PRs en: https://github.com/${REPO}/pulls"
fi
echo "═══════════════════════════════════════════════════"
echo ""
