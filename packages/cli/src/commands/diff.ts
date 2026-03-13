interface DiffOptions {
  base: string;
  json?: boolean;
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  console.log(`Comparing documentation against ${options.base}...`);
  console.log("\n[diff] This feature requires git integration and a cached DocIR snapshot.");
  console.log("[diff] Full implementation coming in Phase 2.\n");

  // Phase 2: Implementation plan
  // 1. Load current DocIR (from docgen generate --dry-run)
  // 2. Checkout base ref, generate DocIR snapshot
  // 3. Deep diff the two DocIRs
  // 4. Report: added modules, removed modules, changed members, coverage delta
}
