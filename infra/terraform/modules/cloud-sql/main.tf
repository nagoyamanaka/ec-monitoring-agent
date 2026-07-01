# Cloud SQL (PostgreSQL) — EC バックエンドの主データストア。
# デモ シナリオ6（構成変更障害）の対象リソース。コスト最適化と称した tier / max_connections の
# 縮小（この baseline の値）が接続枯渇を招き、DB インスタンスを不安定化させた。
resource "google_sql_database_instance" "main" {
  name             = "ec-main"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    # コスト最適化で縮小した（＝障害の起点）。本来は db-custom-2-7680。
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10

    database_flags {
      name = "max_connections"
      # 100 → 20 に縮小した（＝接続枯渇の直接要因）。
      value = "20"
    }
  }

  deletion_protection = true
}
