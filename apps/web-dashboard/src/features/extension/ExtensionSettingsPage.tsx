import { useEffect, useState } from 'react';
import { Puzzle, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { useWebsites } from '../dashboard/useWebsites';

const EXT_CONFIG_KEY = 'perfscope-ext-config';

interface ExtConfig {
  defaultWebsiteId: string;
}

function readConfig(): ExtConfig {
  try {
    const raw = localStorage.getItem(EXT_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ExtConfig) : { defaultWebsiteId: '' };
  } catch {
    return { defaultWebsiteId: '' };
  }
}

function writeConfig(cfg: ExtConfig) {
  localStorage.setItem(EXT_CONFIG_KEY, JSON.stringify(cfg));
  // Trigger storage event so the content script picks it up immediately
  window.dispatchEvent(new StorageEvent('storage', { key: EXT_CONFIG_KEY }));
}

// Detect if the extension is installed by checking if it wrote a token
function useExtensionConnected() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // The content script always syncs the auth token — if perfscope-auth exists
    // in localStorage, the extension will have synced it. We use the presence of
    // the auth key as a proxy for "extension is installed and active".
    const raw = localStorage.getItem('perfscope-auth');
    setConnected(raw !== null);

    const handler = () => setConnected(localStorage.getItem('perfscope-auth') !== null);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return connected;
}

export function ExtensionSettingsPage() {
  const { websites } = useWebsites();
  const connected    = useExtensionConnected();
  const [config, setConfig] = useState<ExtConfig>(readConfig);
  const [saved,  setSaved]  = useState(false);

  function handleSave(newCfg: ExtConfig) {
    setConfig(newCfg);
    writeConfig(newCfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8B5CF6)', boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}
        >
          <Puzzle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
            Extension Settings
          </h1>
          <p className="text-sm" style={{ color: 'var(--ps-text-secondary)' }}>
            Configure how the PerfScope Companion browser extension behaves
          </p>
        </div>
      </div>

      {/* Connection status */}
      <section
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
          Connection Status
        </h2>

        <div className="flex items-center gap-3">
          {connected === null ? (
            <Circle className="w-4 h-4 text-slate-500" />
          ) : connected ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.6))' }} />
          ) : (
            <Circle className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-sm" style={{ color: connected ? '#10b981' : 'var(--ps-text-secondary)' }}>
            {connected === null
              ? 'Checking…'
              : connected
              ? 'Extension is active and synced with this account'
              : 'Extension not detected on this page'}
          </span>
        </div>

        {!connected && (
          <div
            className="rounded-xl p-4 flex flex-col gap-2 text-sm"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <p style={{ color: 'var(--ps-text-secondary)' }}>
              To connect the extension:
            </p>
            <ol className="flex flex-col gap-1 pl-4 list-decimal" style={{ color: 'var(--ps-text-secondary)' }}>
              <li>Install PerfScope Companion from <code className="text-xs text-indigo-400">.output/chrome-mv3</code></li>
              <li>Keep this page open — the extension syncs your token automatically</li>
            </ol>
          </div>
        )}
      </section>

      {/* Default project */}
      <section
        className="rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
            Default Project
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ps-text-muted)' }}>
            Analyses run from the extension will be saved under this project by default.
            You can always override this in the extension popup.
          </p>
        </div>

        <select
          value={config.defaultWebsiteId}
          onChange={e => handleSave({ ...config, defaultWebsiteId: e.target.value })}
          className="w-full px-3 py-2 text-sm rounded-xl outline-none transition-colors"
          style={{
            background:   'var(--ps-page-bg)',
            border:       '1px solid var(--ps-panel-border)',
            color:        'var(--ps-text-primary)',
          }}
        >
          <option value="">— No default project —</option>
          {websites.map(site => (
            <option key={site._id} value={site._id}>
              {site.name || site.url}
            </option>
          ))}
        </select>

        {saved && (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved — extension will pick this up on next visit
          </p>
        )}
      </section>

      {/* How it works */}
      <section
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--ps-panel-bg)', border: '1px solid var(--ps-panel-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ps-text-heading)' }}>
          How It Works
        </h2>
        <ul className="flex flex-col gap-2 text-xs" style={{ color: 'var(--ps-text-secondary)' }}>
          {[
            'Click the PS icon on any webpage to open the extension popup',
            'Quick Audit tab runs a full Lighthouse analysis on the current page',
            'If you are logged in, results are saved to your PerfScope history automatically',
            'Compare tab lets you benchmark any page against your own websites',
            'Settings you configure here are synced to the extension in real time',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}
              >
                {i + 1}
              </span>
              {text}
            </li>
          ))}
        </ul>

        <a
          href="/history"
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1 w-fit"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View all audit history
        </a>
      </section>
    </div>
  );
}
