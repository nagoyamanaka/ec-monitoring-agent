#!/usr/bin/env bash
#
# stage-demo-branch.sh — デモシナリオ7（アプリコード退行）の「実 git 証跡」を仕込むスクリプト
# ============================================================================================
#
# 何をするか:
#   main から `demo/regression` ブランチを（再）作成し、その上に「テストは通るが挙動を退行させる
#   アプリコードのバグ」を実コミットとして1個積む。これが AI 調査の root cause 証跡になる。
#   例として小計計算（SubtotalAmount）に丸め誤りを混入させる＝一見無害なリファクタを装ったデグレ。
#
# なぜ必要か（設計の核心）:
#   - デモシナリオ7は「検知の入口（APPLICATION Alert）だけ合成」し、原因は **実在の git 差分** に置く。
#     AI が GitHubGateway.getCommitDiff で本物の unified diff を引いて分析する＝証跡が代表値でなく実物。
#   - このコミットは **一度もデプロイ・実行されない**。アプリは clean な main で動く。バグは「AI が読む
#     証跡」としてだけ存在する。だから main を汚さず・CI/deploy を発火させずに本物の差分を見せられる。
#
# main を汚さない保証:
#   - 触るのは `demo/regression` ブランチのみ。main へは何もコミット・マージしない。
#   - CI(ci.yml) は `on: push: branches:[main]` なので、この push では build/deploy/gce 再起動は走らない。
#
# 審査期間中ずっと見せられる理由（時間窓の罠を回避）:
#   - 調査は env `GITHUB_TARGET_REF=demo/regression` を見る。GitHubGatewayImpl はその ref の tip コミットを
#     **時刻フィルタなし**で返すので、ここで1回積めば審査員がいつ閲覧しても直近コミットとして発見される。
#     ＝デモ直前の再実行は不要（壁時計非依存）。
#
# 使い方:
#   1. ワーキングツリーを clean にして（未コミット変更が無い状態で）実行:  bash scripts/stage-demo-branch.sh
#   2. リモートへ push:  git push -f origin demo/regression
#      （GitHub API で差分を引けるよう、調査先リポジトリに demo/regression が存在する必要がある）
#   3. backoffice backend の env に GITHUB_TARGET_REF=demo/regression を設定（demo デプロイのみ）。
#
# 冪等性: 再実行すると demo/regression を main から作り直して同じバグを積み直す（force）。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DEMO_BRANCH="demo/regression"
BASE_BRANCH="main"
TARGET_FILE="src/Contexts/EC/Orders/domain/SubtotalAmount.ts"

# ── 安全確認: 未コミット変更があると取り違えるので中断する ──────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ ワーキングツリーに未コミット変更があります。commit/stash してから再実行してください。" >&2
  exit 1
fi

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "▶ 元ブランチ: $ORIGINAL_BRANCH / ベース: $BASE_BRANCH / 証跡ブランチ: $DEMO_BRANCH"

# ── demo/regression を main から作り直す（既存があれば force で上書き）──────────────────
git fetch origin "$BASE_BRANCH" --quiet || true
git checkout -B "$DEMO_BRANCH" "$BASE_BRANCH"

# ── バグ混入: 小計を整数円に truncate して端数を黙って落とす（丸め誤り＝合計不整合の原因）──
#   一見「float を避ける軽いリファクタ」に見えるが、端数価格の商品で小計が狂い 500 を誘発する。
#   テスト（整数価格のケースのみ）はすり抜ける＝「テストは通ったが挙動退行」を体現する。
cat > "$TARGET_FILE" <<'TS'
import { NumberValueObject } from "../../../Shared/domain/value-object/NumberValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export class SubtotalAmount extends NumberValueObject {
  constructor(value: number) {
    // perf: 小計は整数円で扱う方が軽いので端数を切り捨てる（※これがデグレ＝端数価格で合計が狂う）
    super(Math.trunc(value));
    if (value < 0) {
      throw new InvalidArgumentError(`SubtotalAmount must be >= 0, got: ${value}`);
    }
  }
}
TS

git add "$TARGET_FILE"
git commit --quiet -m "perf(orders): 小計を整数円で保持して float 演算を回避

端数を Math.trunc で落とすことで小計計算を軽量化する。
（注: これはデモシナリオ7用に意図的に仕込んだ退行コミット。端数価格の注文で
 小計が不整合になり 500 を誘発する＝AI 調査の root cause 証跡。デプロイはされない）"

echo "✓ $DEMO_BRANCH に退行コミットを作成しました:"
git --no-pager log --oneline -1

# ── 元ブランチへ戻す（main は一切変更していない）────────────────────────────────────────
git checkout --quiet "$ORIGINAL_BRANCH"
echo "▶ $ORIGINAL_BRANCH に戻りました。"
echo
echo "次の手順:"
echo "  1) git push -f origin $DEMO_BRANCH"
echo "  2) backoffice backend env に GITHUB_TARGET_REF=$DEMO_BRANCH を設定（demo デプロイのみ）"
echo "  3) DEMO CONSOLE のシナリオ7『アプリコード退行』を押下"
