import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const latest = resolve(dirname(fileURLToPath(import.meta.url)), 'latest')
const results = []
for (let number = 1; number <= 13; number++) {
  results.push(JSON.parse(await readFile(resolve(latest, `E${String(number).padStart(2, '0')}.json`), 'utf8')))
}
await writeFile(resolve(latest, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)

const rows = results.map((item) =>
  `| ${item.experiment} | ${item.removedDependencies.join(', ') || 'None'} | ${item.expectedOutcome} | ${item.actualOutcome} | ${item.exactByteMatch == null ? 'N/A' : item.exactByteMatch ? 'Yes' : 'No'} | ${item.result} |`,
)
const report = [
  '# ARKIVE Recovery Dependency Experiments',
  '',
  `Commit: \`${results[0].gitCommit}\``,
  `Summary generated: ${new Date().toISOString()}`,
  '',
  '| Experiment | Dependency removed | Expected | Actual | Exact bytes | Result |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  'E05 is produced by the gateway-independence harness. E11 is E11-A from the storage-replica harness.',
  'E13 records specification conformance separately from fresh specification-only reimplementation.',
  'Independent implementation evidence is in `INDEPENDENT-RECOVERY.json`.',
  '',
].join('\n')
await writeFile(resolve(latest, 'REPORT.md'), report)
console.log('Research summaries synchronized')
