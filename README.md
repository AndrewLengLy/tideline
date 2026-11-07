# Tideline

Shows when the highest tides of the year reach San Francisco Bay, where that water lands on the shoreline today, and where everyday high tides reach with 1 to 10 ft of sea level rise. Live at https://tides.andrewlengly.com. Sources, formulas, and limits are on the [methodology page](https://tides.andrewlengly.com/methodology).

## Run it

Every data source works with no key, and there is no database.

```bash
npm install
npm run dev
```

## Data

`data/stations.json` and `data/spots.json` are built by script and committed. Rerun them when NOAA changes a datum or a layer.

```bash
npm run build:stations
npm run build:spots
```

Official Coastal Commission dates go in `data/king-tide-dates.json` by hand, as `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }`. Matching rows on the calendar get a label.

Predictions for the next 12 months are cached and marked stale once a day by the Vercel cron at `/api/revalidate`. Observed water levels refresh every 6 minutes. Set `CRON_SECRET` in Vercel to require a bearer token on the cron route.

## Checks

```bash
npm run check-sources
npm test
npm run test:e2e
npm run copy-check
npm run colorblind
```

`npm run test:e2e` loads pages from a production build on port 3120: `npx next build && npx next start -p 3120`. `npm run crawl` and `npm run lighthouse` run against the same server.

## On a removable exFAT drive

macOS writes `._` sidecar files there, and they break the Turbopack cache in `.next`. Delete `.next` before each build on that kind of drive.
