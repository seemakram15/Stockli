import "server-only";
import { monitorFetchJson } from "@/lib/services/control-panel/monitor-http";

export type VercelMonitorSnapshot = {
  scannedAt: string;
  configured: boolean;
  missing: string[];
  project: {
    id: string;
    name: string;
    framework: string | null;
    nodeVersion: string | null;
    region: string | null;
    live: boolean | null;
    createdAt: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    plan: string | null;
    billingStatus: string | null;
  } | null;
  latestDeployment: {
    id: string;
    url: string | null;
    state: string | null;
    createdAt: string | null;
    readyAt: string | null;
  } | null;
  deployments: Array<{
    id: string;
    url: string | null;
    state: string | null;
    createdAt: string | null;
    target: string | null;
  }>;
  crons: Array<{ path: string; schedule: string }>;
  envVarCount: number;
  speedInsightsEnabled: boolean;
  notes: string[];
};

type VercelProject = {
  id?: string;
  name?: string;
  framework?: string | null;
  nodeVersion?: string | null;
  serverlessFunctionRegion?: string | null;
  live?: boolean | null;
  createdAt?: number | null;
  env?: unknown[];
  crons?: { definitions?: Array<{ path?: string; schedule?: string }> };
  speedInsights?: { enabledAt?: number | null; hasData?: boolean };
  latestDeployments?: Array<{
    id?: string;
    uid?: string;
    url?: string;
    readyState?: string;
    createdAt?: number;
    ready?: number;
  }>;
};

type VercelTeam = {
  id?: string;
  name?: string;
  slug?: string;
  billing?: { plan?: string; status?: string };
};

type VercelDeployments = {
  deployments?: Array<{
    uid?: string;
    url?: string;
    state?: string;
    readyState?: string;
    createdAt?: number;
    target?: string | null;
  }>;
};

function msToIso(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export async function getVercelMonitorSnapshot(): Promise<VercelMonitorSnapshot> {
  const scannedAt = new Date().toISOString();
  const token = process.env.VERCEL_TOKEN?.trim() ?? "";
  const projectId = process.env.VERCEL_STOCKLI_PROJECT_ID?.trim() ?? "";
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || "team_NeVlRdDM9trdOxRXdo27LxoR";
  const missing: string[] = [];
  if (!token) missing.push("VERCEL_TOKEN");
  if (!projectId) missing.push("VERCEL_STOCKLI_PROJECT_ID");
  if (missing.length) {
    return emptySnapshot(scannedAt, missing, ["Add Vercel API credentials to .env.local."]);
  }

  const headers = { Authorization: `Bearer ${token}` };
  const teamQs = `teamId=${encodeURIComponent(teamId)}`;

  const [project, team, deployments] = await Promise.all([
    monitorFetchJson<VercelProject>(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}?${teamQs}`,
      { headers }
    ),
    monitorFetchJson<VercelTeam>(`https://api.vercel.com/v2/teams/${encodeURIComponent(teamId)}`, {
      headers,
    }),
    monitorFetchJson<VercelDeployments>(
      `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&${teamQs}&limit=8`,
      { headers }
    ),
  ]);

  const latest = project.latestDeployments?.[0];
  const notes: string[] = [
    "Vercel Hobby/Plus billing usage graphs are limited via public API; live project + deploy health is shown.",
  ];

  return {
    scannedAt,
    configured: true,
    missing: [],
    project: {
      id: project.id ?? projectId,
      name: project.name ?? "mystockli",
      framework: project.framework ?? null,
      nodeVersion: project.nodeVersion ?? null,
      region: project.serverlessFunctionRegion ?? null,
      live: project.live ?? null,
      createdAt: msToIso(project.createdAt),
    },
    team: {
      id: team.id ?? teamId,
      name: team.name ?? "—",
      slug: team.slug ?? "—",
      plan: team.billing?.plan ?? null,
      billingStatus: team.billing?.status ?? null,
    },
    latestDeployment: latest
      ? {
          id: latest.id ?? latest.uid ?? "—",
          url: latest.url ?? null,
          state: latest.readyState ?? null,
          createdAt: msToIso(latest.createdAt),
          readyAt: msToIso(latest.ready),
        }
      : null,
    deployments: (deployments.deployments ?? []).map((d) => ({
      id: d.uid ?? "—",
      url: d.url ?? null,
      state: d.readyState ?? d.state ?? null,
      createdAt: msToIso(d.createdAt),
      target: d.target ?? null,
    })),
    crons: (project.crons?.definitions ?? []).map((c) => ({
      path: c.path ?? "—",
      schedule: c.schedule ?? "—",
    })),
    envVarCount: Array.isArray(project.env) ? project.env.length : 0,
    speedInsightsEnabled: Boolean(project.speedInsights?.enabledAt),
    notes,
  };
}

function emptySnapshot(
  scannedAt: string,
  missing: string[],
  notes: string[]
): VercelMonitorSnapshot {
  return {
    scannedAt,
    configured: false,
    missing,
    project: null,
    team: null,
    latestDeployment: null,
    deployments: [],
    crons: [],
    envVarCount: 0,
    speedInsightsEnabled: false,
    notes,
  };
}
