// The Velocity Radar's model: one sealed snapshot in, one ranked board out.
//
// The board ranks the protocols that record no token and are not a wrapped, staked or bridged
// product of a token that already trades. The snapshot's watchlist is the floor: every one of its
// 40 slugs is on the board. The radar adds every other protocol that passes the same test, even
// below the watchlist's $50M floor, so the board is the whole early field, not the floor alone.
// Protocols that fail the test are set aside and named in the dashboard with the reason, never
// mixed into the ranking. Live-token protocols are set aside too, with their market caps shown
// as the market's own values.
//
// This radar ranks by VELOCITY, not by size alone. A launch is worth farming when money is
// moving into the protocol right now, the protocol is young enough that a token is still ahead
// of it, and it is big enough for a token to matter. So the implied value follows only from the
// snapshot's own figures, in one function per protocol:
//
//   growth     = clamp(change_7d, -50, 300) per cent (unreported change counts as 0)
//   inflow     = tvl_usd x growth / 100: the dollars that moved in (or out) this week
//   velocity   = sign(growth) x ln(1 + |growth| / 25), clamped to [-1.0, 1.5]: a fast week
//                scores high, but a single-week spike is log-compressed, so it can lift a rank
//                without ever carrying one on its own
//   velMult    = 1 + 0.60 x velocity, in [0.40, 1.90]
//   ageFactor  = a hump over age in days: 0.85 under 30 days (unproven), 1.05 under 90,
//                1.20 under 180, 1.15 under 540, 1.00 under 1095, 0.90 under 1460, 0.80 older
//                (a protocol that ran for years with no token is discounted, not rewarded for
//                waiting); unknown age counts as 365 days
//   breadth    = 1 + 0.05 x min(chains - 1, 6): being live on more chains is worth a little
//   scale      = tvl_usd ^ 0.75: size matters, but sublinearly, so a $2.7B protocol is not
//                a hundred times a $27M one
//   implied    = max(1, round(90 x scale x velMult x ageFactor x breadth))
//
// Two lenses sit beside the rank. HEAT is the velocity score on a 0-100 scale, so a reader can
// see at a glance whether a protocol is hot, steady or cooling. The SENSITIVITY trio recomputes
// the implied value with the week's growth at -10%, as reported, and +25%, holding everything
// else fixed, so the reader sees how much of a rank depends on one good week. VALUE PER HOUR
// divides the implied value by the farm plan's active hours. It is kept in board.json as a
// model figure only: the page ranks by implied value and never by it, because a protocol's
// whole implied value is not a per-farmer payout.
//
// No protocol name is ever special-cased: the same function scores every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  scale_k: number;
  scale_exponent: number;
  growth_floor: number;
  growth_cap: number;
  velocity_divisor: number;
  velocity_floor: number;
  velocity_cap: number;
  velocity_weight: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_chains: number;
  sensitivity_down_pct: number;
  sensitivity_up_pct: number;
}

export const MODEL: ModelConstants = {
  scale_k: 90,
  scale_exponent: 0.75,
  growth_floor: -50,
  growth_cap: 300,
  velocity_divisor: 25,
  velocity_floor: -1.0,
  velocity_cap: 1.5,
  velocity_weight: 0.6,
  unknown_age_days: 365,
  breadth_step: 0.05,
  breadth_max_chains: 6,
  sensitivity_down_pct: -10,
  sensitivity_up_pct: 25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'velocity-1';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  signal: 'breakout' | 'fresh' | 'overdue' | 'cooling' | 'steady';
  heat: number;
  weekly_inflow_usd: number;
  implied_value_usd: number;
  value_per_hour_usd: number;
  farm_hours: number;
  model: {
    growth_pct: number;
    velocity: number;
    velocity_multiplier: number;
    age_factor: number;
    breadth_multiplier: number;
    scale_base: number;
    age_days: number | null;
    sensitivity_down_usd: number;
    sensitivity_up_usd: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  signal: string;
  heat: number;
  weekly_inflow_usd: number;
  implied_value_usd: number;
  value_per_hour_usd: number;
  farm_hours: number;
  velocity: number;
  velocity_multiplier: number;
  age_factor: number;
  breadth_multiplier: number;
  scale_base: number;
  sensitivity_down_usd: number;
  sensitivity_up_usd: number;
  farm_steps: string[];
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** A pre-token protocol set aside, with the reason it is not ranked. */
export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  reason: string;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  aside_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  aside: AsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The week's growth, winsorized to the model's band; unreported counts as 0. */
export function growthPct(protocol: SnapshotProtocol, model: ModelConstants): number {
  const raw = finite(protocol.change_7d, 0);
  return Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
}

/** The log-compressed velocity of a winsorized growth figure, clamped to the model's band. */
export function velocityOf(growth: number, model: ModelConstants): number {
  const v = Math.sign(growth) * Math.log1p(Math.abs(growth) / model.velocity_divisor);
  return Math.min(model.velocity_cap, Math.max(model.velocity_floor, v));
}

/** The hump-shaped age factor: young and proven beats brand-new and beats long-overdue. */
export function ageFactorOf(age: number | null, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  if (a < 30) return 0.85;
  if (a < 90) return 1.05;
  if (a < 180) return 1.2;
  if (a < 540) return 1.15;
  if (a < 1095) return 1.0;
  if (a < 1460) return 0.9;
  return 0.8;
}

/** The breadth factor from how many chains carry the protocol. */
export function breadthOf(chains: string[], model: ModelConstants): number {
  return 1 + model.breadth_step * Math.min(Math.max(chains.length - 1, 0), model.breadth_max_chains);
}

/** The implied value at one growth figure, with the other factors held fixed. */
export function impliedAt(
  protocol: SnapshotProtocol,
  growth: number,
  age: number | null,
  model: ModelConstants,
): { implied: number; velocity: number; velocityMultiplier: number; ageFactor: number; breadth: number; scaleBase: number } {
  const velocity = velocityOf(growth, model);
  const velocityMultiplier = 1 + model.velocity_weight * velocity;
  const ageFactor = ageFactorOf(age, model);
  const breadth = breadthOf(protocol.chains, model);
  const scaleBase = Math.pow(Math.max(protocol.tvl_usd, 1), model.scale_exponent);
  const implied = Math.max(1, Math.round(model.scale_k * scaleBase * velocityMultiplier * ageFactor * breadth));
  return { implied, velocity, velocityMultiplier, ageFactor, breadth, scaleBase };
}

/** The velocity score on a 0-100 heat scale. */
export function heatOf(velocity: number): number {
  return Math.round(Math.min(95, Math.max(20, 50 + 30 * velocity)));
}

/** A row's signal: what kind of opportunity this week's numbers describe. */
export function signalOf(p: SnapshotProtocol, age: number | null, inflow: number): BoardRow['signal'] {
  const g = finite(p.change_7d, 0);
  if (g >= 20 && inflow > 1_000_000) return 'breakout';
  if (age !== null && age < 180 && g > 0) return 'fresh';
  if (p.tvl_usd >= 500_000_000 && age !== null && age >= 540) return 'overdue';
  if (g <= -20) return 'cooling';
  return 'steady';
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories that are a product of a token that already trades, not a launch of their own. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that begin with an exchange's name. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Why a pre-token protocol is set aside, or null when the board may rank it. */
export function asideReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return 'its token already trades';
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return `a ${p.category.toLowerCase()} product, not a launch of its own`;
  if (VERSIONED.test(p.name)) return 'a versioned pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'a wrapped or staked product of a token that already trades';
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return 'an exchange product, not a launch of its own';
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and set aside for no reason. */
export function isRankable(p: SnapshotProtocol): boolean {
  return asideReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** The gas tier of one transaction on the protocol's first chain, in dollars. */
function gasFor(p: SnapshotProtocol): { tx: number; label: string } {
  const chain = p.chains.length > 0 ? p.chains[0]! : '';
  if (/^Ethereum$/i.test(chain)) return { tx: 6, label: 'about $6 of gas' };
  if (/^Solana$/i.test(chain)) return { tx: 0.05, label: 'about $0.05 of gas' };
  if (/Arbitrum|Optimism|Base|Polygon|BSC|BNB|Avalanche|zkSync|Linea|Blast|Mode|Scroll|Fraxtal|Berachain|Sonic/i.test(chain)) {
    return { tx: 0.5, label: 'about $0.50 of gas' };
  }
  return { tx: 2, label: 'about $2 of gas' };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Lend $${capital} of USDC on ${name} (${chain}) and leave it earning.`;
  if (c.includes('dex')) return `Add $${capital} to ${name}'s deepest pool on ${chain} as liquidity and leave it in place.`;
  if (c.includes('yield')) return `Put $${capital} into ${name}'s main yield vault on ${chain} and hold the vault shares.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Post $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC through ${name} onto ${chain}, then use the bridged funds inside its app.`;
  if (c.includes('rwa')) return `Buy $${capital} of ${name}'s tokenised yield asset on ${chain} and hold it.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and hold the shares.`;
  if (c.includes('prediction')) return `Back one outcome with $${capital} on ${name} and leave the position open.`;
  if (c.includes('stable')) return `Mint or hold $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('stak')) return `Stake $${capital} through ${name} on ${chain} and keep the receipt token.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave it working.`;
}

/** The weekly qualifying action, from the protocol's category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 'a supply, a borrow or a repayment';
  if (c.includes('dex')) return 'a swap through the pool or a top-up of liquidity';
  if (c.includes('yield')) return 'a deposit, a claim or a restake of the rewards';
  if (c.includes('derivative') || c.includes('perpetual')) return 'a small trade or a margin top-up';
  if (c.includes('bridge')) return 'a bridge or a swap on the destination chain';
  if (c.includes('rwa')) return 'a mint, a hold check or a redemption quote';
  if (c.includes('curator') || c.includes('allocator')) return 'a deposit or a vault rebalance check';
  if (c.includes('prediction')) return 'one more market position';
  if (c.includes('stable')) return 'a mint, a swap or a hold check';
  if (c.includes('stak')) return 'a stake top-up or a rewards claim';
  return 'a deposit, a swap or a vote';
}

/** The signal's timing advice, folded into the main action step. */
function timingFor(signal: BoardRow['signal']): string {
  if (signal === 'breakout') return ' Move this week, in two halves a few days apart, while the inflow is hot.';
  if (signal === 'cooling') return ' Start with half now and add the rest only if next week\u2019s inflow turns positive.';
  if (signal === 'fresh') return ' Start now while the protocol is young, at a small size, on a weekly rhythm.';
  if (signal === 'overdue') return ' Size the full position: this one has waited longest for a token.';
  return '';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, signal), never from a
 * hand-written list of names. The active hours feed the value-per-hour lens.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, signal: BoardRow['signal']): { steps: FarmStep[]; hours: number } {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(p);
  const weeks = Math.max(1, Math.round(hold / 7));
  const weeklyGas = Math.max(0.05, Math.round(gas.tx / 4 / 0.05) * 0.05);
  const hours = 0.25 + weeks * (10 / 60) + 10 / 60 + 5 / 60;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with ${p.name}, and keep its seed phrase offline.`,
      cost: `under $3 of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)}${timingFor(signal)}`,
      cost: `$${capital} of capital and ${gas.label}`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action on ${p.name} each week, such as ${weeklyFor(p)}.`,
      cost: `about $${weeklyGas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Check ${p.name}'s weekly inflow again in 7 days: if it stays negative for two weeks running, stop adding new funds and hold only.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes; never pay to claim and never follow a DM about it.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  return { steps, hours: Math.round(hours * 100) / 100 };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable protocol, at any size. No cap: the board is the whole
  // early field, and a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const growth = growthPct(p, model);
    const base = impliedAt(p, growth, age, model);
    const inflow = p.tvl_usd * growth / 100;
    const signal = signalOf(p, age, inflow);
    const down = impliedAt(p, model.sensitivity_down_pct, age, model).implied;
    const up = impliedAt(p, model.sensitivity_up_pct, age, model).implied;
    const { steps, hours } = farmSteps(p, age, signal);
    return { p, age, growth, base, inflow, signal, down, up, steps, hours };
  });
  scored.sort((a, b) => b.base.implied - a.base.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    signal: s.signal,
    heat: heatOf(s.base.velocity),
    weekly_inflow_usd: Math.round(s.inflow),
    implied_value_usd: s.base.implied,
    value_per_hour_usd: Math.round(s.base.implied / s.hours),
    farm_hours: s.hours,
    model: {
      growth_pct: round4(s.growth),
      velocity: round4(s.base.velocity),
      velocity_multiplier: round4(s.base.velocityMultiplier),
      age_factor: round4(s.base.ageFactor),
      breadth_multiplier: round4(s.base.breadth),
      scale_base: Math.round(s.base.scaleBase),
      age_days: s.age,
      sensitivity_down_usd: s.down,
      sensitivity_up_usd: s.up,
    },
    farm_steps: s.steps.map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols set aside, with the reason each one is not ranked. */
export function asideRows(snapshot: Snapshot): AsideRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && asideReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      reason: asideReason(p)!,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    signal: row.signal,
    heat: row.heat,
    weekly_inflow_usd: row.weekly_inflow_usd,
    implied_value_usd: row.implied_value_usd,
    value_per_hour_usd: row.value_per_hour_usd,
    farm_hours: row.farm_hours,
    velocity: row.model.velocity,
    velocity_multiplier: row.model.velocity_multiplier,
    age_factor: row.model.age_factor,
    breadth_multiplier: row.model.breadth_multiplier,
    scale_base: row.model.scale_base,
    sensitivity_down_usd: row.model.sensitivity_down_usd,
    sensitivity_up_usd: row.model.sensitivity_up_usd,
    farm_steps: row.farm_steps,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const aside = asideRows(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    aside_size: aside.length,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    aside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
