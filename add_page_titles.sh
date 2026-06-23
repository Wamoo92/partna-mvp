#!/bin/bash
# ── Partna page title patcher ─────────────────────────────────────────────
# Run from your project root: bash add_page_titles.sh
# Adds document.title useEffect to each page component.
# Safe to run multiple times — skips files already patched.

PATCHED=0
SKIPPED=0
FAILED=0

patch_file() {
  local FILE="$1"
  local TITLE="$2"
  local DYNAMIC="$3"

  if [ ! -f "$FILE" ]; then
    echo "  ⚠ MISSING: $FILE"
    FAILED=$((FAILED + 1))
    return
  fi

  if grep -q "document.title" "$FILE"; then
    echo "  ↩ SKIP (already patched): $FILE"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

python3 - "$FILE" "$TITLE" "$DYNAMIC" << 'PYEOF'
import sys, re

filepath = sys.argv[1]
title    = sys.argv[2]
dynamic  = sys.argv[3] if len(sys.argv) > 3 else ''

with open(filepath, 'r') as f:
    content = f.read()

# ── 1. Ensure useEffect is imported ──────────────────────────────────────
if 'useEffect' not in content:
    # Add useEffect to existing React named import
    content = re.sub(
        r'import \{ (useState)',
        r'import { useEffect, \1',
        content,
        count=1
    )
    # If no useState import, try any named import from react
    if 'useEffect' not in content:
        content = re.sub(
            r"(import \{[^}]*)\} from 'react'",
            r'\1, useEffect } from \'react\'',
            content,
            count=1
        )

# ── 2. Build the hook string ──────────────────────────────────────────────
if dynamic == 'business':
    hook = "\n  useEffect(() => { document.title = business ? `${business.name} - Partna` : 'Business - Partna' }, [business])\n"
else:
    hook = f"\n  useEffect(() => {{ document.title = '{title}' }}, [])\n"

# ── 3. Insert after the opening brace of the default export function ──────
pattern = r'(export default function \w+[^{]*\{)'
match = re.search(pattern, content)

if match:
    insert_pos = match.end()
    new_content = content[:insert_pos] + hook + content[insert_pos:]
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"  ✓ PATCHED: {filepath}")
    sys.exit(0)
else:
    print(f"  ✗ COULD NOT FIND export default function in: {filepath}")
    sys.exit(1)
PYEOF

  if [ $? -eq 0 ]; then
    PATCHED=$((PATCHED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
}

# ── Dashboard ──────────────────────────────────────────────────────────────
patch_file "src/pages/dashboard/DashboardLogin.jsx"    "Login - Partna"
patch_file "src/pages/dashboard/DashboardRegister.jsx" "Register - Partna"
patch_file "src/pages/dashboard/FirstLogin.jsx"        "Set up your account - Partna"
patch_file "src/pages/dashboard/ResetPassword.jsx"     "Reset password - Partna"
patch_file "src/pages/dashboard/Overview.jsx"          "Overview - Partna"
patch_file "src/pages/dashboard/Campaigns.jsx"         "Campaigns - Partna"
patch_file "src/pages/dashboard/students.jsx"          "Students - Partna"
patch_file "src/pages/dashboard/Payments.jsx"          "Payments - Partna"
patch_file "src/pages/dashboard/Settings.jsx"          "Settings - Partna"
patch_file "src/pages/dashboard/Cards.jsx"             "Cards - Partna"
patch_file "src/pages/dashboard/Customers.jsx"         "Customers - Partna"
patch_file "src/pages/dashboard/Products.jsx"          "Products - Partna"
patch_file "src/pages/dashboard/Sales.jsx"             "Sales - Partna"

# ── Admin ──────────────────────────────────────────────────────────────────
patch_file "src/pages/admin/AdminLogin.jsx"      "Login - Partna"
patch_file "src/pages/admin/Businesses.jsx"      "Businesses - Partna"
patch_file "src/pages/admin/BusinessDetail.jsx"  "Business - Partna" "business"
patch_file "src/pages/admin/Transactions.jsx"    "Transactions - Partna"
patch_file "src/pages/admin/Customers.jsx"       "Customers - Partna"
patch_file "src/pages/admin/CustomerDetail.jsx"  "Customer - Partna"
patch_file "src/pages/admin/Cards.jsx"           "Cards - Partna"
patch_file "src/pages/admin/Dashboard.jsx"       "Dashboard - Partna"
patch_file "src/pages/admin/KYBQueue.jsx"        "KYB Queue - Partna"
patch_file "src/pages/admin/OnboardBusiness.jsx" "Onboard Business - Partna"
patch_file "src/pages/admin/Revenue.jsx"         "Revenue - Partna"
patch_file "src/pages/admin/Rewards.jsx"         "Rewards - Partna"
patch_file "src/pages/admin/Settings.jsx"        "Settings - Partna"

# ── Portal ─────────────────────────────────────────────────────────────────
patch_file "src/pages/portal/Login.jsx"          "Login - Partna"
patch_file "src/pages/portal/Register.jsx"       "Register - Partna"
patch_file "src/pages/portal/ResetPin.jsx"       "Reset PIN - Partna"
patch_file "src/pages/portal/Landing.jsx"        "Welcome - Partna"
patch_file "src/pages/portal/Home.jsx"           "Home - Partna"
patch_file "src/pages/portal/CardDetail.jsx"     "My Card - Partna"
patch_file "src/pages/portal/KYC.jsx"            "Verify Identity - Partna"
patch_file "src/pages/portal/AddMoney.jsx"       "Add Money - Partna"
patch_file "src/pages/portal/Pay.jsx"            "Pay - Partna"
patch_file "src/pages/portal/PaymentSource.jsx"  "Payment - Partna"
patch_file "src/pages/portal/PaymentSuccess.jsx" "Payment Complete - Partna"
patch_file "src/pages/portal/Profile.jsx"        "Profile - Partna"
patch_file "src/pages/portal/SelectCampaign.jsx" "Select Campaign - Partna"
patch_file "src/pages/portal/Transactions.jsx"   "Transactions - Partna"
patch_file "src/pages/portal/Withdraw.jsx"       "Withdraw - Partna"

echo ""
echo "────────────────────────────────────────"
echo "  Patched: $PATCHED"
echo "  Skipped: $SKIPPED (already done)"
echo "  Failed:  $FAILED"
echo "────────────────────────────────────────"