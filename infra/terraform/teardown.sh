#!/usr/bin/env bash
# ハッカソン終了後などにインフラ全体を停止するスクリプト。
# terraform destroy で全リソースを削除する。
# 使い方（repo ルートからでも infra/terraform/ からでも OK）:
#   infra/terraform/teardown.sh [--yes]
#
# --yes を渡すと確認プロンプトをスキップ（CI などで使用）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${SCRIPT_DIR}/envs/prod"

AUTO_APPROVE="${1:-}"

echo "======================================"
echo "  インフラ teardown (terraform destroy)"
echo "  対象: ${TF_DIR}"
echo "======================================"

if [[ "${AUTO_APPROVE}" != "--yes" ]]; then
  echo ""
  echo "警告: この操作は prod 環境の全リソースを削除します。"
  echo "  - VM (ec-monitoring-backbone)"
  echo "  - Cloud Run サービス"
  echo "  - Artifact Registry イメージは残ります"
  echo ""
  read -r -p "本当に削除しますか？ [yes/N]: " CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "キャンセルしました。"
    exit 0
  fi
fi

cd "${TF_DIR}"

echo ""
echo "=== terraform init ==="
terraform init -backend-config=backend.hcl -reconfigure

echo ""
echo "=== terraform destroy ==="
if [[ "${AUTO_APPROVE}" == "--yes" ]]; then
  terraform destroy -auto-approve
else
  terraform destroy
fi

echo ""
echo "teardown 完了。インフラリソースを削除しました。"
echo "再構築する場合は manual_deploy.sh の前に terraform apply を実行してください。"
