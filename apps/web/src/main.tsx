import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { healthSchema } from '@pixoo/core';
import './style.css';

type Phase = 'loading' | 'ready' | 'error';

function App() {
  const [phase, setPhase] = useState<Phase>('loading');
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
        healthSchema.parse(await response.json());
        if (active) setPhase('ready');
      } catch {
        if (active) setPhase('error');
      } finally { window.clearTimeout(timer); }
    })();
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [attempt]);

  return <div className="shell">
    <header className="masthead">
      <a className="brand" href="/" aria-label="Pixoo playlists home"><span className="mark" aria-hidden="true" />PIXOO / PLAYLISTS</a>
      <span className="mode">Simulator mode</span>
    </header>
    <main>
      <section className="intro">
        <p className="eyebrow">A little screen. Your kind of art.</p>
        <h1>Pixoo playlists</h1>
        <p className="lede">A local home for your images, GIFs, and playlists.</p>
      </section>
      <section className="foundation" aria-label="Simulator connection">
        <div className="display" aria-label="Empty display preview">
          <div className="pixel-grid" aria-hidden="true"><span className="pixel-cross" /></div>
          <p>No media loaded</p><span className="dimensions">64 × 64</span>
        </div>
        <div className="connection">
          <p className="eyebrow">Local connection</p>
          <h2>Connection status</h2>
          <div className={`status-box ${phase}`}>
            <span className="status-dot" aria-hidden="true" />
            <p role={phase === 'error' ? 'alert' : 'status'}>
              {phase === 'ready' ? 'Server ready' : phase === 'loading' ? 'Checking server…' : 'Could not reach the local server or validate its response. Confirm it is running, then retry.'}
            </p>
          </div>
          <p className="device-note">No physical display connected.</p>
          <button type="button" disabled={phase === 'loading'} onClick={() => setAttempt(value => value + 1)}>
            {phase === 'error' ? 'Retry connection' : 'Refresh status'}<span aria-hidden="true"> ↗</span>
          </button>
          <p className="availability">Media and playback controls are not available in this build.</p>
        </div>
      </section>
    </main>
    <footer><span>Made for your Pixoo-64</span><span>Local server · Simulator foundation</span></footer>
  </div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');
createRoot(root).render(<App />);
