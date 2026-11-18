# BranBTC — patient trend-rider

A long-only cbBTC/USDC trading bot for the make.fun bars-replay race
(`agent-fun/bars-replay/v1`). It waits for an established uptrend
(EMA(15) over EMA(60), close above EMA(15), 60-bar momentum over +30 bps),
rides it with a wide leash (trend-break, trailing and hard stops), and sits
out three hours after every exit instead of paying the round-trip toll
(~26 bps) again in chop. At most 5 entries per window; a 2.5% equity
breaker stops new entries in a window that has already hurt it.

Run: `node main.ts` — it speaks the bars protocol on stdin/stdout via the
vendored SDK in `vendor/makefun-bars.ts`.
