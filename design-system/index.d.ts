import type * as React from 'react';

/** Route slot: 0 = blue/circle, 1 = navy/square, 2 = coral/diamond. */
export type RouteIndex = 0 | 1 | 2;
export type Trend = 'Rising' | 'Steady' | 'Cooling';
export type Tone = 'light' | 'inverse';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: blue, the one main action. secondary: outlined. inverse: navy, for use on coral. */
  variant?: 'primary' | 'secondary' | 'inverse';
  size?: 'md' | 'lg';
  /** Renders an <a> instead of a <button>. */
  href?: string;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface ChipProps { selected?: boolean; onClick?: () => void; className?: string; children?: React.ReactNode }
export declare function Chip(props: ChipProps): React.ReactElement;

export interface SegmentedOption { id: string; label: string; /** CSS colour for a small dot before the label. */ swatch?: string }
export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Accessible name of the group. */
  label: string;
  tone?: Tone;
}
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface TrendPillProps { trend: Trend; children?: React.ReactNode }
export declare function TrendPill(props: TrendPillProps): React.ReactElement;

export interface OverlapMeterProps { /** 0–1 */ value: number; route?: RouteIndex; tone?: Tone; label?: string; levelLabel?: string }
export declare function OverlapMeter(props: OverlapMeterProps): React.ReactElement;

export interface OverlapRingProps { /** 0–1 */ value: number; route?: RouteIndex; tone?: Tone; size?: number; showLabel?: boolean; levelLabel?: string }
export declare function OverlapRing(props: OverlapRingProps): React.ReactElement;

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** Adds the trend arrow and colours the value. */
  trend?: Trend;
  /** 0–1: adds an overlap meter under the value. */
  meter?: number;
  route?: RouteIndex;
  tone?: Tone;
  className?: string;
}
export declare function StatTile(props: StatTileProps): React.ReactElement;

export interface RouteOptionProps {
  index: RouteIndex;
  title: string;
  trend: Trend;
  /** 0–1 */
  overlap: number;
  levelLabel?: string;
  selected?: boolean;
  onClick?: () => void;
}
export declare function RouteOption(props: RouteOptionProps): React.ReactElement;

export interface TickerItem { role: string; trend: Trend }
export interface TickerProps { items: TickerItem[]; label?: string }
export declare function Ticker(props: TickerProps): React.ReactElement;

export interface MapRoute { title: string; /** Up to two stops: skills or credentials. */ stops?: string[] }
export interface RouteMapProps {
  /** The user's current role, shown at "You are here". */
  origin: string;
  /** Up to three routes, in route order. */
  routes: MapRoute[];
  selected?: RouteIndex;
  /** Stops the travelling dot and pulse. Reduced-motion users are always still. */
  paused?: boolean;
}
export declare function RouteMap(props: RouteMapProps): React.ReactElement;

export interface OpeningsChartProps {
  /** Monthly values, 0–100 (relative). */
  values: number[];
  route?: RouteIndex;
  /** Destination role, used in the text alternative. */
  title?: string;
  /** Trend in words for the text alternative, e.g. "rising steadily". */
  summary?: string;
  /** How many trailing bars to highlight. Default 3; 0 for none. */
  highlight?: number;
  height?: number;
  label?: string;
  startLabel?: string;
  endLabel?: string;
}
export declare function OpeningsChart(props: OpeningsChartProps): React.ReactElement;

export interface TrendSeries { label: string; values: number[]; summary?: string }
export interface TrendChartProps {
  /** Up to three series, in route order. Values 0–100 (relative). */
  series: TrendSeries[];
  /** Dashed grey comparison line, e.g. the user's current role. */
  reference?: { label: string; values: number[] };
  selected?: RouteIndex;
  legend?: boolean;
  label?: string;
  startLabel?: string;
  endLabel?: string;
}
export declare function TrendChart(props: TrendChartProps): React.ReactElement;

export interface SkillListProps { have: string[]; stops: string[]; haveTitle?: string; stopsTitle?: string }
export declare function SkillList(props: SkillListProps): React.ReactElement;

declare global {
  interface Window {
    Modulate: {
      Button: typeof Button; Chip: typeof Chip; SegmentedControl: typeof SegmentedControl; TrendPill: typeof TrendPill;
      OverlapMeter: typeof OverlapMeter; OverlapRing: typeof OverlapRing; StatTile: typeof StatTile; RouteOption: typeof RouteOption;
      Ticker: typeof Ticker; RouteMap: typeof RouteMap; OpeningsChart: typeof OpeningsChart; TrendChart: typeof TrendChart; SkillList: typeof SkillList;
    };
  }
}
