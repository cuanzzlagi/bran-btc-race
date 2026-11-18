// BranBTC — a patient trend-rider for the make.fun cbBTC/USDC bars race.
//
// Why patient: a full-size round trip costs ~26 bps in fees, slippage and
// impact, and most 24-hour windows are chop around a slow drift. Whipsaw
// systems pay the toll ten times and keep nothing. This bot waits for one
// thing — an established uptrend — rides it with a wide leash, and treats
// every exit as expensive: after selling it sits out for three hours
// rather than buying the toll again.
//
// Entry (all must hold, at most 5 entries per window):
//   - EMA(15) above EMA(60): the trend regime is up;
//   - the close is above EMA(15): price is riding the trend, not under it;
//   - 60-bar momentum above +30 bps: the trend is actually moving;
//   - equity is within 2.5% of the start (the breaker: a window that has
//     already hurt us gets no more entries).
// Exits (first one that fires sells the whole position):
//   - trend break: the close falls 25 bps under EMA(15);
//   - trailing stop: the close falls 110 bps under the peak since entry;
//   - hard stop: the close falls 120 bps under the entry price;
//   - time stop: held more than 420 bars.
// Sizing: 90% of equity, shrunk so the estimated buy impact against the
// latest close's depth stays at or under 10 bps.
//
// Long only, no leverage, deterministic float64 indicator math: the same
// bars give the same orders every run.

import { runBars, type Bar, type BarsState, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

const EMA_FAST = 15;
const EMA_SLOW = 60;
const MOM60_MIN_BPS = 30;
const TREND_BREAK_BPS = 25;
const TRAIL_BPS = 110;
const HARD_STOP_BPS = 120;
const MAX_HOLD_BARS = 420;
const COOLDOWN_BARS = 180;
const MAX_ENTRIES = 5;
const BREAKER_DROP = 0.025;
const SIZE_FRAC = 0.90;
const IMPACT_CAP_BPS = 10n;
const BUY_SLIP_BPS = 60;
const SELL_SLIP_BPS = 100;

class Ema {
  private value: number | null = null;
  private warm: number[] = [];
  private span: number;
  constructor(span: number) {
    this.span = span;
  }
  push(x: number): number | null {
    if (this.value === null) {
      this.warm.push(x);
      if (this.warm.length === this.span) {
        this.value = this.warm.reduce((a, b) => a + b, 0) / this.span;
        this.warm = [];
      }
      return this.value;
    }
    const k = 2 / (this.span + 1);
    this.value = this.value + k * (x - this.value);
    return this.value;
  }
  get v(): number | null {
    return this.value;
  }
}

class Bot {
  private closes: number[] = [];
  private emaFast = new Ema(EMA_FAST);
  private emaSlow = new Ema(EMA_SLOW);
  private inPos = false;
  private entryClose = 0;
  private peakClose = 0;
  private heldBars = 0;
  private cooldown = 0;
  private entries = 0;
  private startEquity: bigint | null = null;

  onHello(state: BarsState): void {
    this.startEquity = state.equity;
  }

  onBatch(state: BarsState, batch: { bars: Bar[] }): OrderInput[] {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    const orders: OrderInput[] = [];
    if (bar === undefined) return orders; // absent minute: nothing to read

    const close = Number(bar.c);
    this.closes.push(close);
    this.emaFast.push(close);
    this.emaSlow.push(close);
    const fast = this.emaFast.v;
    const slow = this.emaSlow.v;

    const pos = state.positions.get(SYMBOL);
    const holding = pos !== undefined && pos.qty > 0n;
    if (holding && !this.inPos) {
      // First batch that shows the fill: adopt the position.
      this.inPos = true;
      this.entryClose = close;
      this.peakClose = close;
      this.heldBars = 0;
      this.entries++;
    }
    if (!holding && this.inPos) {
      this.inPos = false;
      this.cooldown = COOLDOWN_BARS;
    }
    if (this.cooldown > 0) this.cooldown--;

    if (state.warmingUp) return orders;

    if (this.inPos) {
      this.heldBars++;
      if (close > this.peakClose) this.peakClose = close;
      let exit = false;
      if (fast !== null && close <= fast * (1 - TREND_BREAK_BPS / 10000)) exit = true;
      if (close <= this.peakClose * (1 - TRAIL_BPS / 10000)) exit = true;
      if (close <= this.entryClose * (1 - HARD_STOP_BPS / 10000)) exit = true;
      if (this.heldBars > MAX_HOLD_BARS) exit = true;
      if (exit && pos !== undefined) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: SELL_SLIP_BPS });
      }
      return orders;
    }

    // Flat: consider an entry.
    if (this.cooldown > 0) return orders;
    if (this.entries >= MAX_ENTRIES) return orders;
    if (fast === null || slow === null) return orders;
    if (this.closes.length <= 60) return orders;
    if (this.startEquity !== null) {
      const floor = (this.startEquity * BigInt(Math.round((1 - BREAKER_DROP) * 1e6))) / 1000000n;
      if (state.equity < floor) return orders;
    }
    const mom60 = (close / this.closes[this.closes.length - 1 - 60] - 1) * 10000;
    if (!(fast > slow && close > fast && mom60 > MOM60_MIN_BPS)) return orders;

    // Size: SIZE_FRAC of equity, shrunk to the impact cap when needed.
    let notional = (state.equity * BigInt(Math.round(SIZE_FRAC * 1e6))) / 1000000n;
    if (notional > state.cash) notional = state.cash;
    const impact = state.impactBps(SYMBOL, notional);
    if (impact !== null && impact > IMPACT_CAP_BPS) {
      const scaled = (notional * IMPACT_CAP_BPS) / (impact === 0n ? 1n : impact);
      notional = (scaled * 9n) / 10n;
    }
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
    if (notional >= minNotional && notional > 0n) {
      orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: BUY_SLIP_BPS });
    }
    return orders;
  }
}

await runBars(new Bot());
