// Generates the app version files used by the frontend and the server.
//
// Version format: <major>.<minor>.<build>
//   * major.minor  -> maintained in package.json ("version"; its patch part is ignored)
//   * build        -> APP_BUILD_NUMBER env var (GitHub Actions run_number, passed into
//                     the Docker build as build-arg). Local builds without it get
//                     "<major>.<minor>.0-dev".
//   * commit       -> GIT_SHA env var, otherwise `git rev-parse` if git is available.
//
// Outputs (both git-ignored):
//   * src/version.json    -> bundled into the React app
//   * public/version.json -> read by the server and served to clients
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const [major = '0', minor = '0'] = String(pkg.version || '0.0.0').split('.');

const rawBuild = (process.env.APP_BUILD_NUMBER || '').trim();
const build = /^\d+$/.test(rawBuild) ? rawBuild : null;

let commit = (process.env.GIT_SHA || '').trim();
if (!commit) {
  try {
    commit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    commit = '';
  }
}

const versionData = {
  version: build ? `${major}.${minor}.${build}` : `${major}.${minor}.0-dev`,
  build: build ? Number(build) : null,
  commit: commit ? commit.slice(0, 7) : null,
  builtAt: new Date().toISOString(),
};

const json = JSON.stringify(versionData, null, 2) + '\n';
fs.writeFileSync(path.join(root, 'src', 'version.json'), json);
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'version.json'), json);
console.log(`Generated version: ${versionData.version}${versionData.commit ? ` (${versionData.commit})` : ''}`);
