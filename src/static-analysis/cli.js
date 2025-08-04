const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs-extra');
// IMPORT FUNCTIONS FROM THIS DIRECTORY
const { getPatternflyStats, patternflyAggs, productUsage } = require('./getPatternflyStats');
const { getPackageStats, getAggregatePackageStats, getPFVersions } = require('./getPackageStats');
const { getSortedImports, getSortedUsage } = require('./getSortedImports');
const { getDeprecatedComponents } = require('./getDeprecatedComponents');
// IMPORT JSON LIST OF REPOS
const repos = require('../../repos.json').repos;

// DEFINE OUTPUT DIRECTORIES
const statsDir = path.resolve(__dirname, '../../stats-static');
const tmpDir = path.resolve(__dirname, '../../tmp');

if (!fs.existsSync(statsDir)) {
  fs.mkdirSync(statsDir);
}

function collectPatternflyStats(argv) {
  const date = new Date().toISOString();
  // CREATE NEW DIRECTORY W/TODAY'S DATE FOR REPORT
  // STATS-STATIC/{DATE}
  const dir = `${statsDir}/${date.substring(0, 10)}`;
  if (argv.c) {
    fs.removeSync(tmpDir);
  }
  // LOOP THROUGH EVERY REPO & CLONE INTO NEW DIRECTORY (IF NOT ALREADY EXISTS)
  // OR GIT PULL (IF DOES EXIST)
  repos
    .filter(repo => argv.p || !repo.private) // Only public repos unless flag passed
    .forEach(repo => {
      const repoName = repo.git.split('/').pop();
      const tmpPath = `${tmpDir}/${repo.name}`;
      try {
        execSync(`git config pull.ff only`);
        execSync(`cd ${tmpPath} && git pull`);
      } catch (e) {
console.log(tmpPath)
        console.log(e);
      }
      const patternflyStats = getPatternflyStats(tmpPath, repo.name);
      patternflyStats.repo = repo.git;
      patternflyStats.name = repo.name || repoName;
      patternflyStats.date = date;
      if (argv.j) {
        patternflyStats.dependencies = getPackageStats(tmpPath, patternflyStats.name, repo.git);
      }

      fs.outputFileSync(`${dir}/${repo.name}.json`, JSON.stringify(patternflyStats, null, 2));
    });
  if (argv.j) {
    fs.outputFileSync(`${dir}/_all_dependencies.json`, JSON.stringify(getAggregatePackageStats(), null, 2));
    fs.outputFileSync(`${dir}/_all.json`, JSON.stringify(patternflyAggs, null, 2));
    fs.outputFileSync(`${dir}/_all_sorted.json`, JSON.stringify(getSortedImports(patternflyAggs.imports), null, 2));
    const sortedUsage = getSortedUsage(productUsage);
    const pfVersions = getPFVersions();
    fs.outputFileSync(`${dir}/_all_product_uses.json`, JSON.stringify(sortedUsage, null, 2));
    fs.outputFileSync(`${dir}/_all_pf_versions.json`, JSON.stringify(pfVersions, null, 2));
    fs.outputFileSync(`${dir}/_deprecated_usage.json`, JSON.stringify(getDeprecatedComponents(sortedUsage, pfVersions), null, 2));
  }
  console.log(`Collected stats for ${date} under ${dir}`);
}

require('yargs')
  .scriptName('repoStats')
  .usage('$0 ...flags')
  .command('collect', 'save stats locally', yargs => {
    yargs.option('c', {
      type: 'boolean',
      default: 'false',
      describe: 'whether to do a clean clone'
    });
    yargs.option('p', {
      type: 'boolean',
      default: 'false',
      describe: 'whether to clone private repos'
    });
    yargs.option('j', {
      type: 'boolean',
      default: 'false',
      describe: 'whether to compile package.json stats'
    });
  }, collectPatternflyStats)
  .help()
  .argv;
