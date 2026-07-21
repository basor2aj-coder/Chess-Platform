# The hosted zone itself was created by registering the domain through
# Route 53 -- treated as a read-only data source, not something Terraform
# manages, since destroying/recreating a hosted zone would change its
# nameservers and break the domain's NS delegation.
data "aws_route53_zone" "basorelabs" {
  name         = "basorelabs.dev."
  private_zone = false
}

# Ownership of this record's live content is split from Terraform as of the
# idle auto-stop/auto-start work (see lambda_wake.tf / lambda_idle_check.tf):
# it now alternates between two structurally different shapes -- a plain
# A/IP record pointing at the instance, and a Route 53 alias pointing at the
# wake-up Lambda's API Gateway domain (api_gateway.tf) -- flipped by those
# two Lambdas via UPSERT outside of Terraform, not by `terraform apply`.
#
# If Terraform kept actively reconciling this record, any unrelated `apply`
# would read the instance's *current* public_ip and force the record back to
# it, clobbering a legitimate "parked on API Gateway while stopped" state --
# and public_ip is an empty string while stopped (no EIP, by design), so an
# apply at the wrong moment would try to write an invalid record entirely.
#
# `records` below is therefore only a fallback used for initial creation (or
# if this resource is ever tainted/recreated) -- it is NOT what's live day to
# day. `ignore_changes = all` tells Terraform to keep tracking that the
# record exists, but never again touch its content; both Lambdas always do a
# full UPSERT (never partial) so there's no shape ambiguity between runs.
resource "aws_route53_record" "chess" {
  zone_id = data.aws_route53_zone.basorelabs.zone_id
  name    = "chess.basorelabs.dev"
  type    = "A"
  ttl     = 300
  records = [aws_instance.table_chess.public_ip]

  lifecycle {
    ignore_changes = all
  }
}
