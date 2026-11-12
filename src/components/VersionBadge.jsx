import versionData from '../version.json';

// Shows the bundled app version. If the server runs a different version, this
// browser still has an old bundle cached and needs a reload.
export function VersionBadge({ serverVersion, className = '', style }) {
  const outdated = !!serverVersion && serverVersion !== versionData.version;
  const details = [
    `Version ${versionData.version}`,
    versionData.commit ? `Commit ${versionData.commit}` : null,
    versionData.builtAt ? `Build ${new Date(versionData.builtAt).toLocaleString('de-DE')}` : null,
    outdated ? `Server läuft mit ${serverVersion} – bitte Seite neu laden` : null,
  ].filter(Boolean).join('\n');

  if (outdated) {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        title={details}
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap ${className}`}
        style={{ ...style, background: '#D89A3E', color: '#221F1A' }}
      >
        v{versionData.version} → v{serverVersion} neu laden
      </button>
    );
  }
  return (
    <span title={details} className={`text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap ${className}`} style={style}>
      v{versionData.version}
    </span>
  );
}
