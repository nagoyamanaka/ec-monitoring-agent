#!/usr/bin/env bash
# 手動デプロイスクリプト。CI がない場合や緊急時に使う。
# 使い方（repo ルートからでも infra/terraform/ からでも OK）:
#   infra/terraform/manual_deploy.sh [ec-backend|backoffice-backend|backoffice-frontend|all]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

AR_HOST="asia-northeast1-docker.pkg.dev"
PROJECT="ec-monitoring-agent"
REPO="apps"
REGION="asia-northeast1"
ZONE="asia-northeast1-a"
VM_NAME="ec-monitoring-backbone"

IMG="${AR_HOST}/${PROJECT}/${REPO}"

# credential helper 経由だと docker が root で gcloud を呼び認証失敗するため、
# アクセストークンを直接 docker login に渡す方式を使う。
gcloud auth print-access-token \
  | docker login -u oauth2accesstoken --password-stdin "https://${AR_HOST}"

# AR の untagged ダイジェストを削除（:latest push のたびに旧イメージが残るため）
cleanup_ar() {
  local name="$1"
  echo "  [cleanup] ${name}: untagged イメージを削除中..."
  gcloud artifacts docker images list "${IMG}/${name}" \
    --filter="tags=''" --format="get(version)" 2>/dev/null \
  | while IFS= read -r digest; do
    [[ -z "${digest}" ]] && continue
    gcloud artifacts docker images delete "${IMG}/${name}@${digest}" --quiet 2>/dev/null || true
  done
}

# VM 上で compose pull & up（IAP 経由 SSH）
# sudo を使う理由: gcloud SSH ユーザーは docker グループ外のため /var/run/docker.sock にアクセス不可。
# トークンを再取得する理由: startup-script のアクセストークンは ~1h で失効する。
backbone_update() {
  local service="$1"
  gcloud compute ssh "${VM_NAME}" --zone="${ZONE}" --tunnel-through-iap \
    --command="
      set -e
      TOKEN=\$(curl -sf -H 'Metadata-Flavor: Google' \
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' \
        | sed -n 's/.*\"access_token\":\"\([^\"]*\)\".*/\1/p')
      echo \"\$TOKEN\" | sudo docker login -u oauth2accesstoken --password-stdin 'https://${AR_HOST}'
      sudo docker compose \
        --env-file /opt/app/.env \
        -f /opt/app/docker-compose.base.yml \
        -f /opt/app/docker-compose.prod.yml \
        pull ${service}
      sudo docker compose \
        --env-file /opt/app/.env \
        -f /opt/app/docker-compose.base.yml \
        -f /opt/app/docker-compose.prod.yml \
        up -d ${service}
    "
}

deploy_ec_backend() {
  echo "=== ec-backend ==="
  docker build --target prod \
    -t "${IMG}/ec-backend:latest" \
    -f src/apps/ec/backend/Dockerfile .
  docker push "${IMG}/ec-backend:latest"
  backbone_update "ec-backend"
  cleanup_ar "ec-backend"
  echo "  [done] ec-backend"
}

deploy_backoffice_backend() {
  echo "=== backoffice-backend ==="
  docker build --target prod \
    -t "${IMG}/backoffice-backend:latest" \
    -f src/apps/backoffice/backend/Dockerfile .
  docker push "${IMG}/backoffice-backend:latest"
  backbone_update "backoffice-backend"
  gcloud run services update backoffice-edge \
    --image "${IMG}/backoffice-backend:latest" \
    --region "${REGION}"
  cleanup_ar "backoffice-backend"
  echo "  [done] backoffice-backend"
}

deploy_frontend() {
  echo "=== backoffice-frontend ==="
  docker build --target runner \
    -t "${IMG}/backoffice-frontend:latest" \
    -f src/apps/backoffice/frontend/Dockerfile .
  docker push "${IMG}/backoffice-frontend:latest"
  gcloud run services update backoffice-frontend \
    --image "${IMG}/backoffice-frontend:latest" \
    --region "${REGION}"
  cleanup_ar "backoffice-frontend"
  echo "  [done] backoffice-frontend"
}

SERVICE="${1:-}"
if [[ -z "${SERVICE}" ]]; then
  echo "使い方: $0 [ec-backend|backoffice-backend|backoffice-frontend|all]" >&2
  exit 1
fi

case "${SERVICE}" in
  ec-backend)          deploy_ec_backend ;;
  backoffice-backend)  deploy_backoffice_backend ;;
  backoffice-frontend) deploy_frontend ;;
  all)
    deploy_ec_backend
    deploy_backoffice_backend
    deploy_frontend
    ;;
  *)
    echo "不明なサービス: ${SERVICE}" >&2
    echo "使い方: $0 [ec-backend|backoffice-backend|backoffice-frontend|all]" >&2
    exit 1
    ;;
esac

echo ""
echo "デプロイ完了: ${SERVICE}"
