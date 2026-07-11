import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "./cn";

/**
 * 収束コネクタ（L6）: 入力レーン群 → AI 調査ノードの「多対一の収束」を SVG のファンで描く。
 *
 * 従来は各レーンの右に水平スタブ（`w-6 h-px`）を生やしていたが、スタブは各レーン中心の
 * 高さで平行に伸びるだけで、垂直中央に浮く AI 調査ノードへは届かない（レーン数がノード高を
 * 超えた瞬間、上下の線が空中で切れる）。かつ平行線は「収束」でなく「素通り」の幾何で、
 * この図の主張（独立した根拠が1点に集まる）と矛盾する。
 *
 * ここでは各レーンの実測中心 y からノードの実測中心 y へベジェ曲線を引く＝レーン数が
 * 何本でも必ず全線がノードに刺さり、形そのものが「突合・収束」を反復する。座標は
 * getBoundingClientRect の実測（レーン高・行間に非依存）＝レイアウトが変わっても追従する。
 * 視覚専用（aria-hidden）で読み上げは呼び出し側の1文サマリが代替する。
 * アラート詳細（EvidenceFlowDiagram）と予兆（ConvergenceMiniFlow）の両図で共有する。
 */

/** コネクタの離散太さ（件数の段階 1..3）→ 線幅 px。連続スケールは fake precision なので使わない。 */
const STROKE_WIDTH: Record<1 | 2 | 3, number> = { 1: 1.5, 2: 2.5, 3: 3.75 };

/** コネクタ列の幅（px）。旧スタブ `w-6`(24px) と揃う体感で、束ねる余地を少し足す。 */
const COLUMN_WIDTH = 28;

type Segment = { readonly y: number; readonly weight: 1 | 2 | 3 };
type Geometry = { readonly height: number; readonly toY: number; readonly segments: Segment[] };

export interface ConvergenceConnectorProps {
  /** 入力レーンを縦に並べた要素（各直接子＝1レーンの中心 y から線を引く）。 */
  lanesRef: RefObject<HTMLElement | null>;
  /** 収束先の AI 調査ノード（この中心へ全レーンを束ねる）。 */
  nodeRef: RefObject<HTMLElement | null>;
  /** レーンごとの太さ（件数の離散段階 1..3・省略時は一律 1）。lanesRef の子順と対応。 */
  weights?: readonly (1 | 2 | 3)[];
  className?: string;
}

export function ConvergenceConnector({
  lanesRef,
  nodeRef,
  weights,
  className,
}: ConvergenceConnectorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  // weights は毎レンダ新配列になり得るため、値の列で安定依存を作る。
  const weightKey = (weights ?? []).join("-");

  useLayoutEffect(() => {
    const host = hostRef.current;
    const lanes = lanesRef.current;
    const node = nodeRef.current;
    if (!host || !lanes || !node) return;

    const measure = () => {
      const base = host.getBoundingClientRect();
      // jsdom や未レイアウト時は 0 → 描かない（捏造した座標を出さない）。
      if (base.height === 0) {
        setGeometry(null);
        return;
      }
      const items = Array.from(lanes.children) as HTMLElement[];
      const segments = items.map((item, i): Segment => {
        const rect = item.getBoundingClientRect();
        return {
          y: rect.top + rect.height / 2 - base.top,
          weight: weights?.[i] ?? 1,
        };
      });
      const nodeRect = node.getBoundingClientRect();
      setGeometry({
        height: base.height,
        toY: nodeRect.top + nodeRect.height / 2 - base.top,
        segments,
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(lanes);
    observer.observe(node);
    return () => observer.disconnect();
    // weightKey で太さ変化を、ref 群でマウント差し替えを拾う（レイアウト追従は observer）。
  }, [lanesRef, nodeRef, weightKey]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn(
        "relative hidden shrink-0 self-stretch md:block",
        className,
      )}
      style={{ width: COLUMN_WIDTH }}
    >
      {geometry && (
        <svg
          width={COLUMN_WIDTH}
          height={geometry.height}
          viewBox={`0 0 ${COLUMN_WIDTH} ${geometry.height}`}
          className="absolute inset-0 text-slate-600"
          fill="none"
        >
          {geometry.segments.map((seg, i) => (
            <path
              key={i}
              d={`M0 ${seg.y} C ${COLUMN_WIDTH / 2} ${seg.y}, ${
                COLUMN_WIDTH / 2
              } ${geometry.toY}, ${COLUMN_WIDTH} ${geometry.toY}`}
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH[seg.weight]}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
