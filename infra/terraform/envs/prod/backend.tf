# remote state は GCS。bucket/prefix は秘匿・環境依存なので partial config にし、
# init 時に backend.hcl で渡す:
#   terraform init -backend-config=backend.hcl
terraform {
  backend "gcs" {}
}
