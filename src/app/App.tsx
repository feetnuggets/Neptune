import { useState, useEffect, useCallback } from "react";
import {
  Search, Home, Package, Layers, Sparkles, Database, Plug, Globe,
  BookOpen, Building2, LayoutDashboard, Bell, User, Settings, Download,
  Clock, X, Menu, TrendingUp, ArrowRight, ChevronDown, Plus, Heart,
  LayoutGrid, List, Activity, Shield, Users, Zap, Trophy, Star,
  Image as ImageIcon, ExternalLink, Check, RefreshCcw, ChevronLeft,
  MessageSquare, Tag, Calendar, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModrinthProject {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  project_type: string;
  downloads: number;
  follows: number;
  icon_url: string | null;
  date_created: string;
  date_modified: string;
  latest_version: string;
  author: string;
  versions: string[];
  source?: "modrinth";
}

interface CFMod {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  categories: { name: string; id: number }[];
  logo?: { url: string };
  dateModified: string;
  dateCreated: string;
  latestFilesIndexes?: { gameVersion: string; filename: string; fileId: number }[];
  authors?: { name: string }[];
  links?: { websiteUrl: string };
  source: "curseforge";
  classId?: number;
}

type AnyProject = ModrinthProject | CFMod;

interface CFFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  downloadCount: number;
  gameVersions: string[];
  downloadUrl?: string;
}

interface CFScreenshot {
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
}

interface CFDescription {
  data: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODRINTH_API = "https://api.modrinth.com/v2";
const CF_API = "https://api.curseforge.com/v1";
const CF_KEY = "$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm";

const CF_HEADERS = {
  "x-api-key": CF_KEY,
  "Content-Type": "application/json",
};

// CurseForge class IDs
const CF_CLASS_IDS: Record<string, number> = {
  mods: 6,
  modpacks: 4471,
  resourcepacks: 12,
  shaderpacks: 6552,
  plugins: 5,
};

interface PageCfg {
  label: string;
  icon: React.ElementType;
  color: string;
  projectType: string | null;
  description: string;
}

const PAGE_CONFIG: Record<string, PageCfg> = {
  mods: { label: "Mods", icon: Package, color: "#7B2DFF", projectType: "mod", description: "Explore thousands of mods for every Minecraft version" },
  modpacks: { label: "Modpacks", icon: Layers, color: "#4F46E5", projectType: "modpack", description: "Curated mod collections ready to install and play" },
  resourcepacks: { label: "Resource Packs", icon: ImageIcon, color: "#059669", projectType: "resourcepack", description: "Transform Minecraft's visual style and textures" },
  shaderpacks: { label: "Shader Packs", icon: Sparkles, color: "#D97706", projectType: "shader", description: "Stunning lighting, shadows, and graphics overhauls" },
  datapacks: { label: "Data Packs", icon: Database, color: "#DC2626", projectType: "datapack", description: "Vanilla-compatible gameplay additions and tweaks" },
  plugins: { label: "Plugins", icon: Plug, color: "#0891B2", projectType: "plugin", description: "Server-side plugins for Paper, Spigot, and more" },
  worlds: { label: "Worlds", icon: Globe, color: "#65A30D", projectType: null, description: "Adventure maps, CTMs, and world downloads" },
};

const NAV_ITEMS = [
  { section: "Discover", items: [
    { id: "home", label: "Home", icon: Home },
    { id: "mods", label: "Mods", icon: Package },
    { id: "modpacks", label: "Modpacks", icon: Layers },
    { id: "resourcepacks", label: "Resource Packs", icon: ImageIcon },
    { id: "shaderpacks", label: "Shader Packs", icon: Sparkles },
    { id: "datapacks", label: "Data Packs", icon: Database },
    { id: "plugins", label: "Plugins", icon: Plug },
    { id: "worlds", label: "Worlds", icon: Globe },
  ]},
  { section: "Community", items: [
    { id: "collections", label: "Collections", icon: BookOpen },
    { id: "organizations", label: "Organizations", icon: Building2 },
  ]},
  { section: "Account", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "profile", label: "Profile", icon: User },
    { id: "settings", label: "Settings", icon: Settings },
  ]},
];

const MC_VERSIONS = ["1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.1","1.19.4","1.18.2","1.17.1","1.16.5","1.12.2","1.8.9"];
const LOADERS = ["Any", "Fabric", "Forge", "NeoForge", "Quilt", "Paper", "Spigot", "Purpur"];

// ─── API ─────────────────────────────────────────────────────────────────────

async function searchModrinth(projectType: string, query = "", limit = 20, index = "downloads", offset = 0, mcVersion = "", loader = ""): Promise<{ hits: ModrinthProject[]; total_hits: number }> {
  const facets: string[][] = [[`project_type:${projectType}`]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  if (loader && loader !== "Any") facets.push([`categories:${loader.toLowerCase()}`]);
  const params = new URLSearchParams({ query, facets: JSON.stringify(facets), limit: String(limit), index, offset: String(offset) });
  const res = await fetch(`${MODRINTH_API}/search?${params}`, { headers: { "User-Agent": "Neptune/1.0 (neptune.dev)" } });
  if (!res.ok) throw new Error(`Modrinth API ${res.status}`);
  const data = await res.json();
  return { hits: data.hits.map((h: ModrinthProject) => ({ ...h, source: "modrinth" as const })), total_hits: data.total_hits };
}

async function searchCurseForge(classId: number, query = "", limit = 20, offset = 0, gameVersion = "", modLoaderType?: number): Promise<{ data: CFMod[]; pagination: { totalCount: number } }> {
  const params: Record<string, string | number> = { gameId: 432, classId, pageSize: limit, index: offset };
  if (query) params.searchFilter = query;
  if (gameVersion) params.gameVersion = gameVersion;
  if (modLoaderType) params.modLoaderType = modLoaderType;
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${CF_API}/mods/search?${qs}`, { headers: CF_HEADERS });
  if (!res.ok) throw new Error(`CurseForge API ${res.status}`);
  const data = await res.json();
  return { data: data.data.map((m: CFMod) => ({ ...m, source: "curseforge" as const })), pagination: data.pagination };
}

async function getCFModFiles(modId: number): Promise<CFFile[]> {
  const res = await fetch(`${CF_API}/mods/${modId}/files?pageSize=20`, { headers: CF_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data;
}

async function getCFModDescription(modId: number): Promise<string> {
  const res = await fetch(`${CF_API}/mods/${modId}/description`, { headers: CF_HEADERS });
  if (!res.ok) return "";
  const data: CFDescription = await res.json();
  return data.data;
}

async function getCFModScreenshots(modId: number): Promise<CFScreenshot[]> {
  const res = await fetch(`${CF_API}/mods/${modId}`, { headers: CF_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.screenshots || [];
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function ago(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function tagColor(cat: string): string {
  const m: Record<string, string> = {
    optimization: "bg-emerald-500/15 text-emerald-400",
    utility: "bg-blue-500/15 text-blue-400",
    adventure: "bg-yellow-500/15 text-yellow-400",
    magic: "bg-purple-500/15 text-purple-400",
    technology: "bg-cyan-500/15 text-cyan-400",
    food: "bg-orange-500/15 text-orange-400",
    storage: "bg-pink-500/15 text-pink-400",
    combat: "bg-red-500/15 text-red-400",
    decoration: "bg-rose-500/15 text-rose-400",
    transport: "bg-indigo-500/15 text-indigo-400",
  };
  return m[cat?.toLowerCase()] ?? "bg-white/8 text-muted-foreground";
}

function getProjectId(p: AnyProject): string {
  if (p.source === "curseforge") return `cf-${(p as CFMod).id}`;
  return (p as ModrinthProject).project_id;
}

function getProjectTitle(p: AnyProject): string {
  if (p.source === "curseforge") return (p as CFMod).name;
  return (p as ModrinthProject).title;
}

function getProjectDesc(p: AnyProject): string {
  if (p.source === "curseforge") return (p as CFMod).summary;
  return (p as ModrinthProject).description;
}

function getProjectDownloads(p: AnyProject): number {
  if (p.source === "curseforge") return (p as CFMod).downloadCount;
  return (p as ModrinthProject).downloads;
}

function getProjectIcon(p: AnyProject): string | null {
  if (p.source === "curseforge") return (p as CFMod).logo?.url || null;
  return (p as ModrinthProject).icon_url;
}

function getProjectModified(p: AnyProject): string {
  return p.dateModified || (p as ModrinthProject).date_modified || "";
}

function getProjectCategories(p: AnyProject): string[] {
  if (p.source === "curseforge") return (p as CFMod).categories?.map(c => c.name) || [];
  return (p as ModrinthProject).categories || [];
}

function getProjectFollows(p: AnyProject): number {
  if (p.source === "curseforge") return 0;
  return (p as ModrinthProject).follows;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ className = "" }) {
  return <div className={`animate-pulse bg-white/5 rounded-lg ${className}`} />;
}

function SkCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex gap-3">
        <Sk className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <Sk className="h-3.5 w-3/5" />
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-4/5" />
        </div>
      </div>
      <div className="flex gap-1.5"><Sk className="h-5 w-16 rounded-full" /><Sk className="h-5 w-20 rounded-full" /></div>
      <Sk className="h-px w-full" />
      <div className="flex gap-3"><Sk className="h-3 w-14" /><Sk className="h-3 w-12" /><Sk className="h-3 w-16 ml-auto" /></div>
    </div>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  if (source === "curseforge") {
    return <span className="shrink-0 text-[9px] font-code bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded mt-0.5">CF</span>;
  }
  return <span className="shrink-0 text-[9px] font-code bg-primary/10 text-primary px-1.5 py-0.5 rounded mt-0.5">MR</span>;
}

// ─── ModCard ─────────────────────────────────────────────────────────────────

function ModCard({ project, onClick }: { project: AnyProject; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const icon = getProjectIcon(project);
  const cats = getProjectCategories(project);
  return (
    <div
      onClick={onClick}
      className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer flex flex-col gap-3"
    >
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary shrink-0 flex items-center justify-center border border-border">
          {icon && !imgErr ? (
            <img src={icon} alt={getProjectTitle(project)} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <Package size={18} className="text-muted-foreground opacity-50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate leading-5">
              {getProjectTitle(project)}
            </h3>
            <SourceBadge source={project.source} />
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{getProjectDesc(project)}</p>
        </div>
      </div>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cats.slice(0, 3).map((c) => (
            <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${tagColor(c)}`}>{c}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-2.5">
        <span className="flex items-center gap-1 font-code"><Download size={10} className="opacity-70" />{fmt(getProjectDownloads(project))}</span>
        {project.source === "modrinth" && (
          <span className="flex items-center gap-1 font-code"><Heart size={10} className="opacity-70" />{fmt(getProjectFollows(project))}</span>
        )}
        <span className="flex items-center gap-1 ml-auto"><Clock size={10} className="opacity-70" />{ago(getProjectModified(project))}</span>
      </div>
    </div>
  );
}

function ListCard({ project, onClick }: { project: AnyProject; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const icon = getProjectIcon(project);
  return (
    <div onClick={onClick} className="group bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/40 hover:bg-white/[0.02] transition-all cursor-pointer flex items-center gap-4">
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary shrink-0 flex items-center justify-center border border-border">
        {icon && !imgErr ? (
          <img src={icon} alt={getProjectTitle(project)} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <Package size={14} className="text-muted-foreground opacity-50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{getProjectTitle(project)}</p>
          <SourceBadge source={project.source} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{getProjectDesc(project)}</p>
      </div>
      <div className="flex items-center gap-5 text-xs text-muted-foreground shrink-0">
        <span className="hidden sm:flex items-center gap-1 font-code"><Download size={10} />{fmt(getProjectDownloads(project))}</span>
        <span className="hidden lg:flex items-center gap-1"><Clock size={10} />{ago(getProjectModified(project))}</span>
      </div>
    </div>
  );
}

// ─── ModDetailPage ────────────────────────────────────────────────────────────

function ModDetailPage({ project, onBack }: { project: AnyProject; onBack: () => void }) {
  const [tab, setTab] = useState<"description" | "versions" | "gallery" | "comments">("description");
  const [files, setFiles] = useState<CFFile[]>([]);
  const [description, setDescription] = useState<string>("");
  const [screenshots, setScreenshots] = useState<CFScreenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryImg, setGalleryImg] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);

  const isCF = project.source === "curseforge";
  const cfMod = isCF ? project as CFMod : null;
  const mrMod = !isCF ? project as ModrinthProject : null;
  const icon = getProjectIcon(project);

  useEffect(() => {
    if (!isCF || !cfMod) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getCFModFiles(cfMod.id),
      getCFModDescription(cfMod.id),
      getCFModScreenshots(cfMod.id),
    ]).then(([f, d, s]) => {
      setFiles(f);
      setDescription(d);
      setScreenshots(s);
    }).finally(() => setLoading(false));
  }, [isCF, cfMod?.id]);

  const TABS = [
    { id: "description", label: "Description", icon: BookOpen },
    { id: "versions", label: "Versions", icon: Tag },
    { id: "gallery", label: "Gallery", icon: ImageIcon },
    { id: "comments", label: "Comments", icon: MessageSquare },
  ] as const;

  // Fake comments for display
  const COMMENTS = [
    { user: "CraftingPro99", time: "3d ago", text: "This is exactly what I've been looking for! Works perfectly on 1.21.1 with Fabric.", stars: 5 },
    { user: "RedstoneWizard", time: "1w ago", text: "Great mod, but could use better documentation. The configuration options are a bit confusing.", stars: 4 },
    { user: "DiamondMiner2k", time: "2w ago", text: "Had some issues with conflicts on my modpack but the dev was super helpful in fixing it!", stars: 4 },
    { user: "EndermanSlayer", time: "1mo ago", text: "Essential for any serious Minecraft player. Cannot imagine playing without this anymore.", stars: 5 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
        <ChevronLeft size={15} /> Back to results
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-5 flex gap-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-secondary shrink-0 flex items-center justify-center border border-border">
          {icon && !imgErr ? (
            <img src={icon} alt={getProjectTitle(project)} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <Package size={32} className="text-muted-foreground opacity-40" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-bold text-2xl text-foreground font-display">{getProjectTitle(project)}</h1>
            <SourceBadge source={project.source} />
          </div>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{getProjectDesc(project)}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 font-code"><Download size={13} className="text-primary opacity-70" />{fmt(getProjectDownloads(project))} downloads</span>
            {mrMod && <span className="flex items-center gap-1.5 font-code"><Heart size={13} className="text-red-400 opacity-70" />{fmt(mrMod.follows)} follows</span>}
            <span className="flex items-center gap-1.5"><Calendar size={13} className="opacity-70" />Updated {ago(getProjectModified(project))}</span>
            {cfMod?.authors?.[0] && <span className="flex items-center gap-1.5"><User size={13} className="opacity-70" />{cfMod.authors[0].name}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {getProjectCategories(project).map(c => (
              <span key={c} className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${tagColor(c)}`}>{c}</span>
            ))}
          </div>
        </div>
        {isCF && cfMod?.links?.websiteUrl && (
          <a href={cfMod.links.websiteUrl} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors self-start">
            <ExternalLink size={13} /> CurseForge <ArrowRight size={11} />
          </a>
        )}
        {mrMod && (
          <a href={`https://modrinth.com/mod/${mrMod.slug}`} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors self-start">
            <ExternalLink size={13} /> Modrinth <ArrowRight size={11} />
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "description" && (
        <div className="bg-card border border-border rounded-xl p-6">
          {loading ? (
            <div className="space-y-3"><Sk className="h-4 w-full" /><Sk className="h-4 w-5/6" /><Sk className="h-4 w-4/5" /><Sk className="h-4 w-full" /></div>
          ) : description ? (
            <div
              className="prose prose-sm prose-invert max-w-none text-foreground text-sm leading-relaxed"
              style={{ lineHeight: "1.75" }}
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{getProjectDesc(project)}</p>
          )}
        </div>
      )}

      {tab === "versions" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-5 space-y-3">{Array(5).fill(0).map((_, i) => <Sk key={i} className="h-12 w-full" />)}</div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-border">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.displayName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-code">{f.fileName}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} />{ago(f.fileDate)}</span>
                      <span className="flex items-center gap-1 font-code"><Download size={10} />{fmt(f.downloadCount)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {f.gameVersions.slice(0, 3).map(v => (
                      <span key={v} className="text-[10px] bg-secondary border border-border px-2 py-0.5 rounded-full font-code text-muted-foreground">{v}</span>
                    ))}
                  </div>
                  {f.downloadUrl ? (
                    <a
                      href={f.downloadUrl}
                      className="shrink-0 flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                    >
                      <Download size={12} /> Download
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground px-3 py-1.5 bg-secondary rounded-lg border border-border flex items-center gap-1.5">
                      <AlertCircle size={12} /> Login required
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : mrMod ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">Version list available on Modrinth</p>
              <a href={`https://modrinth.com/mod/${mrMod.slug}/versions`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
                View versions <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">No version data available.</div>
          )}
        </div>
      )}

      {tab === "gallery" && (
        <div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Array(6).fill(0).map((_, i) => <Sk key={i} className="h-40 rounded-xl" />)}</div>
          ) : screenshots.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {screenshots.map(s => (
                  <button key={s.id} onClick={() => setGalleryImg(s.url)} className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all aspect-video bg-secondary">
                    <img src={s.thumbnailUrl || s.url} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {s.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{s.title}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Lightbox */}
              {galleryImg && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setGalleryImg(null)}>
                  <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                    <img src={galleryImg} alt="Gallery" className="w-full rounded-xl max-h-[80vh] object-contain" />
                    <button onClick={() => setGalleryImg(null)} className="absolute -top-4 -right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <ImageIcon size={32} className="text-muted-foreground opacity-30 mx-auto mb-3" />
              <p className="text-foreground font-medium">No gallery images</p>
              <p className="text-muted-foreground text-sm mt-1">This project hasn't uploaded any screenshots yet.</p>
            </div>
          )}
        </div>
      )}

      {tab === "comments" && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4 flex gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white shrink-0">E</div>
            <div className="flex-1">
              <textarea
                placeholder="Leave a comment..."
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                rows={2}
              />
              <button className="mt-2 bg-primary text-white text-xs px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium">Post</button>
            </div>
          </div>
          {COMMENTS.map((c, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">{c.user[0]}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-foreground">{c.user}</span>
                  <div className="flex gap-0.5">{Array(5).fill(0).map((_, si) => <Star key={si} size={11} className={si < c.stars ? "text-yellow-400 fill-yellow-400" : "text-border"} />)}</div>
                  <span className="text-xs text-muted-foreground ml-auto">{c.time}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HomePage ────────────────────────────────────────────────────────────────

function HomePage({ onNavigate, onSelectProject }: { onNavigate: (p: string) => void; onSelectProject: (p: AnyProject) => void }) {
  const [trending, setTrending] = useState<AnyProject[]>([]);
  const [cfFeatured, setCfFeatured] = useState<AnyProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      searchModrinth("mod", "", 6, "downloads"),
      searchCurseForge(6, "", 6),
    ])
      .then(([mr, cf]) => {
        setTrending(mr.hits);
        setCfFeatured(cf.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-14">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden border border-primary/20 p-8 md:p-12 bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,_rgba(123,45,255,0.18)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_100%_100%,_rgba(179,136,255,0.1)_0%,_transparent_70%)]" />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1 text-xs text-primary font-medium">
            <Zap size={10} /> The Ultimate Minecraft Ecosystem
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-[1.15] font-display">
            Discover, Create,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Deploy</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
            Neptune unifies mod hosting, modpack distribution, creator tools, launcher ecosystem, and community into one platform — powered by Modrinth, CurseForge, and GitHub.
          </p>
          <div className="flex flex-wrap gap-8 pt-2">
            {[{ label: "Projects", value: "50K+" }, { label: "Downloads", value: "2.8B+" }, { label: "Creators", value: "145K+" }, { label: "Game Versions", value: "25+" }].map(s => (
              <div key={s.label}><p className="text-2xl font-bold text-foreground font-display">{s.value}</p><p className="text-xs text-muted-foreground mt-0.5">{s.label}</p></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={() => onNavigate("mods")} className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors">
              Browse Mods <ArrowRight size={14} />
            </button>
            <button onClick={() => onNavigate("modpacks")} className="flex items-center gap-2 bg-secondary border border-border text-foreground rounded-xl px-5 py-2.5 text-sm font-semibold hover:border-primary/50 transition-colors">
              Explore Modpacks
            </button>
          </div>
        </div>
      </section>

      {/* Browse by type */}
      <section>
        <h2 className="font-bold text-base text-foreground mb-4 font-display">Browse by Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(PAGE_CONFIG).map(([id, cfg]) => {
            const Icon = cfg.icon;
            return (
              <button key={id} onClick={() => onNavigate(id)} className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-white/[0.02] transition-all text-left">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cfg.color}20` }}>
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{cfg.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{cfg.description.split(" ").slice(0, 4).join(" ")}…</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trending on Modrinth */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-primary" />
            <h2 className="font-bold text-base text-foreground font-display">Trending on Modrinth</h2>
          </div>
          <button onClick={() => onNavigate("mods")} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">View all <ArrowRight size={11} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? Array(6).fill(0).map((_, i) => <SkCard key={i} />) : trending.map(p => <ModCard key={getProjectId(p)} project={p} onClick={() => onSelectProject(p)} />)}
        </div>
      </section>

      {/* Featured on CurseForge */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-orange-400" />
            <h2 className="font-bold text-base text-foreground font-display">Featured on CurseForge</h2>
            <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded font-code">CF</span>
          </div>
          <button onClick={() => onNavigate("mods")} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">View all <ArrowRight size={11} /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? Array(6).fill(0).map((_, i) => <SkCard key={i} />) : cfFeatured.map(p => <ModCard key={getProjectId(p)} project={p} onClick={() => onSelectProject(p)} />)}
        </div>
      </section>

      {/* Platform pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Shield, title: "AI Moderation", desc: "Scans every upload for malware, stolen content, and scams before publication.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: Zap, title: "Unified Search", desc: "Search Neptune, Modrinth, CurseForge, and GitHub releases simultaneously.", color: "text-primary", bg: "bg-primary/10" },
          { icon: Activity, title: "Creator Analytics", desc: "Real-time download metrics, version performance, and engagement insights.", color: "text-accent", bg: "bg-accent/10" },
        ].map(f => (
          <div key={f.title} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center mb-3`}><f.icon size={16} className={f.color} /></div>
            <h3 className="font-semibold text-sm text-foreground mb-1.5 font-display">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

// ─── ContentBrowserPage ──────────────────────────────────────────────────────

const LIMIT = 20;

type DataSource = "both" | "modrinth" | "curseforge";

function ContentBrowserPage({ page, globalSearch, onSelectProject }: { page: string; globalSearch: string; onSelectProject: (p: AnyProject) => void }) {
  const cfg = PAGE_CONFIG[page];
  const [projects, setProjects] = useState<AnyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(globalSearch);
  const [sort, setSort] = useState("downloads");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState("Any");
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [source, setSource] = useState<DataSource>("both");

  useEffect(() => { setSearch(globalSearch); setOffset(0); }, [globalSearch, page]);

  useEffect(() => {
    if (!cfg?.projectType) { setLoading(false); return; }
    setLoading(true); setError(false);
    const cfClassId = CF_CLASS_IDS[page];

    const fetchers: Promise<AnyProject[]>[] = [];
    if (source !== "curseforge") {
      fetchers.push(
        searchModrinth(cfg.projectType, search, LIMIT, sort, offset, mcVersion, loader !== "Any" ? loader : "")
          .then(r => { setTotal(t => t + r.total_hits); return r.hits; })
          .catch(() => [])
      );
    }
    if (source !== "modrinth" && cfClassId) {
      fetchers.push(
        searchCurseForge(cfClassId, search, LIMIT, offset, mcVersion)
          .then(r => { setTotal(t => t + r.pagination.totalCount); return r.data; })
          .catch(() => [])
      );
    }

    setTotal(0);
    Promise.all(fetchers)
      .then(results => {
        const merged = results.flat();
        setProjects(merged);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page, search, sort, mcVersion, loader, offset, source]);

  if (!cfg) return null;

  if (!cfg.projectType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4"><Globe size={28} className="text-green-400 opacity-60" /></div>
        <h2 className="text-xl font-bold text-foreground mb-2 font-display">Worlds — Coming Soon</h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">Adventure maps, CTMs, and world downloads are on the Neptune roadmap.</p>
      </div>
    );
  }

  const Icon = cfg.icon;
  const totalPages = Math.ceil(total / (LIMIT * (source === "both" ? 2 : 1)));
  const currentPg = Math.floor(offset / LIMIT) + 1;
  const showLoaders = ["mods", "modpacks", "plugins"].includes(page);

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}20` }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-xl text-foreground font-display">{cfg.label}</h1>
          <p className="text-xs text-muted-foreground">{cfg.description}</p>
        </div>
        {!loading && total > 0 && (
          <span className="font-code text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg border border-border">{fmt(total)} results</span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${cfg.label.toLowerCase()}...`}
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0); }}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
          {search && <button onClick={() => { setSearch(""); setOffset(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X size={12} /></button>}
        </div>

        {/* Source selector */}
        <div className="flex border border-border rounded-xl overflow-hidden">
          {(["both", "modrinth", "curseforge"] as DataSource[]).map(s => (
            <button key={s} onClick={() => { setSource(s); setOffset(0); }} className={`px-3 py-2 text-xs font-medium transition-colors ${source === s ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}>
              {s === "both" ? "All" : s === "modrinth" ? "Modrinth" : "CurseForge"}
            </button>
          ))}
        </div>

        <select value={mcVersion} onChange={e => { setMcVersion(e.target.value); setOffset(0); }} className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none">
          <option value="">All Versions</option>
          {MC_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        {showLoaders && (
          <select value={loader} onChange={e => { setLoader(e.target.value); setOffset(0); }} className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none">
            {LOADERS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        <select value={sort} onChange={e => { setSort(e.target.value); setOffset(0); }} className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer appearance-none">
          <option value="downloads">Most Downloaded</option>
          <option value="follows">Most Followed</option>
          <option value="newest">Newest</option>
          <option value="updated">Recently Updated</option>
          <option value="relevance">Relevance</option>
        </select>

        <div className="flex border border-border rounded-xl overflow-hidden">
          <button onClick={() => setView("grid")} className={`px-3 py-2 transition-colors ${view === "grid" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}><LayoutGrid size={14} /></button>
          <button onClick={() => setView("list")} className={`px-3 py-2 transition-colors ${view === "list" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:text-foreground"}`}><List size={14} /></button>
        </div>
      </div>

      {/* Results */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <RefreshCcw size={28} className="text-muted-foreground opacity-40" />
          <p className="text-foreground font-medium">Failed to load results</p>
          <p className="text-muted-foreground text-sm">Check your connection or try again</p>
        </div>
      ) : loading ? (
        <div className={view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
          {Array(LIMIT).fill(0).map((_, i) => <SkCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <Search size={28} className="text-muted-foreground opacity-30" />
          <p className="text-foreground font-medium">No results found</p>
          <p className="text-muted-foreground text-sm">Try different search terms or filters</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map(p => <ModCard key={getProjectId(p)} project={p} onClick={() => onSelectProject(p)} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(p => <ListCard key={getProjectId(p)} project={p} onClick={() => onSelectProject(p)} />)}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button disabled={currentPg === 1} onClick={() => setOffset(offset - LIMIT)} className="px-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground disabled:opacity-30 hover:border-primary/50 transition-colors">Previous</button>
          <span className="text-sm font-code text-muted-foreground">{currentPg} / {totalPages}</span>
          <button disabled={currentPg >= totalPages} onClick={() => setOffset(offset + LIMIT)} className="px-4 py-2 text-sm bg-card border border-border rounded-xl text-foreground disabled:opacity-30 hover:border-primary/50 transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}

// ─── DashboardPage ───────────────────────────────────────────────────────────

const DL_DATA = [
  { date: "Jun 1", downloads: 12400, views: 34200 },
  { date: "Jun 5", downloads: 15200, views: 41000 },
  { date: "Jun 10", downloads: 18900, views: 52000 },
  { date: "Jun 15", downloads: 16400, views: 45000 },
  { date: "Jun 20", downloads: 21000, views: 58000 },
  { date: "Jun 25", downloads: 24500, views: 67000 },
  { date: "Jun 30", downloads: 28200, views: 75000 },
];

const PIE_DATA = [
  { name: "Mods", value: 68, color: "#7B2DFF" },
  { name: "Modpacks", value: 18, color: "#4F46E5" },
  { name: "Shaders", value: 9, color: "#D97706" },
  { name: "Other", value: 5, color: "#6B5F9E" },
];

function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-xl text-foreground font-display">Dashboard</h1>
          <p className="text-sm text-muted-foreground">EmeryTheEmail · Owner</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"><Plus size={14} /> New Project</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Downloads", value: "2.84M", delta: "+12.4%", icon: Download, up: true },
          { label: "Total Views", value: "7.2M", delta: "+8.1%", icon: Star, up: true },
          { label: "Projects", value: "14", delta: "+2 this month", icon: Package, up: true },
          { label: "Followers", value: "18.4K", delta: "+3.2%", icon: Users, up: true },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-xs text-muted-foreground">{s.label}</p><s.icon size={13} className="text-muted-foreground opacity-70" /></div>
            <p className="text-2xl font-bold text-foreground font-display">{s.value}</p>
            <p className={`text-xs mt-1 font-code ${s.up ? "text-emerald-400" : "text-red-400"}`}>{s.delta}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-sm text-foreground font-display">Downloads & Views — June 2026</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Downloads</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent inline-block" />Views</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={DL_DATA}>
              <defs>
                <linearGradient id="gDl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7B2DFF" stopOpacity={0.35} /><stop offset="95%" stopColor="#7B2DFF" stopOpacity={0} /></linearGradient>
                <linearGradient id="gVw" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#B388FF" stopOpacity={0.25} /><stop offset="95%" stopColor="#B388FF" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123,45,255,0.08)" />
              <XAxis dataKey="date" tick={{ fill: "#6B5F9E", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B5F9E", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={fmt} width={45} />
              <Tooltip contentStyle={{ background: "#0F0C2A", border: "1px solid rgba(123,45,255,0.3)", borderRadius: 10, fontSize: 12, color: "#EDE9FF" }} labelStyle={{ color: "#B388FF", marginBottom: 4 }} itemStyle={{ color: "#EDE9FF" }} />
              <Area type="monotone" dataKey="downloads" stroke="#7B2DFF" strokeWidth={2} fill="url(#gDl)" name="Downloads" />
              <Area type="monotone" dataKey="views" stroke="#B388FF" strokeWidth={2} fill="url(#gVw)" name="Views" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-sm text-foreground mb-4 font-display">Content Breakdown</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart><Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>{PIE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ background: "#0F0C2A", border: "1px solid rgba(123,45,255,0.3)", borderRadius: 8, fontSize: 12 }} /></PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">{PIE_DATA.map(d => (<div key={d.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} /><span className="text-muted-foreground">{d.name}</span></div><span className="text-foreground font-code">{d.value}%</span></div>))}</div>
        </div>
      </div>
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400 leading-relaxed flex items-start gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        Dashboard shows placeholder analytics. Connect your projects to see real data.
      </div>
    </div>
  );
}

// ─── Other pages (Collections, Organizations, etc.) ──────────────────────────

function CollectionsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"><BookOpen size={28} className="text-primary opacity-60" /></div>
      <h2 className="text-xl font-bold text-foreground mb-2 font-display">Collections — Coming Soon</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">Curated mod collections are coming to Neptune. Discover and share themed mod lists from the community.</p>
    </div>
  );
}

function OrganizationsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4"><Building2 size={28} className="text-indigo-400 opacity-60" /></div>
      <h2 className="text-xl font-bold text-foreground mb-2 font-display">Organizations — Coming Soon</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">Team accounts and organization features are on the Neptune roadmap.</p>
    </div>
  );
}

const INIT_NOTIFS = [
  { id: 1, type: "milestone", msg: "Your mod 'Sodium Plus' just hit 1M downloads!", time: "2h ago", read: false },
  { id: 2, type: "comment", msg: "Notch_Fan commented on 'Celestial Pack': 'Best pack of 2025!'", time: "5h ago", read: false },
  { id: 3, type: "version", msg: "Fabric API 0.106.1 is available — 3 of your mods may need updating", time: "1d ago", read: false },
  { id: 4, type: "follow", msg: "xX_CreeperSlayer_Xx started following you", time: "2d ago", read: true },
  { id: 5, type: "security", msg: "New login detected from Linux · Seattle, WA", time: "3d ago", read: true },
];

const N_ICON: Record<string, React.ElementType> = { milestone: Trophy, comment: Star, version: Package, follow: Users, security: Shield };

function NotificationsPage() {
  const [notifs, setNotifs] = useState(INIT_NOTIFS);
  const unread = notifs.filter(n => !n.read).length;
  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-xl text-foreground font-display">Notifications</h1>
          {unread > 0 && <span className="bg-primary text-white text-xs font-code px-2 py-0.5 rounded-full">{unread}</span>}
        </div>
        <button onClick={() => setNotifs(notifs.map(n => ({ ...n, read: true })))} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Mark all read</button>
      </div>
      <div className="space-y-2">
        {notifs.map(n => {
          const Icon = N_ICON[n.type] ?? Bell;
          return (
            <div key={n.id} onClick={() => setNotifs(notifs.map(x => x.id === n.id ? { ...x, read: true } : x))} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${n.read ? "bg-card border-border opacity-55 hover:opacity-75" : "bg-card border-primary/25 hover:border-primary/50"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.read ? "bg-secondary" : "bg-primary/15"}`}><Icon size={14} className={n.read ? "text-muted-foreground" : "text-primary"} /></div>
              <div className="flex-1"><p className="text-sm text-foreground leading-relaxed">{n.msg}</p><p className="text-xs text-muted-foreground mt-1">{n.time}</p></div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border h-44">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-accent/15" />
        <div className="absolute bottom-5 left-6 flex items-end gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-2xl border-[3px] border-background shadow-lg font-display">E</div>
          <div>
            <div className="flex items-center gap-2"><h1 className="font-bold text-xl text-foreground font-display">EmeryTheEmail</h1><Check size={14} className="text-primary" /></div>
            <p className="text-sm text-muted-foreground">Owner · Neptune Platform</p>
          </div>
        </div>
        <button className="absolute bottom-5 right-5 text-xs bg-card/80 backdrop-blur-sm border border-border text-foreground px-3 py-1.5 rounded-lg hover:border-primary/50 transition-colors">Edit Profile</button>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3 font-display">Stats</h3>
        {[["Total Downloads","2.84M"],["Projects","14"],["Followers","18.4K"],["Following","203"],["Member since","Jan 2023"]].map(([k,v]) => (
          <div key={k} className="flex justify-between text-xs py-2 border-b border-border last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-foreground font-code">{v}</span></div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const [tab, setTab] = useState("account");
  const TABS = [{ id: "account", label: "Account" }, { id: "security", label: "Security" }, { id: "notifications", label: "Notifications" }, { id: "appearance", label: "Appearance" }, { id: "api", label: "API Keys" }];
  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <h1 className="font-bold text-xl text-foreground mb-6 font-display">Settings</h1>
      <div className="flex gap-6">
        <nav className="w-40 shrink-0 space-y-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${tab === t.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>{t.label}</button>
          ))}
        </nav>
        <div className="flex-1 bg-card border border-border rounded-xl p-6 space-y-5">
          {tab === "account" && (
            <>
              <h3 className="font-semibold text-foreground font-display">Account Settings</h3>
              {[{ label: "Username", value: "EmeryTheEmail", type: "text" }, { label: "Display Name", value: "Emery", type: "text" }, { label: "Email", value: "emery@neptune.dev", type: "email" }].map(f => (
                <div key={f.label}><label className="text-xs text-muted-foreground mb-1.5 block">{f.label}</label><input type={f.type} defaultValue={f.value} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors" /></div>
              ))}
              <button className="bg-primary text-white text-sm px-5 py-2 rounded-xl hover:bg-primary/90 transition-colors font-semibold">Save Changes</button>
            </>
          )}
          {tab !== "account" && <p className="text-sm text-muted-foreground">This section is under development.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ currentPage, onNavigate, open }: { currentPage: string; onNavigate: (p: string) => void; open: boolean }) {
  return (
    <aside className={`flex flex-col border-r border-border transition-all duration-300 shrink-0 ${open ? "w-56" : "w-14"}`} style={{ background: "#0A0820" }}>
      <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border h-14 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polygon points="7,1 13,4.5 13,9.5 7,13 1,9.5 1,4.5" fill="white" opacity="0.95" /><polygon points="7,4.2 10.2,6 10.2,8 7,9.8 3.8,8 3.8,6" fill="white" opacity="0.4" /></svg>
        </div>
        {open && <span className="font-bold text-base text-foreground tracking-tight font-display">Neptune</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
        {NAV_ITEMS.map(section => (
          <div key={section.section} className="mb-3">
            {open && <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 mb-1">{section.section}</p>}
            {section.items.map(item => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)} title={!open ? item.label : undefined} className={`w-full flex items-center gap-3 px-[18px] py-[7px] text-sm transition-all relative ${active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"}`}>
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
                  <Icon size={15} className="shrink-0" />
                  {open && <span className={`text-[13px] ${active ? "font-semibold" : "font-normal"}`}>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {open ? (
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white shrink-0 font-display">E</div>
            <div className="flex-1 min-w-0"><p className="text-[12px] font-semibold truncate text-foreground">EmeryTheEmail</p><p className="text-[10px] text-muted-foreground truncate">Owner</p></div>
            <ChevronDown size={12} className="text-muted-foreground shrink-0" />
          </div>
        </div>
      ) : (
        <div className="border-t border-border p-3 shrink-0 flex justify-center">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white font-display cursor-pointer">E</div>
        </div>
      )}
    </aside>
  );
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

function TopBar({ searchInput, onSearchChange, onSearchSubmit, onToggle, onNavigate }: { searchInput: string; onSearchChange: (v: string) => void; onSearchSubmit: () => void; onToggle: () => void; onNavigate: (p: string) => void }) {
  return (
    <header className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 z-10" style={{ background: "rgba(7,5,26,0.85)", backdropFilter: "blur(12px)" }}>
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/5"><Menu size={17} /></button>
      <div className="flex-1 max-w-xl relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Search Neptune, Modrinth, CurseForge..." value={searchInput} onChange={e => onSearchChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onSearchSubmit()} className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-[7px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors" />
        {searchInput && <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X size={12} /></button>}
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={() => onNavigate("notifications")} className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5">
          <Bell size={17} /><span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
        <button onClick={() => onNavigate("profile")} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white ml-1 font-display hover:opacity-90 transition-opacity">E</button>
      </div>
    </header>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

const CONTENT_PAGES = new Set(["mods","modpacks","resourcepacks","shaderpacks","datapacks","plugins","worlds"]);

export default function App() {
  const [page, setPage] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<AnyProject | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  const navigate = (target: string) => {
    setPage(target);
    setGlobalSearch("");
    setSearchInput("");
    setSelectedProject(null);
    setPrevPage(null);
  };

  const handleSearchSubmit = () => {
    if (!searchInput.trim()) return;
    setGlobalSearch(searchInput);
    setSelectedProject(null);
    if (!CONTENT_PAGES.has(page)) setPage("mods");
  };

  const handleSelectProject = (project: AnyProject) => {
    setPrevPage(page);
    setSelectedProject(project);
  };

  const handleBack = () => {
    setSelectedProject(null);
    if (prevPage) setPage(prevPage);
  };

  // Render selected project detail
  if (selectedProject) {
    return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <Sidebar currentPage={page} onNavigate={navigate} open={sidebarOpen} />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopBar searchInput={searchInput} onSearchChange={setSearchInput} onSearchSubmit={handleSearchSubmit} onToggle={() => setSidebarOpen(o => !o)} onNavigate={navigate} />
          <main className="flex-1 overflow-y-auto scrollbar-hide">
            <ModDetailPage project={selectedProject} onBack={handleBack} />
          </main>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (page === "home") return <HomePage onNavigate={navigate} onSelectProject={handleSelectProject} />;
    if (CONTENT_PAGES.has(page)) return <ContentBrowserPage page={page} globalSearch={globalSearch} onSelectProject={handleSelectProject} />;
    if (page === "collections") return <CollectionsPage />;
    if (page === "organizations") return <OrganizationsPage />;
    if (page === "dashboard") return <DashboardPage />;
    if (page === "notifications") return <NotificationsPage />;
    if (page === "profile") return <ProfilePage />;
    if (page === "settings") return <SettingsPage />;
    return <HomePage onNavigate={navigate} onSelectProject={handleSelectProject} />;
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar currentPage={page} onNavigate={navigate} open={sidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar searchInput={searchInput} onSearchChange={setSearchInput} onSearchSubmit={handleSearchSubmit} onToggle={() => setSidebarOpen(o => !o)} onNavigate={navigate} />
        <main className="flex-1 overflow-y-auto scrollbar-hide">{renderPage()}</main>
      </div>
    </div>
  );
}
