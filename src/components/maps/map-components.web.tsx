import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
type Coordinate = {
  latitude: number;
  longitude: number;
};
type Region = Coordinate & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};
type MapViewProps = {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  children?: React.ReactNode;
  onRegionChangeComplete?: (region: Region) => void;
  [key: string]: any;
};
type MarkerProps = {
  coordinate?: Coordinate;
  children?: React.ReactNode;
  title?: string;
  description?: string;
  pinColor?: string;
  zIndex?: number;
  [key: string]: any;
};
type PolylineProps = {
  coordinates?: Coordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  [key: string]: any;
};
type CircleProps = {
  center?: Coordinate;
  radius?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  [key: string]: any;
};
const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};
function normalizeRegion(region: Region | null | undefined): Region {
  return {
    latitude: region?.latitude ?? DEFAULT_REGION.latitude,
    longitude: region?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta: Math.max(
      region?.latitudeDelta ?? DEFAULT_REGION.latitudeDelta!,
      0.002,
    ),
    longitudeDelta: Math.max(
      region?.longitudeDelta ?? DEFAULT_REGION.longitudeDelta!,
      0.002,
    ),
  };
}
function regionToZoom(region: Region) {
  const normalized = normalizeRegion(region);
  const delta = Math.max(
    normalized.latitudeDelta ?? 0.025,
    normalized.longitudeDelta ?? 0.025,
  );
  const zoom = Math.log2(360 / delta) - 1.25;
  return Math.max(3, Math.min(19, zoom));
}
function makeMapDocument(region: Region) {
  const normalized = normalizeRegion(region);
  const latitude = normalized.latitude;
  const longitude = normalized.longitude;
  const zoom = regionToZoom(normalized);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"
  />
  <link
    href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css"
    rel="stylesheet"
  />
  <style>
    html, body, #map {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #442C78;
    }
    body {
      font-family: Arial, sans-serif;
    }
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-bottom-right {
      opacity: 0.58;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
  <script>
    const map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [${longitude}, ${latitude}],
      zoom: ${zoom},
      interactive: true,
      attributionControl: true,
      pitch: 0,
      bearing: 0
    });
    function safeSetPaint(layerId, property, value) {
      try {
        map.setPaintProperty(layerId, property, value);
      } catch (_) {}
    }
    function safeSetLayout(layerId, property, value) {
      try {
        map.setLayoutProperty(layerId, property, value);
      } catch (_) {}
    }
    function colorMissionTrailMap() {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      style.layers.forEach((layer) => {
        const id = String(layer.id || "").toLowerCase();
        const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
        const name = id + " " + sourceLayer;
        if (layer.type === "background") {
          safeSetPaint(layer.id, "background-color", "#442C78");
          safeSetPaint(layer.id, "background-opacity", 1);
          return;
        }
        if (layer.type === "fill") {
          if (
            name.includes("water") ||
            name.includes("ocean") ||
            name.includes("lake") ||
            name.includes("river")
          ) {
            safeSetPaint(layer.id, "fill-color", "#087FC7");
            safeSetPaint(layer.id, "fill-opacity", 0.95);
            return;
          }
          if (
            name.includes("park") ||
            name.includes("grass") ||
            name.includes("wood") ||
            name.includes("forest") ||
            name.includes("landcover") ||
            name.includes("vegetation")
          ) {
            safeSetPaint(layer.id, "fill-color", "#087A3D");
            safeSetPaint(layer.id, "fill-opacity", 0.88);
            return;
          }
          if (
            name.includes("building") ||
            name.includes("commercial") ||
            name.includes("industrial")
          ) {
            safeSetPaint(layer.id, "fill-color", "#632C63");
            safeSetPaint(layer.id, "fill-outline-color", "#8B4B8B");
            safeSetPaint(layer.id, "fill-opacity", 0.88);
            return;
          }
          if (
            name.includes("land") ||
            name.includes("residential") ||
            name.includes("place") ||
            name.includes("background")
          ) {
            safeSetPaint(layer.id, "fill-color", "#442C78");
            safeSetPaint(layer.id, "fill-opacity", 0.96);
          }
        }
        if (layer.type === "fill-extrusion") {
          if (
            name.includes("building") ||
            name.includes("commercial") ||
            name.includes("industrial")
          ) {
            safeSetPaint(layer.id, "fill-extrusion-color", "#632C63");
            safeSetPaint(layer.id, "fill-extrusion-opacity", 0.94);
            return;
          }
        }
        if (layer.type === "line") {
          const isHighway =
            name.includes("motorway") ||
            name.includes("trunk") ||
            name.includes("highway");
          const isRail =
            name.includes("rail") ||
            name.includes("transit");
          const isRoad =
            name.includes("road") ||
            name.includes("street") ||
            name.includes("transportation") ||
            name.includes("path") ||
            name.includes("track") ||
            name.includes("minor") ||
            name.includes("major");
          if (isHighway) {
            safeSetPaint(layer.id, "line-color", "#FF3038");
            safeSetPaint(layer.id, "line-opacity", 1);
            return;
          }
          if (isRail) {
            safeSetPaint(layer.id, "line-color", "#B388FF");
            safeSetPaint(layer.id, "line-opacity", 0.8);
            return;
          }
          if (isRoad) {
            safeSetPaint(layer.id, "line-color", "#00B2FF");
            safeSetPaint(layer.id, "line-opacity", 1);
            try {
              const width = map.getPaintProperty(layer.id, "line-width");
              if (typeof width === "number") {
                safeSetPaint(layer.id, "line-width", Math.max(width, 2));
              }
            } catch (_) {}
            return;
          }
          if (
            name.includes("water") ||
            name.includes("river") ||
            name.includes("stream")
          ) {
            safeSetPaint(layer.id, "line-color", "#19D8FF");
            safeSetPaint(layer.id, "line-opacity", 0.95);
          }
        }
        if (layer.type === "symbol") {
          safeSetPaint(layer.id, "text-color", "#F2E9FF");
          safeSetPaint(layer.id, "text-halo-color", "#1A0D35");
          safeSetPaint(layer.id, "text-halo-width", 1.35);
          safeSetPaint(layer.id, "text-halo-blur", 0.35);
          if (
            name.includes("road") ||
            name.includes("street") ||
            name.includes("transportation")
          ) {
            safeSetPaint(layer.id, "text-color", "#E9D8FF");
          }
          if (
            name.includes("water") ||
            name.includes("ocean") ||
            name.includes("lake")
          ) {
            safeSetPaint(layer.id, "text-color", "#6FE7FF");
          }
          safeSetLayout(layer.id, "text-allow-overlap", false);
        }
      });
    }
    map.on("load", () => {
      colorMissionTrailMap();
    });
    map.on("styledata", () => {
      if (map.isStyleLoaded()) {
        colorMissionTrailMap();
      }
    });
    function sendRegionToParent() {
      const center = map.getCenter();
      const bounds = map.getBounds();
      window.parent.postMessage({
        type: "MISSION_TRAIL_MAP_REGION",
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
        longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest())
      }, "*");
    }
    map.on("moveend", sendRegionToParent);
    map.on("zoomend", sendRegionToParent);
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "MISSION_TRAIL_SET_REGION") return;
      const nextLatitude = Number(data.latitude);
      const nextLongitude = Number(data.longitude);
      const nextZoom = Number(data.zoom);
      if (
        !Number.isFinite(nextLatitude) ||
        !Number.isFinite(nextLongitude) ||
        !Number.isFinite(nextZoom)
      ) return;
      map.easeTo({
        center: [nextLongitude, nextLatitude],
        zoom: nextZoom,
        duration: data.animated === false ? 0 : 650,
      });
    });
</script>
</body>
</html>`;
}
function coordinateToPercent(
  coordinate: Coordinate,
  region: Region,
): { left: number; top: number } {
  const normalized = normalizeRegion(region);
  const west = normalized.longitude - normalized.longitudeDelta! / 2;
  const east = normalized.longitude + normalized.longitudeDelta! / 2;
  const south = normalized.latitude - normalized.latitudeDelta! / 2;
  const north = normalized.latitude + normalized.latitudeDelta! / 2;
  const longitudeRange = Math.max(east - west, 0.0000001);
  const latitudeRange = Math.max(north - south, 0.0000001);
  const left = ((coordinate.longitude - west) / longitudeRange) * 100;
  const top = ((north - coordinate.latitude) / latitudeRange) * 100;
  return {
    left: Math.max(-20, Math.min(120, left)),
    top: Math.max(-20, Math.min(120, top)),
  };
}
function metersToLatitudeDegrees(meters: number) {
  return meters / 111_320;
}
function metersToLongitudeDegrees(meters: number, latitude: number) {
  const longitudeScale = Math.max(
    0.2,
    Math.cos((latitude * Math.PI) / 180),
  );
  return meters / (111_320 * longitudeScale);
}
type WebMapContextValue = {
  region: Region;
};
const WebMapContext = React.createContext<WebMapContextValue | null>(null);
export const MapView = forwardRef<any, MapViewProps>(function WebMapView(
  {
    style,
    initialRegion,
    region,
    children,
    onRegionChangeComplete,
  },
  ref,
) {
  const [currentRegion, setCurrentRegion] = useState<Region>(
    normalizeRegion(region ?? initialRegion),
  );
  const iframeRef = useRef<any>(null);
  const initialMapRegionRef = useRef<Region>(
    normalizeRegion(region ?? initialRegion),
  );
  // Keep the iframe document stable so mouse-wheel/pinch zoom does not reset.
  const mapDocument = useMemo(
    () => makeMapDocument(initialMapRegionRef.current),
    [],
  );
  const sendRegionToMap = React.useCallback(
    (nextRegion: Region, animated = true) => {
      const normalized = normalizeRegion(nextRegion);
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "MISSION_TRAIL_SET_REGION",
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          zoom: regionToZoom(normalized),
          animated,
        },
        "*",
      );
    },
    [],
  );
  useEffect(() => {
    if (!region) return;
    const normalized = normalizeRegion(region);
    setCurrentRegion(normalized);
    sendRegionToMap(normalized, true);
  }, [
    region?.latitude,
    region?.longitude,
    region?.latitudeDelta,
    region?.longitudeDelta,
    sendRegionToMap,
  ]);
useImperativeHandle(
    ref,
    () => ({
      animateToRegion(nextRegion: Region) {
        const normalized = normalizeRegion(nextRegion);
        setCurrentRegion(normalized);
        onRegionChangeComplete?.(normalized);
      },
      fitToCoordinates(
        coordinates: Coordinate[],
        options?: {
          edgePadding?: {
            top?: number;
            right?: number;
            bottom?: number;
            left?: number;
          };
          animated?: boolean;
        },
      ) {
        void options;
        if (!coordinates || coordinates.length === 0) return;
        const latitudes = coordinates.map((coordinate) => coordinate.latitude);
        const longitudes = coordinates.map((coordinate) => coordinate.longitude);
        const minLatitude = Math.min(...latitudes);
        const maxLatitude = Math.max(...latitudes);
        const minLongitude = Math.min(...longitudes);
        const maxLongitude = Math.max(...longitudes);
        const nextRegion: Region = {
          latitude: (minLatitude + maxLatitude) / 2,
          longitude: (minLongitude + maxLongitude) / 2,
          latitudeDelta: Math.max((maxLatitude - minLatitude) * 2.1, 0.006),
          longitudeDelta: Math.max((maxLongitude - minLongitude) * 2.1, 0.006),
        };
        const normalized = normalizeRegion(nextRegion);
        setCurrentRegion(normalized);
        onRegionChangeComplete?.(normalized);
      },
    }),
    [onRegionChangeComplete, sendRegionToMap],
  );
  const contextValue = useMemo(
    () => ({
      region: currentRegion,
    }),
    [currentRegion],
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMapMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "MISSION_TRAIL_MAP_REGION") return;
      const nextRegion = normalizeRegion({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        latitudeDelta: Number(data.latitudeDelta),
        longitudeDelta: Number(data.longitudeDelta),
      });
      setCurrentRegion(nextRegion);
      onRegionChangeComplete?.(nextRegion);
    };
    window.addEventListener("message", handleMapMessage);
    return () => window.removeEventListener("message", handleMapMessage);
  }, [onRegionChangeComplete]);
  return (
    <WebMapContext.Provider value={contextValue}>
      <View style={[styles.container, style]}>
        {React.createElement("iframe", {
            ref: iframeRef,
srcDoc: mapDocument,
          title: "Mission Trail Map",
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "0",
            display: "block",
            background: "#442C78",
          },
          loading: "eager",
          referrerPolicy: "no-referrer-when-downgrade",
        })}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {children}
        </View>
        <View pointerEvents="none" style={styles.brandBadge}>
          {React.createElement(
            "div",
            {
              style: {
                color: "#F5E9FF",
                fontFamily: "Arial, sans-serif",
                fontWeight: 900,
                fontSize: "12px",
                letterSpacing: "1.4px",
                textShadow:
                  "0 0 7px #A855F7, 0 0 13px rgba(255,45,247,0.75)",
                whiteSpace: "nowrap",
              },
            },
            "MISSION TRAIL",
          )}
        </View>
      </View>
    </WebMapContext.Provider>
  );
});
export function Marker({
  coordinate,
  children,
  title,
  description,
  pinColor = "#C084FC",
  zIndex = 10,
}: MarkerProps) {
  const map = React.useContext(WebMapContext);
  if (!map || !coordinate) return null;
  const position = coordinateToPercent(coordinate, map.region);
  const markerContent =
    children ??
    React.createElement(
      "div",
      {
        title: description
          ? `${title ?? "Marker"} — ${description}`
          : title ?? "Marker",
        style: {
          width: "28px",
          height: "28px",
          borderRadius: "50% 50% 50% 0",
          background: pinColor,
          border: "3px solid #FFFFFF",
          boxShadow: `0 0 8px ${pinColor}, 0 0 18px ${pinColor}, 0 0 30px rgba(192,132,252,0.95)`,
          transform: "rotate(-45deg)",
        },
      },
      React.createElement("div", {
        style: {
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#FFFFFF",
          margin: "7px",
        },
      }),
    );
  return (
    <View
      pointerEvents="none"
      style={[
        styles.markerPosition,
        {
          left: `${position.left}%` as any,
          top: `${position.top}%` as any,
          zIndex,
        },
      ]}
    >
      <View style={styles.markerAnchor}>{markerContent}</View>
      {title && !children
        ? React.createElement(
            "div",
            {
              style: {
                position: "absolute",
                left: "50%",
                top: "24px",
                transform: "translateX(-50%)",
                background: "rgba(15,5,35,0.9)",
                border: "1px solid rgba(192,132,252,0.95)",
                borderRadius: "999px",
                padding: "3px 7px",
                color: "#FFFFFF",
                fontFamily: "Arial, sans-serif",
                fontSize: "9px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                whiteSpace: "nowrap",
                boxShadow: "0 0 12px rgba(192,132,252,0.85)",
              },
            },
            title.toUpperCase(),
          )
        : null}
    </View>
  );
}
export function Polyline({
  coordinates = [],
  strokeColor = "#00B2FF",
  strokeWidth = 5,
}: PolylineProps) {
  const map = React.useContext(WebMapContext);
  if (!map || coordinates.length < 2) return null;
  const points = coordinates.map((coordinate) =>
    coordinateToPercent(coordinate, map.region),
  );
  const svgPoints = points
    .map((point) => `${point.left},${point.top}`)
    .join(" ");
  return React.createElement(
    "svg",
    {
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 12,
      },
    },
    React.createElement("polyline", {
      points: svgPoints,
      fill: "none",
      stroke: "rgba(0,178,255,0.34)",
      strokeWidth: Math.max(strokeWidth * 0.72, 2),
      vectorEffect: "non-scaling-stroke",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        filter:
          "drop-shadow(0 0 8px #00B2FF) drop-shadow(0 0 16px #C084FC)",
      },
    }),
    React.createElement("polyline", {
      points: svgPoints,
      fill: "none",
      stroke: strokeColor,
      strokeWidth: Math.max(strokeWidth * 0.38, 2),
      vectorEffect: "non-scaling-stroke",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}
export function Circle({
  center,
  radius = 15,
  strokeColor = "#A855F7",
  fillColor = "rgba(168,85,247,0.16)",
  strokeWidth = 2,
}: CircleProps) {
  const map = React.useContext(WebMapContext);
  if (!map || !center) return null;
  const normalized = normalizeRegion(map.region);
  const position = coordinateToPercent(center, normalized);
  const latitudeRadiusDegrees = metersToLatitudeDegrees(radius);
  const longitudeRadiusDegrees = metersToLongitudeDegrees(
    radius,
    center.latitude,
  );
  const widthPercent =
    (longitudeRadiusDegrees * 2 * 100) / normalized.longitudeDelta!;
  const heightPercent =
    (latitudeRadiusDegrees * 2 * 100) / normalized.latitudeDelta!;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.circle,
        {
          left: `${position.left - widthPercent / 2}%` as any,
          top: `${position.top - heightPercent / 2}%` as any,
          width: `${widthPercent}%` as any,
          height: `${heightPercent}%` as any,
          borderColor: strokeColor,
          borderWidth: strokeWidth,
          backgroundColor: fillColor,
        },
      ]}
    />
  );
}
export const PROVIDER_GOOGLE = undefined;
const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#442C78",
  },
  markerPosition: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "visible",
  },
  markerAnchor: {
    position: "absolute",
    left: -14,
    top: -28,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    borderRadius: 9999,
    zIndex: 8,
  },
  brandBadge: {
    position: "absolute",
    right: 12,
    bottom: 94,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.75)",
    backgroundColor: "rgba(12,4,30,0.78)",
    zIndex: 30,
  },
});
