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
}
