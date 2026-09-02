// Builds the quality dashboard: reads Playwright's JSON report, groups the
// tests by the @R risk tag in their title, merges in the risk table, and
// fills dashboard/template.html. Output: public/index.html.
//
// Run: node scripts/build-dashboard.ts   (after: npx playwright test)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Playwright's JSON report, reduced to the fields this script reads.
type ReportTest = { projectName: string; status: string };
type ReportSpec = { title: string; tests: ReportTest[] };
type ReportSuite = { specs?: ReportSpec[]; suites?: ReportSuite[] };
type Report = { suites: ReportSuite[]; stats: { startTime: string; duration: number } };

type Risk = { id: string; name: string; priority: string };
type TestResult = { title: string; project: string; status: string };

const report: Report = JSON.parse(readFileSync('test-results/results.json', 'utf8'));
const risks: Risk[] = JSON.parse(readFileSync('dashboard/risks.json', 'utf8'));
const template = readFileSync('dashboard/template.html', 'utf8');
const planeVersion =
  readFileSync('infra/plane/variables.env', 'utf8').match(/^APP_RELEASE=(.+)$/m)?.[1] ?? 'unknown';

// Flatten the suite tree into one entry per test. The setup project only
// signs the three roles in; it is infrastructure, not a counted test.
const tests: TestResult[] = [];
function collect(suite: ReportSuite) {
  for (const spec of suite.specs ?? []) {
    const { projectName, status } = spec.tests[0];
    if (projectName !== 'setup') tests.push({ title: spec.title, project: projectName, status });
  }
  (suite.suites ?? []).forEach(collect);
}
report.suites.forEach(collect);

const untagged = tests.filter((t) => !/@R\d+/.test(t.title));
if (untagged.length > 0) {
  console.warn(`Warning: ${untagged.length} test(s) without a risk tag:`);
  untagged.forEach((t) => console.warn(`  ${t.title}`));
}

// Test-level status in the report is the verdict across retries:
// "expected" passed, "unexpected" failed, "flaky" passed on retry.
const passed = tests.filter((t) => t.status === 'expected').length;
const failed = tests.filter((t) => t.status === 'unexpected').length;
const flaky = tests.filter((t) => t.status === 'flaky').length;

const totalSeconds = Math.round(report.stats.duration / 1000);
const duration =
  totalSeconds >= 60
    ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
    : `${totalSeconds}s`;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const statusClass: Record<string, string> = {
  expected: 'pass',
  unexpected: 'fail',
  flaky: 'flaky',
  skipped: 'skip',
};

const matrixRows = risks
  .map((risk) => {
    const covering = tests.filter((t) => t.title.match(/@R\d+/)?.[0] === `@${risk.id}`);
    const cells =
      covering.length > 0
        ? covering
            .map(
              (t) =>
                `<span class="test ${statusClass[t.status] ?? 'skip'}" title="${escapeHtml(t.title)}">` +
                `${t.project.toUpperCase()}</span>`,
            )
            .join('')
        : '<span class="none">no automated coverage yet</span>';
    return (
      `<tr><td><strong>${risk.id}</strong> ${risk.name}</td>` +
      `<td><span class="prio ${risk.priority.toLowerCase()}">${risk.priority}</span></td>` +
      `<td><div class="cells">${cells}</div></td></tr>`
    );
  })
  .join('\n');

const values: Record<string, string> = {
  PLANE_VERSION: planeVersion,
  RUN_DATE: `${report.stats.startTime.slice(0, 16).replace('T', ' ')} UTC`,
  VERDICT_CLASS: failed === 0 ? 'pass' : 'fail',
  VERDICT_TEXT:
    failed === 0
      ? `All ${tests.length} tests passing`
      : `${failed} of ${tests.length} tests failing`,
  TOTAL: String(tests.length),
  PASSED: String(passed),
  FAILED: String(failed),
  FLAKY: String(flaky),
  DURATION: duration,
  MATRIX_ROWS: matrixRows,
};

let html = template;
for (const [token, value] of Object.entries(values)) {
  html = html.replaceAll(`{{${token}}}`, value);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/index.html', html);
console.log(
  `Dashboard written to public/index.html: ${tests.length} tests, ` +
    `${passed} passed, ${failed} failed, ${flaky} flaky (Plane ${planeVersion})`,
);
