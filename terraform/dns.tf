# The hosted zone itself was created by registering the domain through
# Route 53 -- treated as a read-only data source, not something Terraform
# manages, since destroying/recreating a hosted zone would change its
# nameservers and break the domain's NS delegation.
data "aws_route53_zone" "basorelabs" {
  name         = "basorelabs.dev."
  private_zone = false
}

# Tracks the instance's current public IP, replacing the manual
# deploy/update-dns.sh script -- `terraform apply` after any stop/start
# resyncs this automatically instead of a separate CLI call.
resource "aws_route53_record" "chess" {
  zone_id = data.aws_route53_zone.basorelabs.zone_id
  name    = "chess.basorelabs.dev"
  type    = "A"
  ttl     = 300
  records = [aws_instance.table_chess.public_ip]
}
