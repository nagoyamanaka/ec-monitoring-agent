#!/usr/bin/env bash
# GCE backbone VM のディスク掃除スクリプト。
# デプロイ（compose pull）のたびに旧 :sha / dangling イメージが VM に溜まり、
# /var/lib/containerd を圧迫して `no space left on device` でデプロイが落ちる。
# 稼働中コンテナが参照するイメージは残したまま、未使用イメージ・停止コンテナ・
# 未使用ビルドキャッシュ・未使用ボリューム外の残骸を掃除する。
#
# 使い方（repo ルートからでも infra/terraform/ からでも OK）:
#   infra/terraform/prune_gce.sh          # 掃除実行（未使用イメージ全削除）
#   infra/terraform/prune_gce.sh --dry-run # 現状確認のみ（削除しない）
set -euo pipefail

PROJECT="ec-monitoring-agent"
ZONE="asia-northeast1-a"
VM_NAME="ec-monitoring-backbone"

DRY_RUN="${1:-}"

ssh_vm() {
  gcloud compute ssh "${VM_NAME}" \
    --project="${PROJECT}" \
    --zone="${ZONE}" \
    --tunnel-through-iap \
    --quiet \
    --ssh-flag="-o StrictHostKeyChecking=no" \
    --command="$1"
}

echo "======================================"
echo "  GCE backbone ディスク掃除"
echo "  VM: ${VM_NAME} (${ZONE})"
echo "======================================"

echo ""
echo "=== 掃除前 ==="
ssh_vm "
  set -e
  echo '--- df -h / ---'
  df -h /
  echo '--- docker system df ---'
  sudo docker system df
"

if [[ "${DRY_RUN}" == "--dry-run" ]]; then
  echo ""
  echo "--dry-run 指定のため削除はしません。"
  exit 0
fi

echo ""
echo "=== 掃除実行（未使用イメージ・停止コンテナ・未使用ビルドキャッシュ）==="
# image prune -a: 稼働中コンテナが参照しないイメージを全削除（旧 :sha / dangling を含む）。
#   稼働中の :latest 等は参照されているので残る。
# container prune / builder prune: 停止残骸とビルドキャッシュも回収。
ssh_vm "
  set -e
  sudo docker container prune -f
  sudo docker image prune -a -f
  sudo docker builder prune -a -f
"

echo ""
echo "=== 掃除後 ==="
ssh_vm "
  set -e
  echo '--- df -h / ---'
  df -h /
  echo '--- docker system df ---'
  sudo docker system df
"

echo ""
echo "掃除完了。デプロイを再実行してください。"
