import { describe, expect, it } from "vitest";
import type {
  ForecastBriefingPrimitives,
  ForecastSignalPrimitives,
  RiskItemPrimitives,
} from "./contracts/ForecastContract.js";
import {
  FORECAST_COMMENT_MARKER,
  buildPullRequestForecastComment,
  pullRequestSubject,
} from "./pullRequestForecastComment.js";

const prSignal: ForecastSignalPrimitives = {
  id: "pr-55",
  kind: "FUTURE_CHANGE",
  subject: "cap_mongo_connection_pool",
  when: "未マージ（merge され次第有効）",
  desc: "chore: cap Mongo connection pool",
  source: "github.pr#55",
  url: "https://github.com/example/repo/pull/55",
};

const scheduleSignal: ForecastSignalPrimitives = {
  id: "sched-1",
  kind: "SCHEDULE",
  subject: "checkout",
  when: "土 20:00-23:00",
  desc: "週末セール x5",
  source: "schedule.seed",
};

const memorySignal: ForecastSignalPrimitives = {
  id: "inc-1",
  kind: "MEMORY",
  subject: "db_connection_pool",
  when: "2026-06-12",
  desc: "DB接続プール枯渇で checkout が停止",
  source: "incident.alert-9",
};

const risk: RiskItemPrimitives = {
  window: "土 20:00-23:00",
  subject: "db_connection_pool",
  level: "HIGH",
  confidence: 0.9,
  citations: ["inc-1", "pr-55", "sched-1"],
  reasoning: "未来の変更・負荷予定・過去の同型事例が同じ窓に重なっています。",
  preventiveAction: "セール前にプール上限を引き上げる Terraform 変更を先に通す。",
};

function briefing(
  overrides: {
    risks?: RiskItemPrimitives[];
    signals?: ForecastSignalPrimitives[];
    isFallback?: boolean;
    verification?: ForecastBriefingPrimitives["forecast"]["verification"];
  } = {},
): ForecastBriefingPrimitives {
  return {
    forecast: {
      forecastId: "fc-1",
      generatedAt: "2026-08-04T03:33:00.000Z",
      horizon: "今週末",
      risks: overrides.risks ?? [risk],
      isFallback: overrides.isFallback ?? false,
      ...(overrides.verification ? { verification: overrides.verification } : {}),
    },
    signals: overrides.signals ?? [prSignal, scheduleSignal, memorySignal],
  };
}

const pr = {
  number: 55,
  title: "chore: cap Mongo connection pool",
  headRef: "chore/db-connection-pool-cap",
};

describe("pullRequestSubject", () => {
  it("タイトル優先・潰れたらブランチ名（PullRequestSignalSource と同じ規約）", () => {
    expect(pullRequestSubject(pr)).toBe("chore_cap_mongo_connection_pool");
    expect(
      pullRequestSubject({ title: "対応", headRef: "fix/db-connection-pool" }),
    ).toBe("fix_db_connection_pool");
  });
});

describe("buildPullRequestForecastComment — 出す／出さない", () => {
  it("該当する予報が無ければ出さない（毎 PR に出すとゴム印になる）", () => {
    const decision = buildPullRequestForecastComment(
      briefing({ signals: [scheduleSignal, memorySignal] }),
      { number: 60, title: "docs: README のリンクを直す", headRef: "docs/readme-links" },
    );

    expect(decision.kind).toBe("skip");
    expect(decision.kind === "skip" && decision.reason).toContain("該当する予報はありません");
  });

  it("subject が1語も重ならなくても、予報がその PR を引用していれば出す", () => {
    // 本番実測（2026-08-04）: risk.subject は terraform アドレス、引用元 PR のタイトルは
    // 「cap Mongo connection pool ...」で共有トークンは1語。subject 照合だけだと
    // **予報が根拠にした当の PR にコメントが出ない**という捻れが起きる。
    const terraformRisk: RiskItemPrimitives = {
      ...risk,
      subject: "module_gce_backbone_google_compute_instance_backbone",
      citations: ["pr-55"],
    };
    const decision = buildPullRequestForecastComment(
      briefing({ risks: [terraformRisk], signals: [prSignal] }),
      { number: 55, title: "chore(db): cap Mongo maxPoolSize", headRef: "chore/pool-cap" },
    );

    expect(decision.kind).toBe("comment");
    if (decision.kind !== "comment") return;
    expect(decision.matchedBy).toBe("citation");
    expect(decision.body).toContain("この予報の根拠として引用されています");
  });

  it("引用一致は level より先に効く（この PR を根拠に出た予報を優先する）", () => {
    const citedLow: RiskItemPrimitives = {
      ...risk,
      subject: "module_valkey_cache",
      level: "LOW",
      citations: ["pr-55"],
    };
    const unrelatedHigh: RiskItemPrimitives = { ...risk, citations: ["inc-1"] };
    const decision = buildPullRequestForecastComment(
      briefing({ risks: [unrelatedHigh, citedLow] }),
      pr,
    );

    expect(decision.kind).toBe("comment");
    if (decision.kind !== "comment") return;
    expect(decision.matchedBy).toBe("citation");
    expect(decision.level).toBe("LOW");
  });

  it("縮退した予報（isFallback）は決裁の場に出さない", () => {
    const decision = buildPullRequestForecastComment(
      briefing({ isFallback: true }),
      pr,
    );

    expect(decision.kind).toBe("skip");
    expect(decision.kind === "skip" && decision.reason).toContain("縮退");
  });

  it("突合キーを作れず引用にも居ない PR では出さない（1語の偶然一致に落とさない）", () => {
    const decision = buildPullRequestForecastComment(briefing(), {
      number: 7,
      title: "更新",
      headRef: "作業",
    });

    expect(decision.kind).toBe("skip");
    expect(decision.kind === "skip" && decision.reason).toContain("突合キーを作れませんでした");
  });

  it("複数一致したら level 上位の1件だけを出し、残りは件数で添える", () => {
    const lower: RiskItemPrimitives = {
      ...risk,
      level: "LOW",
      window: "日 10:00",
      preventiveAction: undefined,
    };
    const decision = buildPullRequestForecastComment(
      briefing({ risks: [lower, risk] }),
      pr,
    );

    expect(decision.kind).toBe("comment");
    if (decision.kind !== "comment") return;
    expect(decision.level).toBe("HIGH");
    expect(decision.body).toContain("他 1 件の予報があります");
  });
});

describe("buildPullRequestForecastComment — 本文", () => {
  function body(pullRequest = pr, predictedAt?: Date): string {
    const decision = buildPullRequestForecastComment(briefing(), {
      ...pullRequest,
      ...(predictedAt ? { predictedAt } : {}),
    });
    if (decision.kind !== "comment") throw new Error(decision.reason);
    return decision.body;
  }

  it("sticky comment の目印を先頭に置く", () => {
    expect(body().startsWith(FORECAST_COMMENT_MARKER)).toBe(true);
  });

  it("level・根拠 N種類・時間窓・先手を出す", () => {
    const text = body();

    expect(text).toContain("**HIGH**");
    expect(text).toContain("根拠 3種類");
    expect(text).toContain("時間窓: 土 20:00-23:00");
    expect(text).toContain("**今打てる先手**");
    expect(text).toContain("セール前にプール上限を引き上げる");
  });

  it("確信度%は載せない（ADR-32・裏付けの強さは根拠 N種類が担う）", () => {
    expect(body()).not.toMatch(/\d+\s*%/);
  });

  it("根拠が1種類なら「根拠 N種類」チップを出さない", () => {
    const decision = buildPullRequestForecastComment(
      briefing({
        risks: [{ ...risk, citations: ["pr-55"] }],
        signals: [prSignal],
      }),
      pr,
    );

    expect(decision.kind === "comment" && decision.body).not.toContain("根拠 1種類");
  });

  it("引用は種別レーン順（未来の変更 → スケジュール → 過去の同型事例）でリンク付き", () => {
    const text = body();
    const future = text.indexOf("**未来の変更** —");
    const schedule = text.indexOf("**スケジュール** —");
    const memory = text.indexOf("**過去の同型事例** —");

    expect(future).toBeGreaterThan(-1);
    expect(future).toBeLessThan(schedule);
    expect(schedule).toBeLessThan(memory);
    expect(text).toContain("(https://github.com/example/repo/pull/55)");
  });

  it("この PR 自身が根拠なら引用行に明示する（pull 型の /forecast では出せない情報）", () => {
    expect(body()).toContain("← **この PR**");
    // 別 PR から見れば「この PR」ではない（subject 一致で出ているだけ）。
    const other = body({ ...pr, number: 56 });
    expect(other).not.toContain("← **この PR**");
    expect(other).toContain("突合キー `chore_cap_mongo_connection_pool` が予報の subject と一致");
  });

  it("解決できない引用 id は落とす（盛らない側）", () => {
    const decision = buildPullRequestForecastComment(
      briefing({ risks: [{ ...risk, citations: ["pr-55", "ghost-1"] }] }),
      pr,
    );

    expect(decision.kind === "comment" && decision.body).not.toContain("ghost-1");
  });

  it("止めないこと・台帳が未実装であることを毎回書く（語彙の制約）", () => {
    const text = body();

    expect(text).toContain("リリースを止めません");
    expect(text).toContain("材料");
    expect(text).toContain("acted / deferred / rejected");
    expect(text).not.toContain("認可");
  });

  it("シグナル件数とリスク件数を併記する（母数を隠さない）", () => {
    expect(body()).toContain("シグナル 3 件を突合して、リスク 1 件に絞り込み");
  });
});

describe("buildPullRequestForecastComment — 有効リードタイム（E6-2）", () => {
  it("注記があれば「あと N 時間・対処は M 分」を出す", () => {
    const decision = buildPullRequestForecastComment(briefing(), {
      ...pr,
      predictedAt: new Date("2026-08-08T11:00:00.000Z"),
    });

    expect(decision.kind).toBe("comment");
    if (decision.kind !== "comment") return;
    expect(decision.body).toContain("予測発生まで 約 103 時間 27 分");
    expect(decision.body).toContain("対処の所要は約 30 分（宣言値）");
    expect(decision.body).toContain("判断に使える時間は 約 102 時間 57 分");
    expect(decision.body).toContain("人手の注記");
  });

  it("注記が無ければ推定せず、出せない理由を書く", () => {
    const decision = buildPullRequestForecastComment(briefing(), pr);

    expect(decision.kind === "comment" && decision.body).toContain(
      "有効リードタイム（判断に使える時間）はこのコメントでは算出していません",
    );
    expect(decision.kind === "comment" && decision.body).toContain(
      "対処の所要は約 30 分（宣言値）",
    );
  });
});

describe("buildPullRequestForecastComment — 引用検証の会計（E6-1）", () => {
  it("破棄ゼロでも書く（発火していないことを隠さない）", () => {
    const decision = buildPullRequestForecastComment(
      briefing({
        verification: {
          citationsEmitted: 3,
          citationsDropped: 0,
          risksEmitted: 1,
          risksDropped: 0,
        },
      }),
      pr,
    );

    expect(decision.kind === "comment" && decision.body).toContain(
      "引用 3 件のうち 0 件を偽引用として破棄",
    );
  });

  it("検証カウンタが無い予報では行ごと出さない（「測っていない」を 0 に畳まない）", () => {
    const decision = buildPullRequestForecastComment(briefing(), pr);

    expect(decision.kind === "comment" && decision.body).not.toContain("偽引用として破棄");
  });
});
