"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  Gift,
  History,
  Link2,
  Search,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { AccentPill, IconChip, type Accent } from "@/components/ui/accent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatDate, formatNumber } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import type {
  BoardMeetingsData,
  BookClosuresData,
  DividendHistoryData,
  PivotPointsData,
  PivotPointRow,
  UsefulLinksData,
} from "@/lib/services/market-resources";

export function CachedUsefulLinksPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<UsefulLinksData>({
      cacheKey: "public:useful-links:v2",
      url: "/api/public/useful-links",
      refreshInterval: 24 * 60 * 60_000,
    });
  const [query, setQuery] = React.useState("");
  const normalized = query.trim().toLowerCase();
  const groups =
    data?.groups
      .map((group) => ({
        ...group,
        links: group.links.filter((link) =>
          [link.title, link.description, link.category].some((value) =>
            value.toLowerCase().includes(normalized)
          )
        ),
      }))
      .filter((group) => group.links.length > 0) ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Useful links"
        description="Curated economy, sector, rating and research resources for Pakistan market analysis."
        icon={<Link2 />}
        eyebrow="Research toolkit"
        accent="indigo"
        actions={
          <CacheStatusBadge
            updatedAt={data?.updatedAt}
            cachedAt={cachedAt}
            isFromDeviceCache={isFromDeviceCache}
            isRefreshing={isRefreshing}
          />
        }
      />
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search economy, sector, ratings or research links..."
      />

      {groups.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.title} variant="feature" className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <IconChip accent="indigo" variant="gradient" size="sm">
                    <Link2 />
                  </IconChip>
                  {group.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {group.links.map((link) => (
                  <LinkCard key={`${link.category}-${link.href}`} link={link} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isLoading ? (
        <UsefulLinksLoadingGrid />
      ) : (
        <EmptyState
          icon={<Link2 className="size-6" />}
          title="No links found"
          description={error?.message ?? "Try another search term."}
        />
      )}
    </div>
  );
}

function UsefulLinksLoadingGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, groupIndex) => (
        <Card key={groupIndex} className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, linkIndex) => (
              <div
                key={linkIndex}
                className="min-h-28 rounded-xl border border-border bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CachedBoardMeetingsPage() {
  const resource = usePublicResource<BoardMeetingsData>(
    "public:board-meetings",
    "/api/public/board-meetings"
  );
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resource.data?.rows ?? []).filter((row) =>
      [row.symbol ?? "", row.company, row.subject, row.meetingDate].some((value) =>
        value.toLowerCase().includes(q)
      )
    );
  }, [query, resource.data]);

  return (
    <ResourceShell
      title="Board meetings"
      description="Upcoming board meetings with date, time and agenda."
      icon={<CalendarDays />}
      accent="sky"
      eyebrow="Corporate calendar"
      resource={resource}
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search company, symbol or agenda..." />
      {rows.length ? (
        <ResponsiveRows
          rows={rows}
          emptyLabel="No board meetings found"
          desktopHeaders={["Company", "Date", "Time", "Subject"]}
          renderDesktop={(row) => (
            <>
              <TableCell>
                <div className="font-semibold text-foreground">{row.company}</div>
                {row.symbol ? <div className="text-xs text-muted-foreground">{row.symbol}</div> : null}
              </TableCell>
              <TableCell>{formatDate(row.meetingDate) || row.meetingDate}</TableCell>
              <TableCell>{row.meetingTime}</TableCell>
              <TableCell className="max-w-md whitespace-normal">{row.subject}</TableCell>
            </>
          )}
          renderMobile={(row) => (
            <MobileDataCard
              title={row.company}
              eyebrow={row.symbol ?? "Board meeting"}
              value={formatDate(row.meetingDate) || row.meetingDate}
              details={[
                ["Time", row.meetingTime],
                ["Subject", row.subject],
              ]}
            />
          )}
        />
      ) : resource.isLoading ? (
        <PageLoadingState message="Loading board meetings..." variant="list" />
      ) : (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title="No board meetings found"
          description={resource.error?.message ?? "The schedule source did not return matching rows."}
        />
      )}
    </ResourceShell>
  );
}

export function CachedBookClosuresPage() {
  const resource = usePublicResource<BookClosuresData>(
    "public:book-closures",
    "/api/public/book-closures"
  );
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resource.data?.rows ?? []).filter((row) =>
      [row.symbol, row.company, row.payout].some((value) => value.toLowerCase().includes(q))
    );
  }, [query, resource.data]);

  return (
    <ResourceShell
      title="Book closures"
      description="Book closure dates with payouts only, so cash and entitlement events stay visible."
      icon={<Gift />}
      accent="amber"
      eyebrow="Entitlements"
      resource={resource}
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search symbol, company or payout..." />
      {rows.length ? (
        <ResponsiveRows
          rows={rows}
          emptyLabel="No book closures found"
          desktopHeaders={["Symbol", "Company", "From", "To", "Dividend", "Right"]}
          renderDesktop={(row) => {
            const payout = splitBookPayout(row.payout);
            return (
              <>
                <TableCell className="font-semibold">{row.symbol}</TableCell>
                <TableCell className="max-w-sm whitespace-normal">{row.company}</TableCell>
                <TableCell>{formatDate(row.bookClosureFrom) || row.bookClosureFrom}</TableCell>
                <TableCell>{formatDate(row.bookClosureTo) || row.bookClosureTo}</TableCell>
                <TableCell className="font-semibold text-gain">{payout.dividend}</TableCell>
                <TableCell className="font-semibold text-amber-600 dark:text-amber-400">{payout.right}</TableCell>
              </>
            );
          }}
          renderMobile={(row) => <CompactBookClosureCard row={row} />}
        />
      ) : resource.isLoading ? (
        <PageLoadingState message="Loading book closures..." variant="list" />
      ) : (
        <EmptyState
          icon={<Gift className="size-6" />}
          title="No payout closures found"
          description={resource.error?.message ?? "Only rows with payouts are shown here."}
        />
      )}
    </ResourceShell>
  );
}

export function CachedDividendHistoryPage() {
  const resource = usePublicResource<DividendHistoryData>(
    "public:dividend-history",
    "/api/public/dividend-history"
  );
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resource.data?.rows ?? []).filter((row) =>
      [row.symbol, row.payout, row.creditedOn].some((value) => value.toLowerCase().includes(q))
    );
  }, [query, resource.data]);

  return (
    <ResourceShell
      title="Dividend history"
      description="Payout history from official PSX data when available, with cached fallback records."
      icon={<History />}
      accent="emerald"
      eyebrow="Payout records"
      resource={resource}
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search symbol, payout or date..." />
      {rows.length ? (
        <ResponsiveRows
          rows={rows}
          emptyLabel="No dividend rows found"
          desktopHeaders={["Symbol", "Payout", "Credited on"]}
          renderDesktop={(row) => (
            <>
              <TableCell className="font-semibold">{row.symbol}</TableCell>
              <TableCell className="font-semibold text-gain">{normalizePayoutLabel(row.payout)}</TableCell>
              <TableCell>{formatDate(row.creditedOn) || row.creditedOn}</TableCell>
            </>
          )}
          renderMobile={(row) => <CompactDividendCard row={row} />}
        />
      ) : resource.isLoading ? (
        <PageLoadingState message="Loading dividend history..." variant="list" />
      ) : (
        <EmptyState
          icon={<History className="size-6" />}
          title="No dividend history found"
          description={resource.error?.message ?? "Try another symbol or payout search."}
        />
      )}
    </ResourceShell>
  );
}

export function CachedPivotPointsPage() {
  const resource = usePublicResource<PivotPointsData>("public:pivot-points", "/api/public/pivot-points");
  const [query, setQuery] = React.useState("");
  const [sector, setSector] = React.useState("all");
  const sectors = React.useMemo(
    () => ["all", ...Array.from(new Set((resource.data?.rows ?? []).map((row) => row.sector))).sort()],
    [resource.data]
  );
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resource.data?.rows ?? []).filter((row) => {
      const matchesQuery = [row.symbol, row.companyName, row.sector].some((value) =>
        value.toLowerCase().includes(q)
      );
      const matchesSector = sector === "all" || row.sector === sector;
      return matchesQuery && matchesSector;
    });
  }, [query, resource.data, sector]);
  const paginated = usePaginatedRows(rows);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Stock pivot points"
        description="Classic support and resistance levels calculated from latest PSX high, low and previous close."
        icon={<Target />}
        eyebrow="Technical levels"
        accent="teal"
        actions={
          <>
            <CacheStatusBadge
              updatedAt={resource.data?.updatedAt}
              cachedAt={resource.cachedAt}
              isFromDeviceCache={resource.isFromDeviceCache}
              isRefreshing={resource.isRefreshing}
            />
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_260px]">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search symbol, company or sector..."
            className="m-0"
          />
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All sectors" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {rows.length ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <IconChip accent="teal" variant="gradient" size="sm">
                <Target />
              </IconChip>
              Pivot levels
            </CardTitle>
            <p className="text-sm text-muted-foreground">{resource.data?.method}</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Symbol", "Current", "S3", "S2", "S1", "Pivot", "R1", "R2", "R3", "Range"].map(
                      (header) => (
                        <TableHead key={header} className={header === "Symbol" ? "" : "text-right"}>
                          {header}
                        </TableHead>
                      )
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.rows.map((row) => (
                    <PivotTableRow key={row.symbol} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">
              {paginated.rows.map((row) => (
                <PivotMobileCard key={row.symbol} row={row} />
              ))}
            </div>
            <PaginationControls
              page={paginated.page}
              pageCount={paginated.pageCount}
              start={paginated.start}
              end={paginated.end}
              total={rows.length}
              onPrevious={paginated.previous}
              onNext={paginated.next}
            />
          </CardContent>
        </Card>
      ) : resource.isLoading ? (
        <PageLoadingState message="Loading pivot points..." variant="list" />
      ) : (
        <EmptyState
          icon={<Target className="size-6" />}
          title="Pivot points are preparing"
          description={resource.error?.message ?? "Latest high, low and previous close data will appear here shortly."}
        />
      )}
    </div>
  );
}

function usePublicResource<T>(cacheKey: string, url: string) {
  return usePersistentResource<T>({
    cacheKey,
    url,
    refreshInterval: 30 * 60_000,
    pauseWhen: () => !shouldRefreshPsxData(),
    acceptCacheWhen: () => true,
  });
}

function usePaginatedRows<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(rows.length, currentPage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [rows]);

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return {
    rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    page: currentPage,
    pageCount,
    start,
    end,
    next: () => setPage((value) => Math.min(pageCount, value + 1)),
    previous: () => setPage((value) => Math.max(1, value - 1)),
  };
}

function PaginationControls({
  page,
  pageCount,
  start,
  end,
  total,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total <= 50) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onPrevious} disabled={page <= 1}>
          Previous
        </Button>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={page >= pageCount}>
          Next
        </Button>
      </div>
    </div>
  );
}

function ResourceShell<T>({
  title,
  description,
  icon,
  accent,
  eyebrow,
  resource,
  sourceUrl,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: Accent;
  eyebrow: string;
  resource: {
    data?: T | null;
    isRefreshing: boolean;
    isFromDeviceCache: boolean;
    cachedAt: string | null;
  };
  sourceUrl?: string | null;
  children: React.ReactNode;
}) {
  const updatedAt =
    resource.data && typeof resource.data === "object" && "updatedAt" in resource.data
      ? String(resource.data.updatedAt ?? "")
      : null;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        eyebrow={eyebrow}
        accent={accent}
        actions={
          <>
            <CacheStatusBadge
              updatedAt={updatedAt}
              cachedAt={resource.cachedAt}
              isFromDeviceCache={resource.isFromDeviceCache}
              isRefreshing={resource.isRefreshing}
            />
            {sourceUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Source
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center gap-3">
            <IconChip accent={accent} variant="gradient">
              {icon}
            </IconChip>
            <div>
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">Search, filter and open the latest cached rows.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 pl-9"
      />
    </div>
  );
}

function LinkCard({ link }: { link: UsefulLinksData["groups"][number]["links"][number] }) {
  const isInternal = link.href.startsWith("/");
  const content = (
    <span className="group flex h-full min-h-28 flex-col rounded-xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg hover:ring-indigo-500/30">
      <span className="mb-3 flex items-center justify-between gap-3">
        <Badge variant="info" className="bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
          {link.category}
        </Badge>
        {link.official ? (
          <Badge variant="success">Official</Badge>
        ) : null}
      </span>
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold text-foreground">{link.title}</span>
        {isInternal ? null : (
          <ExternalLink className="mt-0.5 size-4 shrink-0 text-indigo-500 transition-transform group-hover:translate-x-0.5 dark:text-indigo-400" />
        )}
      </span>
      <span className="mt-1 text-sm leading-relaxed text-muted-foreground">{link.description}</span>
    </span>
  );

  return isInternal ? (
    <Link href={link.href} prefetch={false}>
      {content}
    </Link>
  ) : (
    <a href={link.href} target="_blank" rel="noreferrer">
      {content}
    </a>
  );
}

function ResponsiveRows<T extends { id: string }>({
  rows,
  desktopHeaders,
  renderDesktop,
  renderMobile,
}: {
  rows: T[];
  emptyLabel: string;
  desktopHeaders: string[];
  renderDesktop: (row: T) => React.ReactNode;
  renderMobile: (row: T) => React.ReactNode;
}) {
  const paginated = usePaginatedRows(rows);

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {desktopHeaders.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.rows.map((row, index) => (
              <TableRow key={rowRenderKey(row, index)}>{renderDesktop(row)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {paginated.rows.map((row, index) => (
          <React.Fragment key={rowRenderKey(row, index)}>{renderMobile(row)}</React.Fragment>
        ))}
      </div>
      <PaginationControls
        page={paginated.page}
        pageCount={paginated.pageCount}
        start={paginated.start}
        end={paginated.end}
        total={rows.length}
        onPrevious={paginated.previous}
        onNext={paginated.next}
      />
    </>
  );
}

function rowRenderKey(row: { id: string }, index: number) {
  return `${row.id}:${index}`;
}

function MobileDataCard({
  title,
  eyebrow,
  value,
  details,
}: {
  title: string;
  eyebrow: string;
  value: string;
  details: Array<[string, string]>;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AccentPill accent="sky">{eyebrow}</AccentPill>
          <h3 className="mt-1.5 truncate text-lg font-semibold">{title}</h3>
        </div>
        <Badge variant="info" className="shrink-0 px-3 py-1 text-sm">
          {value}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {details.map(([label, detail]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium text-foreground">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CompactDividendCard({ row }: { row: DividendHistoryData["rows"][number] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 shadow-soft ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{row.symbol}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(row.creditedOn) || row.creditedOn}
        </p>
      </div>
      <Badge variant="gain" className="shrink-0 px-3 py-1 text-sm">
        {normalizePayoutLabel(row.payout)}
      </Badge>
    </div>
  );
}

function CompactBookClosureCard({ row }: { row: BookClosuresData["rows"][number] }) {
  const payout = splitBookPayout(row.payout);
  return (
    <div className="rounded-xl bg-card p-3 shadow-soft ring-1 ring-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{row.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{row.company}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>{formatDate(row.bookClosureFrom) || row.bookClosureFrom}</p>
          <p>{formatDate(row.bookClosureTo) || row.bookClosureTo}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {payout.dividend !== "—" ? (
          <Badge variant="gain" className="px-3 py-1 text-sm">
            {payout.dividend}
          </Badge>
        ) : null}
        {payout.right !== "—" ? (
          <Badge variant="amber" className="px-3 py-1 text-sm">
            {payout.right}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function splitBookPayout(value: string) {
  const parts = value
    .split(/\s+·\s+|,|;|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const rightParts = parts.filter((part) => /\bright/i.test(part));
  const dividendParts = parts.filter((part) => !/\bright/i.test(part));

  return {
    dividend: dividendParts.map(normalizePayoutLabel).join(", ") || "—",
    right: rightParts.map(normalizePayoutLabel).join(", ") || "—",
  };
}

function normalizePayoutLabel(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
  const ratio = text.match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/)?.[0];
  if (/\bright/i.test(text)) return `${percent ? `${percent}% ` : ""}Right`.trim();
  if (/bonus/i.test(text)) return `${percent ? `${percent}% ` : ""}Bonus`.trim();
  if (/dividend|cash|interim|final/i.test(text)) return `${percent ? `${percent}% ` : ""}Dividend`.trim();
  if (ratio) return ratio;
  return text || "—";
}

function PivotTableRow({ row }: { row: PivotPointRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-semibold">{row.symbol}</div>
        <div className="text-xs text-muted-foreground">{row.companyName}</div>
      </TableCell>
      {[row.current, row.s3, row.s2, row.s1, row.pivot, row.r1, row.r2, row.r3, row.range].map(
        (value, index) => (
          <TableCell
            key={index}
            className={cn(
              "text-right tabular-nums",
              index >= 1 && index <= 3 && "text-loss",
              index >= 5 && index <= 7 && "text-gain",
              index === 4 && "font-semibold text-primary"
            )}
          >
            {formatNumber(value, 2)}
          </TableCell>
        )
      )}
    </TableRow>
  );
}

function PivotMobileCard({ row }: { row: PivotPointRow }) {
  const levels = [
    ["S3", row.s3, "text-loss"],
    ["S2", row.s2, "text-loss"],
    ["S1", row.s1, "text-loss"],
    ["Pivot", row.pivot, "text-primary"],
    ["R1", row.r1, "text-gain"],
    ["R2", row.r2, "text-gain"],
    ["R3", row.r3, "text-gain"],
  ] as const;

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{row.symbol}</h3>
          <p className="text-sm text-muted-foreground">{row.companyName}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">
          {formatNumber(row.current, 2)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
        {levels.map(([label, value, className]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={cn("mt-1 font-semibold tabular-nums", className)}>
              {formatNumber(value, 2)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <SlidersHorizontal className="size-3" />
        High {formatNumber(row.high, 2)} · Low {formatNumber(row.low, 2)} · Prev{" "}
        {formatNumber(row.previousClose, 2)}
      </div>
    </div>
  );
}
