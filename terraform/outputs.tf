output "instance_id" {
  value = aws_instance.table_chess.id
}

output "public_ip" {
  value = aws_instance.table_chess.public_ip
}

output "security_group_id" {
  value = aws_security_group.table_chess.id
}

# For manual debugging during rollout (aws lambda invoke, checking logs, etc).
output "wake_lambda_name" {
  value = aws_lambda_function.wake.function_name
}

output "idle_check_lambda_name" {
  value = aws_lambda_function.idle_check.function_name
}

output "api_gateway_domain_target" {
  value = aws_apigatewayv2_domain_name.chess.domain_name_configuration[0].target_domain_name
}

# Set this as the DEPLOY_ROLE_ARN repo variable in GitHub Actions.
output "github_actions_deploy_role_arn" {
  value = aws_iam_role.github_actions_deploy.arn
}

# Bookmark this -- it's the only URL that can actually start the instance
# while it's stopped. `terraform output -raw wake_url` to print it in full.
output "wake_url" {
  value     = "https://chess.basorelabs.dev/?key=${var.wake_secret}"
  sensitive = true
}
