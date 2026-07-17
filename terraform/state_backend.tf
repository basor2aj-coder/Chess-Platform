# S3 bucket to hold Terraform's own state, once migrated off local disk.
#
# Deliberately NOT wired up as a `backend "s3" {}` block yet -- that's a
# chicken-and-egg problem: Terraform can't store state in a bucket that
# doesn't exist. Two-phase rollout:
#   1. `terraform apply` with this resource (bucket created, state for
#      *this* resource still stored locally, like everything else today).
#   2. Add a `backend "s3" { bucket = "..." key = "terraform.tfstate"
#      region = "us-east-1" use_lockfile = true }` block, then run
#      `terraform init -migrate-state` to copy local state into the bucket.
# No DynamoDB table -- `use_lockfile = true` on the S3 backend (GA since
# Terraform 1.11) handles locking natively.
resource "aws_s3_bucket" "terraform_state" {
  bucket = "table-chess-terraform-state-604579608291"
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # SSE-S3, no KMS key to pay for
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Keeps the bucket from growing forever as state versions pile up across
# months of applies -- state files are small, but no reason to keep them
# indefinitely.
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"
    filter {} # applies to every object in the bucket
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}
