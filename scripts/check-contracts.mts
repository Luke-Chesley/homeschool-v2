import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contract Check Script
 * 
 * Verifies that:
 * 1. Every contract in contract-index.json has a matching markdown file.
 * 2. Every contract doc includes all required sections.
 * 3. All referenced canonical source files exist.
 */

const REQUIRED_SECTIONS = [
  '# Contract:',
  '## Purpose',
  '## Producers',
  '## Consumers',
  '## Persistence',
  '## Field Definitions',
  '### Required Fields',
  '### Optional Fields',
  '## Defaults & Fallbacks',
  '## Validation & Invariants',
  '## Ownership & Hierarchy',
  '## Change Impact',
  '## Known Gaps / TODOs'
];

interface ContractEntry {
  id: string;
  title: string;
  docPath: string;
  canonicalSources: string[];
}

interface ContractIndex {
  contracts: ContractEntry[];
}

function checkContracts() {
  const indexPath = join(process.cwd(), 'contracts', 'contract-index.json');
  
  if (!existsSync(indexPath)) {
    console.error('❌ Error: contract-index.json not found at', indexPath);
    process.exit(1);
  }

  const index: ContractIndex = JSON.parse(readFileSync(indexPath, 'utf-8'));
  let hasErrors = false;

  console.log(`🔍 Checking ${index.contracts.length} contracts...`);

  for (const contract of index.contracts) {
    console.log(`\n📄 Checking contract: ${contract.id} (${contract.title})`);
    
    // 1. Check if doc exists
    const docPath = join(process.cwd(), contract.docPath);
    if (!existsSync(docPath)) {
      console.error(`  ❌ Error: Documentation file not found: ${contract.docPath}`);
      hasErrors = true;
      continue;
    }

    // 2. Check for required sections
    const content = readFileSync(docPath, 'utf-8');
    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        console.error(`  ❌ Error: Missing required section "${section}" in ${contract.docPath}`);
        hasErrors = true;
      }
    }

    // 3. Check canonical sources
    for (const source of contract.canonicalSources) {
      const sourcePath = join(process.cwd(), source);
      if (!existsSync(sourcePath)) {
        console.error(`  ❌ Error: Canonical source file not found: ${source}`);
        hasErrors = true;
      }
    }

    if (!hasErrors) {
      console.log(`  ✅ OK`);
    }
  }

  if (hasErrors) {
    console.error('\n❌ Contract check failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All contracts are structurally sound.');
  }
}

checkContracts();
