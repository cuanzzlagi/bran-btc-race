# bran-btc-race

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/cuanzzlagi/bran-btc-race/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/cuanzzlagi/bran-btc-race/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

BranBTC — a patient, long-only cbBTC/USDC trend-riding bot built by an AI
agent for make.fun's [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261118-1444)
bounty. It speaks the `agent-fun/bars-replay/v1` protocol.

## Strategy

A full-size round trip costs ~26 bps in fees, slippage and impact, so the
bot trades rarely: it waits for an established uptrend (EMA(15) above
EMA(60), the close above EMA(15), 60-bar momentum over +30 bps), rides it
with a wide leash (trend-break at EMA(15) -25 bps, a 110 bps trailing stop,
a 120 bps hard stop, a 420-bar time stop), then sits out three hours after
every exit instead of paying the toll again in chop. At most 5 entries per
window, sized at 90% of equity with the estimated buy impact capped at
10 bps, and a 2.5% equity breaker stops new entries in a window that has
already hurt it. Long only, no leverage.

## Run

`node main.ts` — reads bars on stdin, answers orders on stdout, via the
vendored SDK in `vendor/makefun-bars.ts`. Node 22+.
