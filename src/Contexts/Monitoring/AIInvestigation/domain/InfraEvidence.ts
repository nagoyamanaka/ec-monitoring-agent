export type AppLogEntry = {
  readonly timestamp: Date;
  readonly severity: "ERROR" | "WARNING" | "INFO";
  readonly message: string;
  readonly resource: string;
};

export type TerraformResourceAction = "create" | "update" | "delete" | "replace";

// 1リソースの1属性の変化。機微値の漏洩を避けるため before/after は文字列化済みの要約値で持つ。
export type TerraformAttributeDelta = {
  readonly key: string;
  readonly before: string | null;
  readonly after: string | null;
};

// terraform apply で実際に変わった1リソース。git diff（HCL 上の意図）ではなく適用後の事実。
export type TerraformResourceChange = {
  readonly address: string; // 例: google_sql_database_instance.main
  readonly action: TerraformResourceAction;
  readonly attributeDeltas: TerraformAttributeDelta[];
};

// terraform apply の適用差分。git commit（誰が/なぜ＝意図）と相補で、「実際に稼働インフラが何に変わったか」を表す。
// apply は CI 上の一回限りのイベントで後から再構成できないため、適用時に捕捉・保存したものを時間窓で引く。
// Date を含まない（appliedAt は ISO 文字列）ので Primitives は本型をそのまま再利用する。
export type TerraformDiff = {
  readonly resourceChanges: TerraformResourceChange[];
  // この差分が実際に適用された時刻（ISO 8601）。
  readonly appliedAt: string;
  // 由来コミット。join キーではなく apply イベントの一属性として保持する。
  readonly commitSha?: string;
  // 由来変更の Web リンク（GitHub の PR/コミット）。GitCommit.url と同じ思想で、証拠として
  // フロントでクリック可能にする。ソースが提供しない場合もあるので任意（無ければ非リンク表示）。
  readonly url?: string;
  // 変更されたリソースアドレス一覧（resourceChanges から導出する表示/空判定用の便宜フィールド）。
  readonly changedResources: string[];
  readonly summary: string;
};

export type GitCommit = {
  readonly sha: string;
  readonly message: string;
  readonly author: string;
  readonly committedAt: Date;
  // コミットの Web リンク（GitHub html_url）。証拠としてフロントで sha をクリック可能にする。
  // ソースが提供しない場合もあるので任意。
  readonly url?: string;
  // このコミットに紐づく PR の参照リンク（原因＝マージ済 PR / 修正＝revert PR など）。
  // GitHub の一覧 API はコミット→PR の対応を返さないので、デモでは config 駆動で決定論的に付与し、
  // 証拠パネルに「原因PR を開く →」「revert PR を開く →」のクリック語彙で出す（terraformDiff.url と同思想）。
  readonly relatedPullRequests?: ReadonlyArray<{
    readonly url: string;
    readonly label: string;
  }>;
};

// あるコミットが変更した1ファイルのコード差分（unified diff）。
// terraformDiff が「インフラに適用された事実」なのに対し、こちらは「アプリコードの変更内容」を表す相棒。
// バイナリ/巨大ファイルでは patch は undefined になり得る。
export type GitFileDiff = {
  readonly filename: string;
  readonly status: string; // added | modified | removed | renamed など
  readonly additions: number;
  readonly deletions: number;
  // GitHub の unified diff（hunk 群）。トークン予算で末尾を切った場合は truncated=true。
  readonly patch?: string;
  readonly truncated?: boolean;
};

// 1コミットの詳細差分。fetch_recent_commits（一覧＝当たり付け）で疑わしい sha を見つけたあと、
// その1件だけを深掘りする「詳細」。トークン肥大を避けるため InfraEvidence の事前収集には載せず、
// エージェントが必要時にのみ引く（committedAt は Date／ワイヤ越えはしないので Primitives は持たない）。
export type GitCommitDiff = {
  readonly sha: string;
  readonly message: string;
  readonly author: string;
  readonly committedAt: Date;
  readonly files: GitFileDiff[];
  // ファイル数が上限を超えて files を間引いた場合 true。
  readonly filesTruncated?: boolean;
  // コミットの Web リンク（GitHub html_url）。AI が根拠として参照リンクを提示できる。
  readonly url?: string;
};

// Cloud Monitoring から相関取得した1メトリクスの要約（CPU / 接続数 / 5xx 等）。
// 生の時系列はそのまま AI に渡すとトークンを食うので、窓内の latest/max とサンプル点数に圧縮する。
// Date を含まないので Primitives は本型をそのまま再利用する。
export type InfraMetric = {
  readonly metricType: string;
  readonly displayName: string;
  readonly unit?: string;
  readonly latest: number | null;
  readonly max: number | null;
  readonly points: number;
};

export type InfraEvidence = {
  readonly appLogs: AppLogEntry[];
  readonly terraformDiff?: TerraformDiff;
  readonly recentCommits?: GitCommit[];
  readonly metrics?: InfraMetric[];
  readonly collectedAt: Date;
};
