'use client';
import { useState, useEffect, FormEvent } from 'react';
import { Shield, RefreshCw, Save, Plus, Trash2, CheckCircle, XCircle, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface EndpointHealth {
  url: string;
  healthy: boolean;
  latencyMs?: number;
  lastChecked: string;
  lastError?: string;
}

interface Status {
  endpoints: EndpointHealth[];
  currentEndpoint: string;
  lastSuccessfulCall: string | null;
  errorCountLastHour: number;
  totalRequests: number;
  uptimeSeconds: number;
  recentErrors: Array<{ time: number; endpoint: string; message: string }>;
}

interface Config {
  endpoints: string[];
  featuredCollections: string[];
  blockedCollections: string[];
  blockedTemplates: string[];
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [status, setStatus] = useState<Status | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Editable endpoint list
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [newEndpoint, setNewEndpoint] = useState('');
  const [featuredStr, setFeaturedStr] = useState('');
  const [blockedStr, setBlockedStr] = useState('');

  // Check if already authed by trying to load config
  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => {
        if (r.ok) {
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  // Load config + status when authed
  useEffect(() => {
    if (!authed) return;
    loadAll();
  }, [authed]);

  const loadAll = async () => {
    setStatusLoading(true);
    try {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/admin/config').then((r) => r.json()),
        fetch('/api/admin/status').then((r) => r.json()),
      ]);
      if (configRes.success) {
        setConfig(configRes.data);
        setEndpoints(configRes.data.endpoints ?? []);
        setFeaturedStr((configRes.data.featuredCollections ?? []).join('\n'));
        setBlockedStr((configRes.data.blockedCollections ?? []).join('\n'));
      }
      if (statusRes.success) {
        setStatus(statusRes.data);
      }
    } catch (err) {
      console.error('Admin load failed:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.success) {
        setAuthed(true);
      } else {
        setLoginError(json.error ?? 'Invalid password');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setConfig(null);
    setStatus(null);
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoints,
          featuredCollections: featuredStr.split('\n').map((s) => s.trim()).filter(Boolean),
          blockedCollections: blockedStr.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveMsg('Saved successfully');
        loadAll();
      } else {
        setSaveMsg('Save failed: ' + (json.error ?? 'unknown'));
      }
    } finally {
      setSaveLoading(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // Loading / unknown auth state
  if (authed === null) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Login form
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-zinc-400">Enter your admin password to continue</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-3 w-full max-w-xs">
          <Input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={loginError}
          />
          <Button type="submit" loading={loginLoading}>
            Login
          </Button>
        </form>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadAll} disabled={statusLoading}>
            <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* System Status */}
      {status && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">System Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500">Uptime</p>
              <p className="text-lg font-bold text-white">{formatUptime(status.uptimeSeconds)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500">Total Requests</p>
              <p className="text-lg font-bold text-white">{status.totalRequests.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500">Errors (1h)</p>
              <p className={`text-lg font-bold ${status.errorCountLastHour > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {status.errorCountLastHour}
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500">Last Success</p>
              <p className="text-sm font-medium text-white truncate">
                {status.lastSuccessfulCall
                  ? new Date(status.lastSuccessfulCall).toLocaleTimeString()
                  : 'None'}
              </p>
            </div>
          </div>

          {/* Current endpoint */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">Active Endpoint</p>
            <p className="font-mono text-sm text-amber-400">{status.currentEndpoint}</p>
          </div>

          {/* Endpoint health */}
          <div className="flex flex-col gap-2">
            {status.endpoints.map((ep) => (
              <div key={ep.url} className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-3 gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {ep.healthy ? (
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="font-mono text-sm text-zinc-300 truncate">{ep.url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ep.latencyMs ? (
                    <Badge variant={ep.latencyMs < 500 ? 'green' : ep.latencyMs < 1500 ? 'amber' : 'red'}>
                      {ep.latencyMs}ms
                    </Badge>
                  ) : null}
                  <Badge variant={ep.healthy ? 'green' : 'red'}>
                    {ep.healthy ? 'OK' : 'Down'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Recent errors */}
          {status.recentErrors.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-zinc-400">Recent Errors</h3>
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 max-h-52 overflow-y-auto">
                {status.recentErrors.slice(0, 15).map((e, i) => (
                  <div key={i} className="text-xs font-mono text-red-400 border-b border-zinc-800/50 py-1.5 last:border-0">
                    <span className="text-zinc-600 mr-2">{new Date(e.time).toLocaleTimeString()}</span>
                    <span className="text-zinc-500 mr-2">[{new URL(e.endpoint).hostname}]</span>
                    {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Config */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">Configuration</h2>

        {/* Endpoints */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-zinc-400">API Endpoints (in priority order)</label>
          {endpoints.map((ep, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={ep} onChange={(e) => {
                const next = [...endpoints];
                next[i] = e.target.value;
                setEndpoints(next);
              }} />
              <button
                onClick={() => setEndpoints(endpoints.filter((_, j) => j !== i))}
                className="text-red-500 hover:text-red-400 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              placeholder="https://wax.api.atomicassets.io"
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (newEndpoint.trim()) {
                  setEndpoints([...endpoints, newEndpoint.trim()]);
                  setNewEndpoint('');
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Featured collections */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-zinc-400">Featured Collections (one per line)</label>
          <textarea
            value={featuredStr}
            onChange={(e) => setFeaturedStr(e.target.value)}
            rows={4}
            placeholder="e.g. atomicairdrops&#10;thecryptofive"
            className="w-full rounded-lg bg-zinc-800/80 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono resize-none"
          />
        </div>

        {/* Blocked collections */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-zinc-400">Blocked Collections (one per line – hide from UI)</label>
          <textarea
            value={blockedStr}
            onChange={(e) => setBlockedStr(e.target.value)}
            rows={4}
            placeholder="e.g. spamcollect1"
            className="w-full rounded-lg bg-zinc-800/80 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} loading={saveLoading}>
            <Save className="w-4 h-4" />
            Save Configuration
          </Button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </section>

      {/* Diagnostics */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white border-b border-zinc-800 pb-2">Diagnostics</h2>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-400 hover:underline"
          >
            /api/health — live endpoint status
          </a>
          <span className="text-zinc-600">·</span>
          <a
            href="/api/assets?owner=futuresrelic&limit=1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-400 hover:underline"
          >
            Test API call (1 asset)
          </a>
        </div>
      </section>
    </div>
  );
}
