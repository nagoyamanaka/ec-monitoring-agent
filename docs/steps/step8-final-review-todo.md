# Step 8: 最終確認TODO（実行粒度・締切 **7/12 に延長**）

> 出典: `docs/steps/step8-final-review-strategy.md`（採点・優先度の根拠。予兆強化3案の判定は §8）。
> 実行者想定: 各タスクは他のエージェントが本書だけで完遂できる粒度。人間のみ可能なタスクは §H。
> ガードレール: main/develop は常時テスト緑。**flagship seed（plan-1/pr-55/sch-1/inc-1..3・subject語彙）と予報カードの「顔」（窓・HIGH・確信度・先手見出し）は不変**。撮影済み素材と矛盾する変更は U4（差し替え）とセットでのみ可。

## 優先順位一覧

| # | タスク | 優先 | 実行者 | 状態 |
| --- | --- | --- | --- | --- |
| U0 | keepwarm（旧T1）の稼働確認・未なら実施 | ★★★★★ | エージェント＋人間(var設定) | **着手（7/9）: workflow新設・200経路を本番edgeでローカル実証／残=H1変数設定＋push＝GitHub側での自動起動有効化** |
| U1 | Forecast UI: 収束ミニフロー＋引用コンパクト化（③＋②a） | ★★★★☆ | エージェント | 未 |
| U2 | 予兆シナリオ2本目: Valkeyキャッシュ・カスケード（①） | ★★★★☆ | エージェント＋人間(PR) | 未 |
| U3 | 推論説明のプロンプト強化（②b・U2と同一再生成に同乗） | ★★★☆☆ | エージェント | 未 |
| U4 | 【任意・U2着地後のみ】動画part1差し替え＋素材更新 | ★★★☆☆ | エージェント＋人間(編集/アップ) | 未 |
| T1 | 予報キャッシュの維持機構（審査期間の床）→ U0 に統合 | ★★★★★ | — | **済（7/9・`.github/workflows/forecast-keepwarm.yml` 新設）** |
| T2 | 動画末尾にタイトルカード追記（締めの回収） | ★★★★☆ | — | **済（7/9 ユーザー報告・outro追加済）** |
| T3 | 数値ドリフト修正（1017→実測値）＋原稿の素材注記更新 | ★★★☆☆ | エージェント | 済 |
| T4 | ProtoPedia 実登録＋登録後チェック | ★★★☆☆ | 人間 | **登録済（7/9 ユーザー報告）**・チェックリスト消化とU4時の差し替えのみ残 |
| T5 | 提出直前の最終疎通リハ | ★★★☆☆ | 人間 | 未（7/12 提出直前） |

> **実施済み（2026-07-08・第2ラウンドレビュー内）**: 本番 edge へ `POST /forecast` を実行し予報キャッシュを生成（実Gemini・22.8秒・isFallback:false・HIGH 0.9・citations 6件・plan-1→PR#83）。`GET /forecast` が 200/0.13秒 のキャッシュ配信になったことを確認済み。**ただし edge 再起動で消える**——T1 が本体。

---

## T1 予報キャッシュの維持機構 ★★★★★

**事実**: 予報キャッシュは edge の InMemory。edge は 512MiB で OOM 再起動の前科があり、Cloud Run のインスタンス入替でも消える。消えると `GET /forecast` → 404「予報はまだ生成されていません」＝審査員が開いた瞬間に**最大の売りが空白ページ**。

**方針（コード変更なし・CI cron で外から支える）**: GitHub Actions のスケジュールで `GET /forecast` を監視し、404 のときだけ `POST /forecast` で再生成する。

**手順**:

1. `.github/workflows/forecast-keepwarm.yml` を新設:
   - `on: schedule: - cron: "*/30 * * * *"`（30分毎）＋ `workflow_dispatch`（手動実行用）。
   - ステップ: `curl -s -o /dev/null -w "%{http_code}" $EDGE_URL/forecast` が `200` なら終了。`404` なら `curl -fsS -X POST $EDGE_URL/forecast -m 150` を実行し、再度 GET が 200 になることを確認。それ以外（5xx/timeout）は job を fail させて通知代わりにする。
   - EDGE_URL は repo variable（`vars.FORECAST_EDGE_URL`）に `https://backoffice-edge-510288040594.asia-northeast1.run.app` を設定（人間・§H1）。POST は `DEMO_ENABLED` ガードのみで認証不要（実測済み）。
2. 留意: POST は実 Gemini 課金（1回/再生成のみ・30分毎の GET は無料）。頻度を上げない。审査終了後は workflow を無効化（人間）。
3. 検証: `workflow_dispatch` で1回実行→ログで GET 200 を確認。可能なら edge を手動リスタートして 404→自動復旧の一連を1回観測。

**受け入れ条件**: edge 再起動後30分以内に `GET /forecast` が 200 に自己復旧する。CI が赤くなったら人間に見える。

## T2 動画末尾にタイトルカード追記 ★★★★☆

**事実**: 完成版 `ハッカソンtake003.mp4`（1:54.70）は GitHub PR #29 のページ（Sign up バナー入り）で突然終了し、ブランド・コピーの回収がない。`title-card.png`（1920×1080・作成済み）を末尾に2.5秒静止で足すだけで解消。尺は約1:57＝2:00上限内。

**手順（ffmpeg は `scripts/video-capture/node_modules/.pnpm/ffmpeg-static@5.3.0/.../ffmpeg` を使用）**:

1. タイトルカードを2.5秒の無音動画に変換（本編と同一諸元: 1080p/30fps/H.264/AAC 48kHz stereo）:
   ```bash
   ffmpeg -loop 1 -t 2.5 -i docs/protopedia/assets/title-card.png \
     -f lavfi -t 2.5 -i anullsrc=r=48000:cl=stereo \
     -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -shortest outro.mp4
   ```
2. concat（本編は再エンコードなしのstream copyだと接合点で崩れる場合があるため、安全側=全体再エンコード。1:57/1080pで数分）:
   ```bash
   printf "file 'ハッカソンtake003.mp4'\nfile 'outro.mp4'\n" > list.txt
   ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k ハッカソンtake003_final.mp4
   ```
3. 検証: 総尺 ≈1:57・末尾2.5秒にタイトルカード・音声にノイズ/欠落なし（末尾10秒を再生確認）・ファイル先頭〜結合点のフレーム目視。
4. `docs/protopedia/video/script.md` のカット表末尾と「完成版チェック結果」最終項目（締めのブランド回収）を更新。

**受け入れ条件**: 最終フレームが「障害は、起きる前に終わらせる。／Kizashi」で終わる。YouTube アップロードは新ファイルを使う（§H2）。

## T3 数値ドリフト修正＋原稿の素材注記更新 ★★★☆☆

**事実**: README.md:14 と `docs/protopedia/protopedia-submission.md`:100 が「ユニットテスト **1017件**」。step7 D3.5 時点の記録は **1069件**。「数値はすべて実測」を掲げる作品での自己矛盾。原稿:116 の「動画素材の正: `output/take003/`」も完成版と不整合。

**手順**:

1. ~~実測: `pnpm -r test 2>&1 | tail -30` でユニットテスト総数と E2E 件数を取得（実行できない場合は各パッケージの直近レポートを合算し、根拠をコミットメッセージに書く）。~~ → 実測は `pnpm test`（ルート、vitest workspace）でユニット **1070件**（151ファイル・全緑）、`pnpm --filter e2e run test` で E2E **22件**（既存記載どおり。ただし現状 stub AI 経路で一部失敗＝開発コンテナの再起動/`/demo/reset`待ちの既知不安定挙動で今回のドリフト修正対象外）。
2. ~~README.md:14 のテスト行と、submission:100 の「ユニットテスト 1017 件全緑」を実測値へ更新。~~ → 完了（1017→1070）。
3. ~~submission:116 を「動画の正: リポジトリ直下 `ハッカソンtake003.mp4`（T2後は `_final`）。素材: `output/take003/`＋`output/take004/`。as-built 台本: video/script.md」へ更新。~~ → 完了。
4. 検証: `grep -rn "1017" README.md docs/protopedia/` が 0 件 → 確認済み。

**受け入れ条件**: 提出3面（README・ProtoPedia原稿・動画）の数値・参照がすべて実測と一致。→ **達成**（2026-07-08）。

## T4 ProtoPedia 実登録（人間）★★★☆☆

原稿 `protopedia-submission.md` をフォームへ転記。**登録後チェックリスト**:

- [ ] コードブロック/mermaid が生テキスト表示されていない
- [ ] 画像順: poster-1-hero → architecture → poster-3 → poster-4 → poster-5（アーキ図欄には architecture.png）
- [ ] 動画URL: T2後の `_final` 版をアップロードした YouTube URL・サムネ=`video-thumbnail.png`
- [ ] タイトル・概要85字・タグが原稿どおり
- [ ] 公開状態で自分以外のアカウント（またはシークレットウィンドウ）から閲覧確認

## T5 提出直前の最終疎通リハ（人間・提出当日）★★★☆☆

シークレットウィンドウで本番URLを一巡（5分）:

1. `/forecast` — 予報カードが出る（**404なら T1 の workflow を手動実行**）・「証拠を開く」→PR#83/#55 が開く
2. `/alerts` — デモコンソールでシナリオ1本注入→分類→（時間があれば）調査完走
3. 既知アラート→詳細→過去レポートが開く
4. GitHub リポ公開状態・PR #83/#55/#29 が開ける
5. ProtoPedia ページ・YouTube 動画が非ログインで再生できる

---

---

## U0 keepwarm の稼働確認 ★★★★★（すべての前提）

**内容**: 旧T1（`.github/workflows/forecast-keepwarm.yml`）が実際に存在し動いているかを確認。無ければ T1 の手順どおり新設。ある場合も `workflow_dispatch` で1回実行し、`GET /forecast` 200 をログで確認。

**なぜ最優先か**: U2 のデプロイは edge 再起動＝キャッシュ全消しを必ず起こす。keepwarm が無いままデプロイすると、再生成を忘れた瞬間に本番の売りが空白ページになる。**U1/U2 のすべての作業の安全網**。

**受け入れ条件**: edge 再起動→30分以内に GET /forecast が 200 へ自己復旧することを1回実測（またはワークフローの404→POST→200のログ確認）。

**進捗（2026-07-09）**:
- `.github/workflows/forecast-keepwarm.yml` を新設（`schedule: */30` ＋ `workflow_dispatch`）。on/off = GitHub UI の Disable workflow / 手動起動 / ファイル削除の3系統。
- ワークフローのロジックを本番 edge に対しローカル実行し **GET /forecast → 200**（7/8生成キャッシュ生存・HIGH 0.9・引用plan-1/pr-55/sch-1/inc-1/inc-2）を確認＝「200なら何もしない」経路を実証。404→POST→200 の自動復旧はGitHub Actions実起動が要る（下記の人間タスク後）。POST の実動作自体は 7/8 に手動実証済み。
- **残（人間・push後）**: ① H1: repo variable `FORECAST_EDGE_URL=https://backoffice-edge-510288040594.asia-northeast1.run.app` を Settings→Variables に設定 → ② workflow をGitHubへ push（この環境からは gh 認証不可） → ③ `workflow_dispatch` で1回手動起動しログで GET 200 を確認。可能なら edge 手動リスタート後の 404→自動復旧を1回観測。

## U1 Forecast UI: 収束ミニフロー＋引用コンパクト化（③＋②a）★★★★☆

**内容（フロントのみ・contracts/edge 不変・キャッシュ無傷）**:

1. **収束ミニフロー**: RiskCard の「根拠（引用）」見出しの上に、アラート詳細「証拠の流れ」（`grep -rn "証拠の流れ" src/apps/backoffice/frontend` でコンポーネント特定）と同じ視覚言語の横ストリップを追加。
   - 左=入力レーン別件数（未来の変更 N件／負荷予定 N件／過去の同型 N件——`citations` を突合先シグナルの kind で group して決定論で数える）→ 中=「Gemini 突合」ノード → 右=結論（subject の人間語＋レベル＋確信度%）。
   - **これが②aの回答**: 「なぜHIGHか＝どの系統が何件収束したか」をLLMに言わせず構造で見せる。
2. **引用チップのコンパクト化**: `ReferencedEvidenceCard` を1行row（レーンバッジ＋人間語タイトル＋「証拠を開く」リンク）へ。生IDメタ行・長い説明は `<details>` 展開に格納。目安=アラート詳細の「影響範囲」行と同程度の高さ。縦長解消。
3. **先手の効果1行（決定論テンプレ）**: 「今打てる先手」カード内に補足行「この先手で、過去の同型事例（N件）と同じ経路の再発を高負荷窓の外へ外します」——citations の past 件数から生成。②bが載ればLLM文で上書きされる設計にしない（別行で共存）。

**ガードレール**: カードの「顔」（窓・HIGH・確信度バー・先手見出し・チップのレーン色）は不変＝ポスター/動画との連続性維持。フロントUTのみで担保・全緑。

**検証**: ローカル compose 目視→スクショ1枚。本番はフロントのみデプロイ→ `GET /forecast` が200のまま（edge 非再起動）を確認→画面目視。

**受け入れ条件**: 予報カードが「入力→AI推論→結論→先手」の順で1画面で読める。既存1070 UT＋追加UT緑。

## U2 予兆シナリオ2本目: Valkeyキャッシュ・カスケード（①）★★★★☆

**物語（4系統収束・結論は flagship と同じ DB接続プール枯渇に収束させる＝動画字幕「週末の夜にDB障害のリスクが高い」と矛盾しない）**:

```
Terraform plan（Valkey メモリ縮小・合成seed） × 未マージPR（cache TTL短縮・実draft PR＝H4）
 × 週末セール負荷 x5（sch-1 共用） × 過去の同型記憶（TTL短縮→ヒット率低下→DBアクセス急増→枯渇・新seed）
 → キャッシュヒット率低下 → DB直撃 → db_connection_pool_exhaustion HIGH
 → 先手: plan適用とPRマージをセール後へ延期・Valkeyメモリ/ヒット率の監視強化
```

**手順**:

1. `ForecastPendingPlanSeed.ts` に2本目の `PendingPlan` を追加（例: address `module.gce_backbone.google_compute_instance.backbone` は**使用禁止**＝flagship専用。`valkey`/`cache` トークンを含む合成 address、attributeDeltas=`maxmemory 4gb→2gb` 等）。
   - **⚠捏造ガード（必須）**: `withPendingPlanEvidenceUrl` は **url の無い全 plan に PR#83 を付ける**実装。このままだと合成Valkey planに実PRリンクが付く＝捏造事故。**address が backbone の plan にだけ url を付けるよう関数を修正**（`plan.resourceChanges[0].address` 一致条件を追加・UTで両ケース固定）。
2. `ForecastScheduleSeed.ts` は不変（sch-1 を共用＝「同じ週末セールが2つのリスクに効く」は物語としても正しい）。
3. `ResolvedAlertSeed.ts` に過去事例を2件追加（inc-4/inc-5 相当）: 「TTL短縮でヒット率低下→プール枯渇（TTL戻して解消）」「Valkeyメモリ縮小でeviction急増→同型（メモリ戻して解消）」。**report.subject は 1. の plan address と2トークン以上重なる語彙**（例: `valkey`+`cache`）＝ subjectsMatch 突合の成立条件。flagship の inc-1..3 は不変。
4. `StubLLMClient.ts` の固定予報に2本目のリスクを追加（E2E決定論維持・偽引用ドロップの既存E2Eを壊さない）。
5. `ForecastDemoConsole.tsx` の投入シグナル台帳に行追加。**バッジの正直さ**: Valkey plan 行は「合成seed」バッジ（plan-1 の「実plan」と区別）・PR行は実draft PR なので「実データ」のまま。
6. H4（人間）: 実 draft PR を作成——タイトル「chore(cache): カタログキャッシュ TTL 300s→60s に短縮（Valkeyメモリ縮小に追随）」等・**タイトルがそのままチップに直写しされる**ので人間語で・diff は無害（設定値 or ドキュメント）・base=develop・DO NOT MERGE 本文。間に合わない場合は PR レーン無しの3系統で成立させる（**縮退であって中止ではない**）。

**検証（この順で・省略禁止）**:

1. ローカル stub: UT/E2E 全緑（1070+追加分）。
2. ローカル実 Gemini 1回: `risks` が2件・flagship の引用が維持（plan-1/pr-55/sch-1/inc-*）・シナリオ2が [valkey-plan, (pr), sch-1, inc-4/5] を引用・偽引用なし。
3. デプロイ（edge 再起動＝キャッシュ消滅を認識して実施）→ 本番 `POST /forecast` → JSON検証: flagship=HIGH・引用6件相当・plan-1 url=#83 のまま／シナリオ2=4系統引用・**合成planにPRリンクが付いていない**こと。
4. **rollback 基準**: 2. か 3. で flagship が劣化（引用減・fallback・物語混線）→ seed コミットを revert→再デプロイ→`POST /forecast`→現状復帰を確認。

**受け入れ条件**: 本番 `/forecast` に2枚のリスクカード。flagship は現状と同等以上。全テスト緑。

## U3 推論説明のプロンプト強化（②b）★★★☆☆ — U2と同一再生成イベントに同乗

**内容**: 予報生成プロンプトに次の2点を追加——(a) reasoning は「〜という4つ（N系統）の根拠が同一の帰結に収束したため HIGH」の**収束構造**で書く (b) preventiveAction は「実行すると何が防げるか」（防げる再発の型・対象窓）を1文含める。

**ガードレール**: contracts のフィールド追加はしない（既存 reasoning/preventiveAction の文章品質のみ）。stub の固定文も同構造に合わせて更新（E2Eの表示検証が同じ形を見るように）。

**検証**: U2 のローカル実 Gemini 検証と同時に文面を目視（収束構造になっているか・引用IDが本文に自然に入るか）。**U2をやらない場合はU3も見送り**（単独で再生成イベントを起こす価値はない）。

## U4 【任意】動画 part1 差し替え＋素材更新 ★★★☆☆ — U2が7/10中に本番着地した場合のみ

**価値**: 凍結素材（動画・ポスター・サムネ）側にも「予兆は複数シナリオ」が映る＝①〜③の効果を審査の主戦場に露出させる。ナレ・字幕はシナリオ固有名を言わないため**音声そのまま・映像だけ差し替え**が成立する。

**手順**:

1. 撮影: `POST /demo/reset` → 予報再生成済みを確認 → `RESET=1 TAKE=take005 node capture.mjs forecast`。2カード表示・plan-1→#83/pr-55→#55 遷移が本編に焼き込まれること（新シナリオのチップクリックは**足さない**＝尺と字幕タイミングを変えないため）。
2. 編集（人間）: 完成版の part1 区間（0:05–0:44）の映像のみ take005 に差し替え・音声/字幕/outro は不変。
3. 素材再生成: `TAKE=take005 node scripts/video-capture/make-posters.mjs`（poster-1-hero のみ）＋ `make-thumbnail.mjs`。
4. アップロード差し替え（人間・**チェックリスト必須＝差し替え漏れが新たな失点源**）:
   - [ ] YouTube へ新版アップ（動画差し替え不可のため**新URL**）・サムネ設定
   - [ ] ProtoPedia の動画URLを新URLへ更新
   - [ ] ProtoPedia の poster-1-hero / サムネ画像を差し替え
   - [ ] 旧YouTube動画を非公開化（審査員が旧版に迷い込まない）
   - [ ] script.md のas-built（カット1〜2の実測・素材構成表）を take005 で更新
5. **中止基準**: U2の本番着地が7/10中でない／編集時間が確保できない → やらない（現行動画で提出。①〜③はURL訪問者向けの上積みとして成立済み）。

## T5 提出直前の最終疎通リハ（人間・7/12 提出直前）★★★☆☆

シークレットウィンドウで本番URLを一巡（5分）:

1. `/forecast` — 予報カードが出る（**404なら keepwarm を手動実行**）・カード2枚（U2後）・「証拠を開く」→PR#83/#55/（H4のPR）が開く
2. `/alerts` — デモコンソールでシナリオ1本注入→分類→（時間があれば）調査完走
3. 既知アラート→詳細→過去レポートが開く
4. GitHub リポ公開状態・PR #83/#55/#29 が開ける
5. ProtoPedia ページ・YouTube 動画（U4後は新URL）が非ログインで再生できる

---

## H. 人間タスク

| # | タスク | 内容 |
| --- | --- | --- |
| H1 | repo variable 設定 | `FORECAST_EDGE_URL` を Actions variables に追加（U0/T1 の前提） |
| H2 | ~~YouTube アップロード~~ | 済（7/9報告）。U4実施時のみ新URL再アップ＋ProtoPedia更新 |
| H3 | 審査終了後の後始末 | forecast-keepwarm.yml の無効化・PR #83/H4のPR クローズ可否判断 |
| H4 | シナリオ2用の実 draft PR 作成 | U2手順6参照（タイトル=チップ直写し・無害diff・base=develop・DO NOT MERGE） |
| H5 | U4 の編集・アップロード | part1差し替え編集＋U4チェックリスト消化 |

## 完了の定義（優秀賞ラインの床・最終形）

- [ ] `GET /forecast` が審査期間中 200 を維持する仕組みが動いている（U0/T1）
- [x] 本番で実 Gemini 予報が生成できる（2026-07-08 実証・22.8秒・引用6件）
- [x] 動画の最終フレームがブランドで終わる（T2・7/9 ユーザー報告）
- [x] 提出3面の数値が実測と一致（T3・2026-07-08・ユニット1070件/E2E22件）
- [x] ProtoPedia 登録済み（7/9 ユーザー報告）— 第三者閲覧確認は T5 で
- [ ] 【上積み】予報カードが「入力→推論→結論→先手」で読める（U1）
- [ ] 【上積み】本番 `/forecast` に2本目のシナリオ（U2・flagship 無傷が条件）
- [ ] 【任意】動画 part1 に2カードが映る（U4・チェックリスト完走が条件）
