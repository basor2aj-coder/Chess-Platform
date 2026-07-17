output "instance_id" {
  value = aws_instance.table_chess.id
}

output "public_ip" {
  value = aws_instance.table_chess.public_ip
}

output "security_group_id" {
  value = aws_security_group.table_chess.id
}
