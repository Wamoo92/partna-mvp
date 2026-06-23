#!/bin/bash
# Run from your project root: bash fix_business_detail_title.sh

FILE="src/pages/admin/BusinessDetail.jsx"

python3 - "$FILE" << 'PYEOF'
import sys, re

filepath = sys.argv[1]

with open(filepath, 'r') as f:
    content = f.read()

# Remove the misplaced useEffect at the top of the function
content = content.replace(
    'export default function BusinessDetail() {\n  useEffect(() => { document.title = business ? `${business.name} - Partna` : \'Business - Partna\' }, [business])\n\n  const { id } = useParams()',
    'export default function BusinessDetail() {\n  const { id } = useParams()'
)

# Now insert the useEffect in the correct place — after all useState declarations
# and before the useEffect(() => { loadAll() }, [id]) line
content = content.replace(
    "  const [activeTab, setActiveTab] = useState('profile')\n\n  useEffect(() => { loadAll() }, [id])",
    "  const [activeTab, setActiveTab] = useState('profile')\n\n  useEffect(() => { document.title = business ? `${business.name} - Partna` : 'Business - Partna' }, [business])\n\n  useEffect(() => { loadAll() }, [id])"
)

with open(filepath, 'w') as f:
    f.write(content)

print(f'✓ Fixed: {filepath}')
PYEOF