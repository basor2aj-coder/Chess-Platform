# Mirrors the hand-created "table-chess-sg" (sg-0e530fad0619ea850) exactly,
# so importing it produces a clean `terraform plan` with no diff.
#
# Note for later: `description` is ForceNew on this resource -- if it doesn't
# match the real security group's description verbatim, Terraform will want
# to destroy and recreate the whole group (and everything is currently using
# it) rather than just report a diff. Same idea applies to the egress block:
# omitting it entirely is a classic gotcha, since AWS creates a default
# allow-all egress rule that Terraform would then try to delete.
resource "aws_security_group" "table_chess" {
  name        = "table-chess-sg"
  description = "table-chess-sg created 2026-07-17T06:27:16.884Z"
  vpc_id      = "vpc-0b365bdb8cfb3b0db"

  # No `description` on these -- the real rules were created via the console
  # without one, and description is a plain diff-able attribute (not ForceNew
  # like the group's own description), so leaving it unset here matches
  # reality and keeps `plan` clean.
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Open to the world, not just the admin IP -- see chat note. Left as-is to
  # match real state for now; worth tightening to a single CIDR after the
  # party (drop the 0.0.0.0/0 entry).
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["47.199.255.110/32", "0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # No tags on the real group either -- only the instance itself is tagged.
}
