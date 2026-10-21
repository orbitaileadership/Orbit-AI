// Refreshes lib/auth/school-domains.ts from the public university domain list (github.com/Hipo/university-domains-list).
// Run: npm run update-school-domains
import { writeFileSync } from "node:fs";

const res = await fetch("https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json");
if (!res.ok) throw new Error(`Download failed (${res.status})`);
const list = await res.json();
const ok = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const domains = [...new Set(list.flatMap((u) => u.domains ?? []).map((d) => String(d).trim().toLowerCase().replace(/\.$/, "")).filter((d) => ok.test(d)))].sort();
writeFileSync(new URL("../lib/auth/school-domains.ts", import.meta.url), `// Email domains of universities and colleges worldwide (about ${domains.length}), from the public Hipo "university-domains-list"
// (github.com/Hipo/university-domains-list, MIT licence). Regenerate with: npm run update-school-domains.
// One domain per line; subdomains of these also count (mail.utoronto.ca → utoronto.ca).
export const SCHOOL_DOMAINS_TEXT = \`${domains.join("\n")}\`;
`);
console.log(`Saved ${domains.length} school domains.`);
