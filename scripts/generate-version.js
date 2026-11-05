const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let buildNumber = 0;

// 1. Check if running in CI/CD pipeline (e.g. GitHub Actions run number)
if (process.env.GITHUB_RUN_NUMBER) {
  buildNumber = parseInt(process.env.GITHUB_RUN_NUMBER, 10) || 0;
} else {
  // 2. Otherwise determine version based on git merge requests / pull requests
  try {
    let maxPrNum = 0;
    try {
      const prLog = execSync('git log --grep="Merge pull request #" -n 100 --pretty=format:"%s"', { encoding: 'utf8' }).trim();
      if (prLog) {
        const lines = prLog.split('\n');
        for (const line of lines) {
          const match = line.match(/Merge pull request #(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxPrNum) maxPrNum = num;
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // Count total merge commits
    let mergeCount = 0;
    try {
      const mergeStr = execSync('git rev-list --count --merges HEAD', { encoding: 'utf8' }).trim();
      mergeCount = parseInt(mergeStr, 10) || 0;
    } catch (e) {
      // ignore
    }

    // Determine current branch name
    let currentBranch = '';
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (e) {
      // ignore
    }

    const baseNumber = maxPrNum || mergeCount;

    if (baseNumber > 0) {
      // If we are currently building on a feature/PR branch (not main),
      // increment for the pending merge request.
      const isMainBranch = currentBranch === 'main' || currentBranch === 'master';
      buildNumber = isMainBranch ? baseNumber : baseNumber + 1;
    } else {
      // Fallback: total commit count
      const countStr = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
      buildNumber = parseInt(countStr, 10) || 0;
    }
  } catch (e) {
    console.warn('Could not determine git version info, using fallback:', e.message);
  }
}

const versionData = {
  version: `1.0.${buildNumber}`
};

const filepath = path.join(__dirname, '..', 'src', 'version.json');
fs.writeFileSync(filepath, JSON.stringify(versionData, null, 2) + '\n');
console.log(`Generated version: ${versionData.version}`);
