import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { healthSchema, type Health } from '@pixoo/core';
import './style.css';
import {Workspace} from './workspace';

type Phase = 'loading' | 'ready' | 'error';

function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<Health['mode']|null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // A hung request must eventually reach the same actionable error state.
    const timer = window.setTimeout(() => controller.abort(), 5000);
    let active = true;
    setPhase('loading');
    void (async () => {
      try {
        const response = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Health request failed');
        const health = healthSchema.parse(await response.json());
        if (active) { setMode(health.mode); setPhase('ready'); setInitialized(true); }
      } catch {
        if (active) setPhase('error');
      } finally { window.clearTimeout(timer); }
    })();
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [attempt]);

  return <div className="shell">
    <header className="masthead">
      <a className="brand" href="/" aria-label="Pixoo playlists home"><span className="mark" aria-hidden="true" />PIXOO / PLAYLISTS</a>
      <span className="mode">{mode === 'device' ? 'Device mode' : mode === 'simulator' ? 'Simulator mode' : 'Checking mode…'}</span>
    </header>
    <main>
      <section className="intro">
        <p className="eyebrow">A little screen. Your kind of art.</p>
        <h1>Pixoo playlists</h1>
        <p className="lede">A local home for your images, GIFs, and playlists.</p>
      </section>
      {initialized && mode && <Workspace mode={mode}/>}
      <section className="connection compact" aria-label="Local server connection">
        <div className={`status-box ${phase}`}><span className="status-dot" aria-hidden="true" />
          <p role={phase === 'error' ? 'alert' : 'status'}>{phase === 'ready' ? 'Server ready' : phase === 'loading' ? 'Checking server…' : 'Could not reach the local server or validate its response. Confirm it is running, then retry.'}</p>
        </div>
        <p className="device-note">{mode === 'device' ? 'Device transport status is shown in Settings. Visible output is unverified.' : mode === 'simulator' ? 'No physical display connected.' : 'Device status is unknown.'}</p>
        <button type="button" className="quiet" disabled={phase === 'loading'} onClick={() => setAttempt(value => value + 1)}>{phase === 'error' ? 'Retry connection' : 'Refresh status'}</button>
      </section>
    </main>
    <footer><span>Made for your Pixoo-64</span><span>Local server · {mode === 'device' ? 'Device controller' : mode === 'simulator' ? 'Simulator controller' : 'Checking controller'}</span></footer>
  </div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');
createRoot(root).render(<App />);
