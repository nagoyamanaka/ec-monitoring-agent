// Tremor を shared/ui に薄くラップする窓口。
// features/* は @tremor/react を直接 import せず、本モジュール経由で参照する。
// 目的: 可視化ライブラリの差し替え点を1箇所に閉じ込める（危険度ランク色・confidence割合・予兆グラフ）。

export {
  Card,
  Metric,
  Title,
  Text,
  Bold,
  Flex,
  Grid,
  Col,
  Divider,
  List,
  ListItem,
  Legend,
  Callout,
  // ランク/割合/グラフ系
  Badge as TremorBadge,
  ProgressBar,
  ProgressCircle,
  BarList,
  DonutChart,
  AreaChart,
  BarChart,
  LineChart,
  Tracker,
  type Color,
} from "@tremor/react";

export { ConfidenceGauge } from "./ConfidenceGauge";
export { rankColor, confidenceColor } from "./colors";
