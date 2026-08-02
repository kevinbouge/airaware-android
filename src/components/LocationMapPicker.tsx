import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Coordinates } from '../models/environment';
import { colors, spacing } from '../theme/theme';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  clampMapZoom,
  coordinatesToWorldPixel,
  formatMapCoordinate,
  mapTileUrl,
  worldPixelToCoordinates,
} from '../utils/mapTiles';

interface LocationMapPickerProps {
  coordinates: Coordinates;
  onSelect: (coordinates: Coordinates) => void;
}

const DEFAULT_ZOOM = 10;
const TILE_RANGE = [-1, 0, 1] as const;
const DRAG_THRESHOLD_PIXELS = 4;

interface WebEventTarget {
  getBoundingClientRect?: () => {
    left: number;
    top: number;
  };
}

interface DragState {
  startPointerX: number;
  startPointerY: number;
  startCenterX: number;
  startCenterY: number;
  moved: boolean;
}

function pointerCoordinates(event: GestureResponderEvent): { x: number; y: number } | null {
  const nativeEvent = event.nativeEvent as GestureResponderEvent['nativeEvent'] & {
    clientX?: unknown;
    clientY?: unknown;
  };

  if (Number.isFinite(nativeEvent.pageX) && Number.isFinite(nativeEvent.pageY)) {
    return {
      x: nativeEvent.pageX,
      y: nativeEvent.pageY,
    };
  }

  const clientX = nativeEvent.clientX;
  const clientY = nativeEvent.clientY;

  if (typeof clientX !== 'number' || typeof clientY !== 'number') {
    return null;
  }

  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  return { x: clientX, y: clientY };
}

function pressCoordinates(event: GestureResponderEvent): { x: number; y: number } | null {
  const nativeEvent = event.nativeEvent as GestureResponderEvent['nativeEvent'] & {
    clientX?: unknown;
    clientY?: unknown;
  };

  if (Number.isFinite(nativeEvent.locationX) && Number.isFinite(nativeEvent.locationY)) {
    return {
      x: nativeEvent.locationX,
      y: nativeEvent.locationY,
    };
  }

  const clientX = nativeEvent.clientX;
  const clientY = nativeEvent.clientY;

  if (typeof clientX !== 'number' || typeof clientY !== 'number') {
    return null;
  }

  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  const target = event.currentTarget as unknown as WebEventTarget;
  const rect = target.getBoundingClientRect?.();

  if (!rect) {
    return null;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function ZoomIconButton({
  type,
  disabled,
  onPress,
}: {
  type: 'plus' | 'minus';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={type === 'plus' ? 'Zoom in' : 'Zoom out'}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.zoomButton,
        disabled ? styles.zoomButtonDisabled : null,
        pressed && !disabled ? styles.zoomButtonPressed : null,
      ]}
    >
      <Svg height={20} width={20} viewBox="0 0 24 24">
        <Path
          d="M5 12h14"
          fill="none"
          stroke={colors.text}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.4}
        />
        {type === 'plus' ? (
          <Path
            d="M12 5v14"
            fill="none"
            stroke={colors.text}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.4}
          />
        ) : null}
      </Svg>
    </Pressable>
  );
}

export function LocationMapPicker({ coordinates, onSelect }: LocationMapPickerProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapWidth, setMapWidth] = useState(320);
  const [draftCoordinates, setDraftCoordinates] = useState(coordinates);
  const draftCoordinatesRef = useRef(coordinates);
  const dragState = useRef<DragState | null>(null);
  const centerPixel = useMemo(
    () => coordinatesToWorldPixel(draftCoordinates, zoom),
    [draftCoordinates, zoom],
  );
  const centerTileX = Math.floor(centerPixel.x / MAP_TILE_SIZE);
  const centerTileY = Math.floor(centerPixel.y / MAP_TILE_SIZE);
  const tileDisplaySize = mapWidth / 3;
  const scale = tileDisplaySize / MAP_TILE_SIZE;
  const originPixelX = (centerTileX - 1) * MAP_TILE_SIZE;
  const originPixelY = (centerTileY - 1) * MAP_TILE_SIZE;
  const markerLeft = (centerPixel.x - originPixelX) * scale;
  const markerTop = (centerPixel.y - originPixelY) * scale;

  useEffect(() => {
    if (dragState.current) return;
    draftCoordinatesRef.current = coordinates;
    setDraftCoordinates(coordinates);
  }, [coordinates]);

  const updateDraftCoordinates = (nextCoordinates: Coordinates) => {
    draftCoordinatesRef.current = nextCoordinates;
    setDraftCoordinates(nextCoordinates);
  };

  const updateLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (Number.isFinite(width) && width > 0) {
      setMapWidth(width);
    }
  };

  const handlePress = (event: GestureResponderEvent) => {
    const point = pressCoordinates(event);
    if (!point) return;

    const x = originPixelX + point.x / scale;
    const y = originPixelY + point.y / scale;
    const selectedCoordinates = worldPixelToCoordinates(x, y, zoom);
    updateDraftCoordinates(selectedCoordinates);
    onSelect(selectedCoordinates);
  };

  const beginDrag = (event: GestureResponderEvent) => {
    const pointer = pointerCoordinates(event);
    if (!pointer) return;

    dragState.current = {
      startPointerX: pointer.x,
      startPointerY: pointer.y,
      startCenterX: centerPixel.x,
      startCenterY: centerPixel.y,
      moved: false,
    };
  };

  const moveDrag = (event: GestureResponderEvent) => {
    const drag = dragState.current;
    const pointer = pointerCoordinates(event);
    if (!drag || !pointer) return;

    const deltaX = pointer.x - drag.startPointerX;
    const deltaY = pointer.y - drag.startPointerY;
    const movedDistance = Math.hypot(deltaX, deltaY);

    if (movedDistance < DRAG_THRESHOLD_PIXELS) {
      return;
    }

    drag.moved = true;
    updateDraftCoordinates(
      worldPixelToCoordinates(
        drag.startCenterX - deltaX / scale,
        drag.startCenterY - deltaY / scale,
        zoom,
      ),
    );
  };

  const endDrag = (event: GestureResponderEvent) => {
    const wasDrag = dragState.current?.moved === true;
    dragState.current = null;

    if (wasDrag) {
      onSelect(draftCoordinatesRef.current);
    } else {
      handlePress(event);
    }
  };

  return (
    <View>
      <Text style={styles.help}>Tap or drag the map to choose manual coordinates.</Text>
      <View
        accessible
        accessibilityLabel="Manual location map"
        accessibilityRole="imagebutton"
        onLayout={updateLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={beginDrag}
        onResponderMove={moveDrag}
        onResponderRelease={endDrag}
        onResponderTerminate={() => {
          dragState.current = null;
        }}
        onStartShouldSetResponder={() => true}
        style={styles.map}
      >
        <View style={[styles.tileLayer, { height: mapWidth }]}>
          {TILE_RANGE.flatMap((rowOffset) =>
            TILE_RANGE.map((columnOffset) => {
              const tileX = centerTileX + columnOffset;
              const tileY = centerTileY + rowOffset;

              return (
                <Image
                  key={`${zoom}:${tileX}:${tileY}`}
                  source={{ uri: mapTileUrl(tileX, tileY, zoom) }}
                  style={[
                    styles.tile,
                    {
                      height: tileDisplaySize,
                      left: (columnOffset + 1) * tileDisplaySize,
                      top: (rowOffset + 1) * tileDisplaySize,
                      width: tileDisplaySize,
                    },
                  ]}
                />
              );
            }),
          )}
          <View
            style={[
              styles.marker,
              styles.noPointerEvents,
              {
                left: markerLeft,
                top: markerTop,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.mapFooter}>
        <Text style={styles.coordinates}>
          {formatMapCoordinate(draftCoordinates.latitude)},{' '}
          {formatMapCoordinate(draftCoordinates.longitude)}
        </Text>
        <View style={styles.zoomControls}>
          <ZoomIconButton
            type="minus"
            disabled={zoom <= MAP_MIN_ZOOM}
            onPress={() => setZoom((current) => clampMapZoom(current - 1))}
          />
          <ZoomIconButton
            type="plus"
            disabled={zoom >= MAP_MAX_ZOOM}
            onPress={() => setZoom((current) => clampMapZoom(current + 1))}
          />
        </View>
      </View>
      <Text style={styles.attribution}>Map tiles © OpenStreetMap contributors</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  attribution: {
    color: colors.muted,
    fontSize: 12,
  },
  coordinates: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  help: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  map: {
    aspectRatio: 1,
    backgroundColor: '#DCE7DF',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  mapFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  marker: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    position: 'absolute',
    width: 18,
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  tile: {
    position: 'absolute',
  },
  tileLayer: {
    position: 'relative',
    width: '100%',
  },
  zoomControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  zoomButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  zoomButtonDisabled: {
    opacity: 0.45,
  },
  zoomButtonPressed: {
    opacity: 0.7,
  },
});
