import type { EntitlementKind } from '../capabilities/entitlements';
import type { RiskCategoryId } from './environment';

export const WIDGET_SNAPSHOT_SCHEMA_VERSION = 1;

type WidgetDestination = 'today' | 'forecast' | 'settings';

export interface WidgetScoreSnapshot {
  type: 'environmental' | 'personalized';
  label: 'Environmental burden' | 'Personalized risk';
  category: RiskCategoryId;
  categoryLabel: string;
  score: number;
  scoreLabel: string;
}

export interface WidgetForecastDaySnapshot {
  label: string;
  category: RiskCategoryId;
  categoryLabel: string;
  scoreLabel: string;
}

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  entitlementKind: EntitlementKind;
  compactAvailable: boolean;
  advancedAvailable: boolean;
  forecastDayLimit: number;
  activeLocationName: string | null;
  placeName: string | null;
  showPlaceName: boolean;
  stale: boolean;
  lastUpdatedAt: string | null;
  headlineScore: WidgetScoreSnapshot | null;
  mainFactorLabel: string | null;
  uvCategoryLabel: string | null;
  bestOutdoorWindowLabel: string | null;
  forecastDays: WidgetForecastDaySnapshot[];
}

export interface WidgetRenderModel {
  title: string;
  destination: WidgetDestination;
  locked: boolean;
  stale: boolean;
  scoreLine: string | null;
  mainFactorLine: string | null;
  uvLine: string | null;
  bestWindowLine: string | null;
  forecastLines: string[];
  message: string | null;
  category: RiskCategoryId;
}

export interface WidgetSnapshotEnvelope {
  version: typeof WIDGET_SNAPSHOT_SCHEMA_VERSION;
  savedAt: string;
  data: WidgetSnapshot;
}
