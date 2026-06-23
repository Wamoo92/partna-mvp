#!/bin/bash
# ── Partna page title fixer ───────────────────────────────────────────────
# Fixes incorrectly placed useEffect hooks from the previous patch.
# Run from your project root: bash fix_page_titles.sh

FIXED=0
FAILED=0

fix_file() {
  local FILE="$1"
  local TITLE="$2"
  local DYNAMIC="$3"

  if [ ! -f "$FILE" ]; then
    echo "  ⚠ MISSING: $FILE"
    FAILED=$((FAILED + 1))
    return
  fi

python3 - "$FILE" "$TITLE" "$DYNAMIC" << 'PYEOF'
import sys, re

filepath = sys.argv[1]
title    = sys.argv[2]
dynamic  = sys.argv[3] if len(sys.argv) > 3 else ''

with open(filepath, 'r') as f:
    original = f.read()

# ── Step 1: Remove any incorrectly placed useEffect inside function params ─
# Pattern: useEffect inserted inside function signature (between { and first real line)
# These look like:  export default function Foo({
#                     useEffect(...) ...
#                     prop1, prop2
# We detect this by finding useEffect on the line right after export default function Foo({
# where that { is a props destructuring open (followed by more params, not a function body)

cleaned = original

# Remove any misplaced useEffect line that appears inside a parameter list
# Signature: the useEffect line appears before the closing }) of props
misplaced = re.compile(
    r'(export default function \w+\([^)]*\{[^\n]*\n)'  # function with props opening {
    r'(\s*useEffect\([^;]+;\]\)[\s\n]*)',               # the misplaced useEffect line
    re.DOTALL
)
cleaned = misplaced.sub(r'\1', cleaned)

# Also handle simpler single-line match
misplaced2 = re.compile(
    r'(export default function \w+\(\{[^\n]*\n)'
    r'(\s*useEffect\(\(\) => \{[^\n]+\n)',
)
cleaned = misplaced2.sub(r'\1', cleaned)

# ── Step 2: Ensure useEffect is imported ──────────────────────────────────
if 'useEffect' not in cleaned:
    cleaned = re.sub(
        r'import \{ (useState)',
        r'import { useEffect, \1',
        cleaned,
        count=1
    )
    if 'useEffect' not in cleaned:
        cleaned = re.sub(
            r"(import \{)([^}]*)(} from 'react')",
            lambda m: m.group(1) + ' useEffect,' + m.group(2) + m.group(3),
            cleaned,
            count=1
        )

# ── Step 3: Build the hook ────────────────────────────────────────────────
if dynamic == 'business':
    hook = "\n  useEffect(() => { document.title = business ? `${business.name} - Partna` : 'Business - Partna' }, [business])\n"
else:
    hook = f"\n  useEffect(() => {{ document.title = '{title}' }}, [])\n"

# ── Step 4: Skip if already correctly placed ──────────────────────────────
if 'document.title' in cleaned:
    # Already has a correct placement — verify it's not in params
    # Check if the document.title line comes after a complete function signature
    print(f"  ↩ ALREADY OK: {filepath}")
    if cleaned != original:
        with open(filepath, 'w') as f:
            f.write(cleaned)
        print(f"    (removed misplaced copy)")
    sys.exit(0)

# ── Step 5: Find the function body opening brace ──────────────────────────
# Strategy: find "export default function Name" then scan character by character
# to find the opening brace of the BODY (not props destructuring)

match = re.search(r'export default function \w+', cleaned)
if not match:
    print(f"  ✗ COULD NOT FIND export default function in: {filepath}")
    sys.exit(1)

pos = match.end()
text = cleaned

# Skip past the parameter list by counting parens
depth = 0
i = pos
while i < len(text):
    c = text[i]
    if c == '(':
        depth += 1
    elif c == ')':
        depth -= 1
        if depth == 0:
            i += 1
            break
    i += 1

# Now skip whitespace to find the opening brace of the function body
while i < len(text) and text[i] in ' \t\n':
    i += 1

if i < len(text) and text[i] == '{':
    insert_pos = i + 1
    new_content = text[:insert_pos] + hook + text[insert_pos:]
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"  ✓ FIXED: {filepath}")
    sys.exit(0)
else:
    print(f"  ✗ COULD NOT FIND function body brace in: {filepath} (found '{text[i]}' at pos {i})")
    sys.exit(1)
PYEOF

  if [ $? -eq 0 ]; then
    FIXED=$((FIXED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
}

# ── Dashboard ──────────────────────────────────────────────────────────────
fix_file "src/pages/dashboard/DashboardLogin.jsx"    "Login - Partna"
fix_file "src/pages/dashboard/DashboardRegister.jsx" "Register - Partna"
fix_file "src/pages/dashboard/FirstLogin.jsx"        "Set up your account - Partna"
fix_file "src/pages/dashboard/ResetPassword.jsx"     "Reset password - Partna"
fix_file "src/pages/dashboard/Overview.jsx"          "Overview - Partna"
fix_file "src/pages/dashboard/Campaigns.jsx"         "Campaigns - Partna"
fix_file "src/pages/dashboard/students.jsx"          "Students - Partna"
fix_file "src/pages/dashboard/Payments.jsx"          "Payments - Partna"
fix_file "src/pages/dashboard/Settings.jsx"          "Settings - Partna"
fix_file "src/pages/dashboard/Cards.jsx"             "Cards - Partna"
fix_file "src/pages/dashboard/Customers.jsx"         "Customers - Partna"
fix_file "src/pages/dashboard/Products.jsx"          "Products - Partna"
fix_file "src/pages/dashboard/Sales.jsx"             "Sales - Partna"

# ── Admin ──────────────────────────────────────────────────────────────────
fix_file "src/pages/admin/AdminLogin.jsx"      "Login - Partna"
fix_file "src/pages/admin/Businesses.jsx"      "Businesses - Partna"
fix_file "src/pages/admin/BusinessDetail.jsx"  "Business - Partna" "business"
fix_file "src/pages/admin/Transactions.jsx"    "Transactions - Partna"
fix_file "src/pages/admin/Customers.jsx"       "Customers - Partna"
fix_file "src/pages/admin/CustomerDetail.jsx"  "Customer - Partna"
fix_file "src/pages/admin/Cards.jsx"           "Cards - Partna"
fix_file "src/pages/admin/Dashboard.jsx"       "Dashboard - Partna"
fix_file "src/pages/admin/KYBQueue.jsx"        "KYB Queue - Partna"
fix_file "src/pages/admin/OnboardBusiness.jsx" "Onboard Business - Partna"
fix_file "src/pages/admin/Revenue.jsx"         "Revenue - Partna"
fix_file "src/pages/admin/Rewards.jsx"         "Rewards - Partna"
fix_file "src/pages/admin/Settings.jsx"        "Settings - Partna"

# ── Portal ─────────────────────────────────────────────────────────────────
fix_file "src/pages/portal/Login.jsx"          "Login - Partna"
fix_file "src/pages/portal/Register.jsx"       "Register - Partna"
fix_file "src/pages/portal/ResetPin.jsx"       "Reset PIN - Partna"
fix_file "src/pages/portal/Landing.jsx"        "Welcome - Partna"
fix_file "src/pages/portal/Home.jsx"           "Home - Partna"
fix_file "src/pages/portal/CardDetail.jsx"     "My Card - Partna"
fix_file "src/pages/portal/KYC.jsx"            "Verify Identity - Partna"
fix_file "src/pages/portal/AddMoney.jsx"       "Add Money - Partna"
fix_file "src/pages/portal/Pay.jsx"            "Pay - Partna"
fix_file "src/pages/portal/PaymentSource.jsx"  "Payment - Partna"
fix_file "src/pages/portal/PaymentSuccess.jsx" "Payment Complete - Partna"
fix_file "src/pages/portal/Profile.jsx"        "Profile - Partna"
fix_file "src/pages/portal/SelectCampaign.jsx" "Select Campaign - Partna"
fix_file "src/pages/portal/Transactions.jsx"   "Transactions - Partna"
fix_file "src/pages/portal/Withdraw.jsx"       "Withdraw - Partna"

echo ""
echo "────────────────────────────────────────"
echo "  Fixed:  $FIXED"
echo "  Failed: $FAILED"
echo "────────────────────────────────────────"