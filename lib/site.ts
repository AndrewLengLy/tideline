export const SITE_URL = "https://tides.andrewlengly.com";
export const SITE_NAME = "Tideline";
export const REPO_URL = "https://github.com/AndrewLengLy/tideline";
/** Same name, address and Person id as the portfolio, so the credit and the JSON-LD point at one person. */
export const AUTHOR_NAME = "Andrew Ly";
export const AUTHOR_URL = "https://www.andrewlengly.com";
export const AUTHOR_ID = `${AUTHOR_URL}/#person`;

export const SAFETY_LINE = "For situational awareness only. Follow official alerts and evacuation orders.";

export const LINKS = {
  nws: "https://www.weather.gov/mtr",
  coops: "https://tidesandcurrents.noaa.gov",
  coopsDocs: "https://api.tidesandcurrents.noaa.gov/api/prod/",
  coopsMeta: "https://api.tidesandcurrents.noaa.gov/mdapi/prod/",
  coopsDerived: "https://api.tidesandcurrents.noaa.gov/dpapi/prod/",
  slrViewer: "https://coast.noaa.gov/slr/",
  slrServices: "https://coast.noaa.gov/arcgis/rest/services/dc_slr",
  kingTides: "https://www.coastal.ca.gov/kingtides/",
  kingTidesParticipate: "https://www.coastal.ca.gov/kingtides/participate.html",
  kingTidesUpload: "https://survey123.arcgis.com/share/046c76a1ffa14902bb8ab2d6bb874456",
  usgsImagery: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
  awsTerrain: "https://registry.opendata.aws/terrain-tiles/",
  openFreeMap: "https://openfreemap.org",
  osm: "https://www.openstreetmap.org/copyright",
} as const;

/** Default map view: from just outside the Golden Gate, looking east across the central Bay to Alameda. */
export const DEFAULT_VIEW = { lat: 37.822, lng: -122.372, zoom: 11.28, pitch: 62, bearing: 70 } as const;
export const PHONE_VIEW = { lat: 37.815, lng: -122.385, zoom: 10.25, pitch: 55, bearing: 70 } as const;

export const DEFAULT_STATION_ID = "9414750";
export const STATION_ROUTE = "/stations";
export const SPOT_ROUTE = "/spots";
