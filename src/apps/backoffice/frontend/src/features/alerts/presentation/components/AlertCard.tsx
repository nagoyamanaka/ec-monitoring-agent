import { useEffect, useRef, useState } from "react";
import { ConfidenceChip } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import { formatDateTimeJa } from "@shared/format/dateTime";
import {
  type AlertView,
  type AlertSeverity,
  isAnalyzing,
} from "../../domain/AlertView";
import { alertConfidence } from "../../domain/alertConfidence";
import { eventInfo, eventTitle } from "../../domain/eventCatalog";
import { categoryInfo } from "../../domain/alertCategory";
import { alertReason } from "../../domain/alertReason";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { ExactMatchBadge } from "./ExactMatchBadge";

export interface AlertCardProps {
  alert: AlertView;
  /** 選択中（詳細ドロワーを開いている行）か。ストライプ・背景を強調する。 */
  selected?: boolean;
  /** 行クリックで詳細ドロワーを開く。 */
  onSelect?: (alertId: string) => void;
}

/** severity ストライプの実色（SeverityBadge のランク色＝rose/amber/sky と整合）。 */
const STRIPE_COLOR: Record<AlertSeverity, string> = {
  CRITICAL: "bg-rose-500",
  WARNING: "bg-amber-500",
  INFO: "bg-sky-500",
  // 未確定（AI調査前 / ソース判断不能）。確定済み severity と視覚的に区別する。
  PENDING: "bg-slate-500",
};

/**
 * 畳み込み件数（重複観測）の表示トーン。重大度（severity）とは別軸なので
 * severity 色（rose/amber/sky）から始めず neutral（slate）を起点にし、
 * 回数が増えるほど視覚的重みを上げる（嵐の規模を色でも伝える）。
 */
function occurrenceTone(count: number): string {
  if (count >= 10) return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  if (count >= 3) return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
  return "bg-slate-600/30 text-slate-200 ring-slate-500/40";
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "たった今";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.round(hr / 24)}日前`;
}

/** severity をスクリーンリーダー向けに読み上げるラベル（視覚上はストライプ色が担う）。 */
const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITICAL: "重大",
  WARNING: "警告",
  INFO: "情報",
  PENDING: "判定中",
};

/**
 * マウント時点で「いま着弾した新規アラート」とみなす鮮度（タスク E5）。
 * SSE の新規はサーバ生成から1秒未満で届くため十分に短く、初回ロードで並ぶ
 * 過去アラートの一斉アニメは起こさない。
 */
const NEW_ARRIVAL_WINDOW_MS = 10_000;

/**
 * 一覧の 1 行（マスター）。クリックで詳細ドロワー（AlertDetailDrawer）を開く。
 * レイアウトは2ゾーン: 左=内容（①ドメイン日本語ラベル＋eventName主役 ②従属メタ ③原因サマリ）、
 * 右=固定幅レール（対応状態＋確信度を集約）。右端の情報が散らず間延びしない。
 */
export function AlertCard({
  alert,
  selected = false,
  onSelect,
}: AlertCardProps) {
  const analyzing = isAnalyzing(alert);
  // SSE 着弾のライブ感（タスク E5）。同一行は置き換え（mergeAlert）なので、
  // prop の変化を前回値と比較すれば「何が起きたか」をカード自身が検出できる。
  // - 新規: マウント時に createdAt が十分新しい → スライドイン＋グロー
  // - 解決: ANALYZING→確定 → resolve-flash（タスク12・自律性の可視化）
  // - 更新: updatedAt が動いた（dedup 加算・レポート添付等） → その場グロー
  // - dedup: occurrenceCount 増加 → カウンタバッジのパルス
  const [isNewArrival, setIsNewArrival] = useState(
    () =>
      Date.now() - new Date(alert.createdAt).getTime() < NEW_ARRIVAL_WINDOW_MS,
  );
  const wasAnalyzing = useRef(analyzing);
  const prevUpdatedAt = useRef(alert.updatedAt);
  const prevCount = useRef(alert.occurrenceCount);
  const [justResolved, setJustResolved] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [countPulse, setCountPulse] = useState(false);
  useEffect(() => {
    const resolved = wasAnalyzing.current && !analyzing;
    const updated = prevUpdatedAt.current !== alert.updatedAt;
    const counted = alert.occurrenceCount > prevCount.current;
    wasAnalyzing.current = analyzing;
    prevUpdatedAt.current = alert.updatedAt;
    prevCount.current = alert.occurrenceCount;
    if (resolved) setJustResolved(true);
    // 解決フラッシュと重ねない（1回の置換に演出は1つ）。
    else if (updated) setJustUpdated(true);
    if (counted) setCountPulse(true);
  }, [analyzing, alert.updatedAt, alert.occurrenceCount]);
  // 子要素のアニメも bubbling で届くため、名前で判別して各演出をリセットする。
  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === "card-arrive") setIsNewArrival(false);
    if (e.animationName === "resolve-flash") setJustResolved(false);
    if (e.animationName === "card-update-flash") setJustUpdated(false);
    if (e.animationName === "count-pulse") setCountPulse(false);
  };

  const confidence = alertConfidence(alert);
  // AI 調査が失敗した fallback レポートは confidence が当てにならない。
  const aiFallback = confidence.kind === "ai" && alert.report?.isFallback;
  const info = eventInfo(alert.eventName);
  const title = eventTitle(alert.eventName);
  const category = categoryInfo(alert.category);
  const reason = alertReason(alert);
  // 承認済み（対処済み）は現役一覧に残すが、行全体を暗くして未処理と視覚的に区別する
  // （並びは alertSort が最下部へ沈める。ラベルは右レールの AlertStatusBadge=「承認済み」）。
  const approved = alert.feedback?.isCorrect === true;

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid="alert-card"
      data-alert-id={alert.id}
      data-approved={approved || undefined}
      onClick={() => onSelect?.(alert.id)}
      onAnimationEnd={handleAnimationEnd}
      className={cn(
        "relative flex w-full items-stretch overflow-hidden rounded-tremor-default text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
        isNewArrival && "card-arrive",
        justResolved && "resolve-flash",
        justUpdated && !justResolved && "card-update-flash",
        // 承認済みは減光＋彩度を落として沈める（hover で一時的に戻して閲覧しやすく）。
        approved && !selected && "opacity-55 saturate-50 hover:opacity-90",
        selected
          ? "bg-slate-800/50 ring-cyan-500/50"
          : "bg-slate-900/30 ring-slate-700/60 hover:bg-slate-800/30 hover:ring-slate-600",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          analyzing ? "bg-slate-500" : STRIPE_COLOR[alert.severity],
        )}
        aria-hidden
      />

      {/* 左ゾーン: 内容 */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-4 pl-5 pr-4">
        {/* ① 主役: 人間語タイトル（未登録は eventName にフォールバック） */}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-lg font-semibold text-slate-50">
            {title}
          </span>
          {info && (
            <code
              className="shrink-0 text-xs text-slate-400"
              title={alert.eventName}
            >
              {alert.eventName}
            </code>
          )}
        </div>

        {/* ② 従属メタ: category（人間語）・時刻。
            重要度は左ストライプ色に一本化（バッジ軸分離＝カード上のバッジは
            category / 状態 / 分類根拠 の最大3。E2）。読み上げ用に sr-only で残す。
            狭幅ではチップを潰さず折り返す（whitespace-nowrap ＋ flex-wrap。E7）。 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-300">
          <span className="sr-only">
            重要度 {analyzing ? "判定中" : SEVERITY_LABEL[alert.severity]}
          </span>
          <span
            className="whitespace-nowrap rounded-md bg-slate-700/50 px-1.5 py-0.5 text-xs font-medium text-slate-300"
            title={category.description}
          >
            {category.label}
          </span>
          <span
            className="shrink-0"
            title={formatDateTimeJa(alert.occurredOn)}
          >
            {formatRelativeTime(alert.occurredOn)}
          </span>
          {/* 重複観測の畳み込み件数。嵐をカード乱立でなく1枚＋件数で見せる。
              記号「×N」は意味が伝わらないため「重複 N件」とラベル付きで出す。 */}
          {alert.occurrenceCount > 1 && (
            <span
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                occurrenceTone(alert.occurrenceCount),
                countPulse && "count-pulse",
              )}
              title={`同一インシデント（同一 dedupKey）の重複観測 ${alert.occurrenceCount} 件を 1 枚にまとめています`}
            >
              重複{" "}
              {alert.occurrenceCount >= 100 ? "99+" : alert.occurrenceCount}件
            </span>
          )}
        </div>

        {/* ③ 副次: 推定原因（該当パターン／AI推定パターン）。
            結晶化パターンは生ID（PROMOTED_...）を出さず ◈＋人間語（tooltip に生ID）。 */}
        <p className="truncate text-sm leading-relaxed text-slate-300">
          {reason.kind === "analyzing" ? (
            "AI が未知障害を調査中…"
          ) : (
            <>
              <span className="text-slate-400">
                {reason.kind === "known" ? "該当: " : "AI推定: "}
              </span>
              {reason.kind === "known" && reason.crystallized ? (
                <span
                  title={`結晶化パターン（承認により学習・昇格）: ${reason.rawPatternName}`}
                >
                  <span aria-hidden className="text-emerald-300">
                    ◈{" "}
                  </span>
                  {reason.patternName}
                </span>
              ) : (
                reason.patternName
              )}
            </>
          )}
        </p>
      </div>

      {/* 右ゾーン: 状態＋確信度レール */}
      <div className="flex w-32 shrink-0 flex-col items-end justify-center gap-2 border-l border-slate-700/50 px-3 py-4">
        <AlertStatusBadge alert={alert} />
        {confidence.kind === "exact-match" ? (
          <ExactMatchBadge variant="chip" />
        ) : confidence.kind === "ai" && aiFallback ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
            暫定
          </span>
        ) : confidence.kind === "ai" ? (
          <ConfidenceChip
            confidence={confidence.value}
            label="AI確信度"
            tone="ai"
          />
        ) : confidence.kind === "known" ? (
          <ConfidenceChip
            confidence={confidence.value}
            label="類似度"
            tone="match"
          />
        ) : analyzing ? (
          <span className="text-sm text-cyan-300/80">算出中…</span>
        ) : null}
      </div>

      {/* クリック誘導 */}
      <div
        className="flex shrink-0 items-center pr-3 text-lg text-slate-600"
        aria-hidden
      >
        ›
      </div>
    </button>
  );
}
