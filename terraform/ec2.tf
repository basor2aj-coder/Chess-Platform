# Mirrors the hand-launched "table-chess" instance (i-05703fd273b7cae0f).
# Deliberately no Elastic IP resource here -- the public IP is left dynamic
# on purpose (see deploy/update-dns.sh) to avoid paying for a static IP
# while the box is stopped. aws_route53_record.chess in dns.tf tracks
# whatever public_ip this instance currently has.
resource "aws_instance" "table_chess" {
  ami           = "ami-09f7444a9a9604198" # Ubuntu 24.04 arm64
  instance_type = "t4g.micro"
  key_name      = "chess_key"

  subnet_id                   = "subnet-01909b5bfeb21a849"
  vpc_security_group_ids      = [aws_security_group.table_chess.id]
  associate_public_ip_address = true
  ebs_optimized               = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 10
    delete_on_termination = true
  }

  metadata_options {
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2
    http_endpoint               = "enabled"
  }

  tags = {
    Name = "table-chess"
  }

  lifecycle {
    # associate_public_ip_address reads back as false whenever the instance
    # is actually stopped (no ENI association without an EIP, by design --
    # see the no-EIP comment above), which no longer matches this being
    # merely `true` at launch time now that idle auto-stop
    # (lambda_idle_check.tf) means the box spends most of its time stopped.
    # Without this, `terraform apply` run at the wrong moment would see that
    # as drift on a forces-replacement attribute and destroy/recreate the
    # live instance. Same category of problem as the DNS record ownership
    # split in dns.tf -- a runtime-toggled attribute that Terraform must stop
    # trying to reconcile.
    ignore_changes = [associate_public_ip_address]
  }
}
