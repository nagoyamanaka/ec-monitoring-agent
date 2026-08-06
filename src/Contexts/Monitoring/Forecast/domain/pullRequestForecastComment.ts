/**
 * PR コメントへ出す予兆ブリーフィング（E7・純関数）。
 *
 * **決裁の時と場所に材料を届けるための射影**であって、リリースを止める仕組みではない。
 * exit code で落とす経路はここにも呼び出し側にも作らない（gate ではなく参照）。
 *
 * ## 出す／出さないの判断もここに閉じる
 *
 * 「該当する予報が無い PR にはコメントを出さない」が最小限の提示頻度の抑制で、
 * これを外すと毎 PR にコメントが出て `deferred` がゴム印になる（＝決裁台帳を作る前に
 * 台帳の価値を潰す）。判断は返り値の discriminated union に集約し、
 * **出さなかった理由も文字列で返す**——呼び出し側（CI）がジョブサマリに書けるようにする。
 * 「該当が無かった」と「予報が縮退していた」を同じ沈黙に畳まない。
 *
 * ## 該当の判定は2本立て（引用が強・subject が弱）
 *
 * 1. **引用一致**: その PR を予報が**根拠として引用している**（`citations` に `github.pr#N` の
 *    シグナルが入っている）。予報側が既に突合を済ませて引用検証まで通した結果なので、
 *    タイトルの語の重なりより強い。
 * 2. **subject 一致**: PR タイトル／ブランチ名の突合キーと `risk.subject` のトークン照合。
 *    予報の生成後に開かれた PR など、シグナルとして収集されていない変更を拾う。
 *
 * ⚠ **1 が無いと本番で捻れる。** 実測（2026-08-04 の本番予報）では risk.subject が terraform
 * アドレス（`module_gce_backbone_...`）で、それを引用している PR#55 のタイトルは
 * 「cap Mongo connection pool ...」——共有トークンは `backbone` の1語だけで 2 に届かず、
 * **予報が根拠にした当の PR にコメントが出ない**。どちらで当たったかは本文にも書く
 * （何を根拠にこの PR に出したのかを読み手が検算できる形にする）。
 *
 * ## 表示の語彙は予報カードから借りる（新しい表現を発明しない）
 *
 * 見出しは window（「いつ危ないか」が予報の答え）・「根拠 N種類」は2種類以上のときだけ・
 * 「今打てる先手」はフィールドが無ければブロックごと消える——すべて RiskCard と同じ規約。
 * ⚠ **確信度%は載せない**（2026-08-04 に予報カードから撤去・ADR-32）。裏付けの強さは
 * 決定論の「根拠 N種類」が担う。
 */

import type {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
  RiskItemPrimitives,
} from "./contracts/ForecastContract.js";
import { normalizeSubject, subjectsMatch } from "./forecastSubject.js";
import { effectiveLeadTime, formatEffectiveLeadTime } from "./remediationLeadTime.js";
import {
  formatBusinessDateTime,
  formatBusinessTime,
  resolveScheduleOccurrence,
} from "./scheduleWindowOccurrence.js";

/**
 * 同じ PR に何度も積まないための目印（sticky comment）。CI 側はこの文字列を含む
 * 既存コメントを探して PATCH する＝push のたびに新規コメントが増えない。
 */
export const FORECAST_COMMENT_MARKER = "<!-- kizashi-forecast:pr-comment -->";

/**
 * シグナル種別 → 人間語ラベル。未知種別は生値を出す（degrade）。
 * ⚠ frontend の `ForecastView.KIND_LABELS` と同じ語彙を**意図して**持っている。
 * 表示層を frontend と Contexts で共有していないため（frontend は型だけを contracts から
 * 引く方針）、共有は型に留めて文言は各面が持つ。増やすときは両方直す。
 */
const KIND_LABELS: Record<string, string> = {
  FUTURE_CHANGE: "未来の変更",
  SCHEDULE: "スケジュール",
  MEMORY: "過去の同型事例",
};

const SCHEDULE_KIND = "SCHEDULE";
const MEMORY_KIND = "MEMORY";
const LANE_KIND_ORDER = ["FUTURE_CHANGE", SCHEDULE_KIND, MEMORY_KIND];

const LEVEL_ORDER: Record<RiskItemPrimitives["level"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * level の表示ラベル。**生の enum を決裁の場に出さない**（2026-08-05）。
 *
 * 予報カード側は `riskLevelLabel`（frontend/features/forecast/domain/RiskLevel.ts）で
 * 既に `高リスク` へ統一済みで、ここだけ `HIGH` のままだったため**同じ製品が2つの語彙で話していた**。
 * 語を揃える先はフロント側（人が読む面の既定）。
 *
 * ⚠ **frontend と二重に持つのは意図的。** frontend は型だけを contracts から引き、
 * 文言は各面が持つ方針（kind ラベルと同じ扱い）。**増やすときは両方直すこと。**
 */
const LEVEL_LABELS: Record<RiskItemPrimitives["level"], string> = {
  HIGH: "高リスク",
  MEDIUM: "中リスク",
  LOW: "低リスク",
};

export type PullRequestContext = {
  readonly number: number;
  readonly title: string;
  readonly headRef: string;
  /**
   * 予測発生時刻の**手動オーバーライド**（任意・通常は不要）。
   *
   * 既定では**引用されている SCHEDULE シグナルから解決する**（`scheduleWindowOccurrence`）
   * ——「いつ負荷が来るか」は製品が持っている情報で、人間が CI 設定へ転記するものではない。
   * ここに値を渡すのは、スケジュールから引けない窓を手で当てて確かめたいときだけ。
   */
  readonly predictedAt?: Date;
};

/** 何を根拠にこの PR へ出したか。`citation` が強・`subject` が弱。 */
export type ForecastMatchBasis = "citation" | "subject";

/** 出す場合＝レンダリング済み本文と、どのリスクに当たったかのメタ。 */
export type ForecastCommentPosted = {
  readonly kind: "comment";
  /** 一致した予報側の突合キー（PR 側ではなく risk.subject）。 */
  readonly subject: string;
  readonly level: RiskItemPrimitives["level"];
  readonly matchedBy: ForecastMatchBasis;
  readonly body: string;
};

/** 出さない場合＝理由つき。CI のジョブサマリにそのまま書く。 */
export type ForecastCommentSkipped = {
  readonly kind: "skip";
  readonly reason: string;
};

export type ForecastCommentDecision =
  | ForecastCommentPosted
  | ForecastCommentSkipped;

/**
 * PR 側の突合キー。`PullRequestSignalSource` が open PR をシグナル化するときと**同じ規約**
 * （タイトル優先・潰れたらブランチ名）。ここがずれると「自分が根拠にした PR に自分でコメント
 * できない」という捻れが起きる。
 */
export function pullRequestSubject(
  pr: Pick<PullRequestContext, "title" | "headRef">,
): string {
  return normalizeSubject(pr.title) || normalizeSubject(pr.headRef);
}

export function buildPullRequestForecastComment(
  briefing: ForecastBriefingPrimitives,
  pr: PullRequestContext,
): ForecastCommentDecision {
  const { forecast } = briefing;

  // 縮退した予報（生成失敗のフォールバック）は決裁の場に出さない。E6-1 が測定から
  // isFallback を除くのと同じ理由で、「答えられなかった」を材料として提示しない。
  if (forecast.isFallback) {
    return { kind: "skip", reason: "予報が縮退（isFallback）しているため出しません" };
  }

  const prSubject = pullRequestSubject(pr);
  const citedSignalIds = pullRequestSignalIds(briefing.signals, pr.number);
  if (prSubject === "" && citedSignalIds.size === 0) {
    return {
      kind: "skip",
      reason: "PR タイトルとブランチ名から突合キーを作れませんでした",
    };
  }

  const matched = forecast.risks
    .map((risk) => toMatch(risk, prSubject, citedSignalIds))
    .filter((match): match is RiskMatch => match !== undefined)
    .sort(compareMatchDesc);

  const [top] = matched;
  if (!top) {
    return {
      kind: "skip",
      reason: `この PR（引用・subject \`${prSubject}\`）に該当する予報はありません`,
    };
  }

  return {
    kind: "comment",
    subject: top.risk.subject,
    level: top.risk.level,
    matchedBy: top.by,
    body: renderBody({
      briefing,
      pr,
      prSubject,
      match: top,
      otherMatchCount: matched.length - 1,
    }),
  };
}

type RiskMatch = { readonly risk: RiskItemPrimitives; readonly by: ForecastMatchBasis };

/** この PR を指すシグナルの id 集合（`PullRequestSignalSource` の source 規約が契約）。 */
function pullRequestSignalIds(
  signals: readonly ForecastSignalPrimitives[],
  prNumber: number,
): Set<string> {
  const source = `github.pr#${prNumber}`;
  return new Set(signals.filter((s) => s.source === source).map((s) => s.id));
}

function toMatch(
  risk: RiskItemPrimitives,
  prSubject: string,
  citedSignalIds: ReadonlySet<string>,
): RiskMatch | undefined {
  if (risk.citations.some((id) => citedSignalIds.has(id))) {
    return { risk, by: "citation" };
  }
  if (prSubject !== "" && subjectsMatch(risk.subject, prSubject)) {
    return { risk, by: "subject" };
  }
  return undefined;
}

/**
 * 引用一致 → level → confidence の順。**level より引用一致を先に見る**のは、
 * 「この PR を根拠に出た予報」のほうが「語が重なった予報」より、この PR の決裁に効くため。
 */
function compareMatchDesc(a: RiskMatch, b: RiskMatch): number {
  const byBasis = basisOrder(a.by) - basisOrder(b.by);
  if (byBasis !== 0) return byBasis;
  const byLevel = LEVEL_ORDER[a.risk.level] - LEVEL_ORDER[b.risk.level];
  // 同 level 内の並びだけは confidence を使う（表示はしない・ADR-32）。
  return byLevel !== 0 ? byLevel : b.risk.confidence - a.risk.confidence;
}

function basisOrder(basis: ForecastMatchBasis): number {
  return basis === "citation" ? 0 : 1;
}

function renderBody(params: {
  briefing: ForecastBriefingPrimitives;
  pr: PullRequestContext;
  prSubject: string;
  match: RiskMatch;
  otherMatchCount: number;
}): string {
  const { briefing, pr, prSubject, match, otherMatchCount } = params;
  const risk = match.risk;
  const citations = resolveCitations(risk, briefing.signals);
  const kindCount = new Set(citations.map((c) => c.kind)).size;

  const headline = [`**${LEVEL_LABELS[risk.level]}**`, `時間窓: ${risk.window}`];
  // 「根拠 N種類」は2種類以上のときだけ出す（RiskCard と同じ規約＝1種類で「根拠1種類」と
  // 書くと収束していないものを収束したように読ませる）。
  if (kindCount >= 2) headline.splice(1, 0, `根拠 ${kindCount}種類`);

  const lines: string[] = [
    FORECAST_COMMENT_MARKER,
    `### 予兆ブリーフィング — ${risk.subject}`,
    "",
    headline.join(" ・ "),
    "",
    // 「なぜこの PR に出ているのか」を読み手が検算できるようにする。
    match.by === "citation"
      ? "この PR は、**この予報の根拠として引用されています**（下の「未来の変更」を参照）。"
      : `この PR の突合キー \`${prSubject}\` が予報の subject と一致しました。`,
    "",
    `> ${risk.reasoning}`,
    "",
    renderLeadTime(briefing.forecast.generatedAt, risk, citations, pr.predictedAt),
  ];

  if (risk.preventiveAction) {
    lines.push("", "**今打てる先手**", "", risk.preventiveAction);
    const pastCount = citations.filter((c) => c.kind === MEMORY_KIND).length;
    if (pastCount > 0) {
      lines.push(
        "",
        `この先手で、過去の同型事例（${pastCount}件）と同じ経路の再発を高負荷窓の外へ外します。`,
      );
    }
  }

  if (citations.length > 0) {
    lines.push("", "**根拠（引用・実在照合済み）**", "");
    for (const citation of citations) {
      lines.push(`- ${renderCitation(citation, pr.number)}`);
    }
  }

  if (otherMatchCount > 0) {
    lines.push(
      "",
      `※ 同じ subject に他 ${otherMatchCount} 件の予報があります（この PR には最上位の1件だけを出しています）。`,
    );
  }

  lines.push("", "---", "", ...renderFooter(briefing));
  return lines.join("\n");
}

/**
 * E6-2 の1行。**時間が決裁の場に届くのがこのフェーズの芯**なので level より先に読ませる。
 *
 * 予測発生時刻は**引用された SCHEDULE シグナルから解決する**（人間の入力に依存させない）。
 * 解決できなければ推定せず、出せない理由を書く——「測っていない」と「0」を混ぜないのと
 * 同じ扱い。**どこから来た時刻なのかを必ず併記する**（出所の無い時間は材料にならない）。
 */
function renderLeadTime(
  generatedAt: string,
  risk: RiskItemPrimitives,
  citations: readonly ResolvedCitation[],
  override?: Date,
): string {
  const issuedAt = new Date(generatedAt);
  const scheduled = nextScheduledOccurrence(citations, issuedAt);
  const predictedAt = override ?? scheduled?.startsAt;

  if (!predictedAt) {
    return [
      "**対処の所要は約 30 分（宣言値）。**",
      `引用にスケジュールが含まれていないため、予測発生時刻を決定論で引けません`,
      `（時間窓「${risk.window}」は LLM 由来の自由記述なので読みません）。`,
      "有効リードタイム（判断に使える時間）はこのコメントでは算出していません。",
    ].join("");
  }

  const lead = effectiveLeadTime({ issuedAt, predictedAt });
  const deadlineAt = new Date(predictedAt.getTime() - lead.remediationMinutes * 60_000);
  const provenance =
    override || !scheduled
      ? "手動で指定した値です"
      : `引用したスケジュール「${scheduled.source}」を予報の発行時刻から解決した値です（LLM の出力は読んでいません）`;
  return [
    `**${formatEffectiveLeadTime(lead)}**`,
    "",
    // 予報カードの時間軸と**同じ3点**を出す。画面と決裁の場で同じものを見ていることが
    // 突き合わせできる形にする（表記も `formatBusinessDateTime` の単一ソース）。
    "| いま（予報の発行） | 対処を始める期限 | 予測発生 |",
    "| --- | --- | --- |",
    `| ${formatBusinessDateTime(issuedAt)} | **${formatBusinessDateTime(deadlineAt)}** | ${formatWindow(predictedAt, scheduled?.endsAt)} |`,
    "",
    `※ 予測発生時刻は${provenance}。対処の所要は**宣言値**であって実測ではありません。`,
  ].join("\n");
}

/** 発生窓。終了時刻が解決できていなければ**開始だけ**を出す（長さを主張しない）。 */
function formatWindow(startsAt: Date, endsAt?: Date): string {
  const head = formatBusinessDateTime(startsAt);
  return endsAt ? `${head}-${formatBusinessTime(endsAt)}` : head;
}

/**
 * 引用された SCHEDULE シグナルのうち、**最も早く到来する**窓。複数あるときに早い側を採るのは、
 * 猶予を実際より長く見せないため（保守側に倒す）。
 */
function nextScheduledOccurrence(
  citations: readonly ResolvedCitation[],
  issuedAt: Date,
): { startsAt: Date; endsAt?: Date; source: string } | undefined {
  return citations
    .filter((c) => c.kind === SCHEDULE_KIND)
    .map((c) => resolveScheduleOccurrence(c.when, issuedAt))
    .filter((o): o is NonNullable<typeof o> => o !== undefined)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
}

type ResolvedCitation = ForecastSignalPrimitives & { readonly kindLabel: string };

/**
 * 引用 id → 同梱シグナルへの解決。解決できない id は落とす（frontend の CitationView と
 * 同じ防御＝「盛らない側」）。backend の引用検証を通っているので通常はゼロ件。
 */
function resolveCitations(
  risk: RiskItemPrimitives,
  signals: readonly ForecastSignalPrimitives[],
): ResolvedCitation[] {
  const byId = new Map(signals.map((s) => [s.id, s]));
  return risk.citations
    .map((id) => byId.get(id))
    .filter((s): s is ForecastSignalPrimitives => s !== undefined)
    .map((s) => ({ ...s, kindLabel: KIND_LABELS[s.kind] ?? s.kind }))
    .sort((a, b) => laneOrder(a.kind) - laneOrder(b.kind));
}

function laneOrder(kind: string): number {
  const index = LANE_KIND_ORDER.indexOf(kind);
  return index === -1 ? LANE_KIND_ORDER.length : index;
}

function renderCitation(citation: ResolvedCitation, prNumber: number): string {
  const label = citation.url ? `[${citation.desc}](${citation.url})` : citation.desc;
  // この PR 自身が予報の根拠になっている場合は明示する。「この変更を見て出た予報」だと
  // 分かることが、決裁の時と場所に置く意味そのもの（pull 型の /forecast では出せない情報）。
  const self =
    citation.source === `github.pr#${prNumber}` ? " ← **この PR**" : "";
  // when は "未マージ（merge され次第有効）" のように括弧を含みうるので括弧で包まない。
  return `**${citation.kindLabel}** — ${label} ・ ${citation.when}${self}`;
}

function renderFooter(briefing: ForecastBriefingPrimitives): string[] {
  const { forecast, signals } = briefing;
  const lines = [
    "**この予報はリリースを止めません。** 既にあるレビューと自動チェックに、判断の材料を1つ届けるだけです。",
    "決めた記録（acted / deferred / rejected）を残す台帳はまだありません（ロードマップ）。",
    "",
    `予報 \`${forecast.forecastId}\` / 生成 ${forecast.generatedAt} / 対象期間 ${forecast.horizon}`,
    `シグナル ${signals.length} 件を突合して、リスク ${forecast.risks.length} 件に絞り込み`,
  ];
  // 破棄ゼロでも書く（「発火していない」を隠さない・E6-1 と同じ規律）。
  // 検証カウンタを持たない予報（LLM 非呼び出し・旧データ）では行ごと出さない
  // ＝「破棄0」と「測っていない」を同じ 0 に畳まないため。
  if (forecast.verification) {
    const { citationsEmitted, citationsDropped, risksDropped } = forecast.verification;
    lines.push(
      `引用 ${citationsEmitted} 件のうち ${citationsDropped} 件を偽引用として破棄・裏付けゼロで破棄したリスク ${risksDropped} 件`,
    );
  }
  return lines;
}
