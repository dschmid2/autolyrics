const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let buildNumber = 0;
try {
  // Get git commit count
  const countStr = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
  buildNumber = parseInt(countStr, 10) || 0;
} catch (e) {
  console.warn('Could not determine git commit count, using 0 as fallback:', e.message);
}

const versionData = {
  version: `1.0.${buildNumber}`
};

const filepath = path.join(__dirname, '..', 'src', 'version.json');
fs.writeFileSync(filepath, JSON.stringify(versionData, null, 2));
console.log(`Generated version: ${versionData.version}`);
