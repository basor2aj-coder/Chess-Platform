# Fronts the wake-up Lambda (lambda_wake.tf) for chess.basorelabs.dev while
# the EC2 instance is stopped. A bare Lambda Function URL has no stable
# hostname a Route 53 alias record can target with a cert that matches our
# domain -- API Gateway's custom-domain feature does support that, so
# visitors see a valid cert on the holding page instead of a mismatch
# warning. An ALB would also work but costs a fixed ~$16/mo regardless of
# traffic, not worth it for a front door that mostly sits idle.

# DNS-validated so it renews itself automatically for as long as this zone
# exists -- no manual cert rotation to remember.
resource "aws_acm_certificate" "chess" {
  domain_name       = "chess.basorelabs.dev"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "chess_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.chess.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.basorelabs.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "chess" {
  certificate_arn         = aws_acm_certificate.chess.arn
  validation_record_fqdns = [for record in aws_route53_record.chess_cert_validation : record.fqdn]
}

resource "aws_apigatewayv2_api" "wake" {
  name          = "table-chess-wake"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "wake" {
  api_id                 = aws_apigatewayv2_api.wake.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.wake.invoke_arn
  payload_format_version = "2.0"
}

# Catch-all -- the wake Lambda returns the same holding page for every path,
# so no per-route logic is needed.
resource "aws_apigatewayv2_route" "wake_default" {
  api_id    = aws_apigatewayv2_api.wake.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.wake.id}"
}

resource "aws_apigatewayv2_stage" "wake_default" {
  api_id      = aws_apigatewayv2_api.wake.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.wake_access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      sourceIp       = "$context.identity.sourceIp"
      userAgent      = "$context.identity.userAgent"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }

  depends_on = [aws_api_gateway_account.this]
}

# Who's actually hitting the domain while the instance is stopped -- the wake
# Lambda itself doesn't log request metadata, so this is the only place that
# captures source IP / user-agent per hit. Same 14-day retention posture as
# the Lambda log groups.
resource "aws_cloudwatch_log_group" "wake_access" {
  name              = "/aws/apigateway/table-chess-wake-access"
  retention_in_days = 14
}

# Account-level setting (one per region, shared across all API Gateway APIs
# in this account) that lets API Gateway itself write to CloudWatch Logs --
# without it, access_log_settings above silently fails to deliver anything.
# Wasn't set at all prior to this (confirmed via `aws apigateway get-account`),
# so this is a net-new grant, not a change to an existing setting.
resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_cloudwatch.arn
}

resource "aws_iam_role" "apigateway_cloudwatch" {
  name = "table-chess-apigateway-cloudwatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apigateway_cloudwatch" {
  role       = aws_iam_role.apigateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_apigatewayv2_domain_name" "chess" {
  domain_name = "chess.basorelabs.dev"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.chess.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "chess" {
  api_id      = aws_apigatewayv2_api.wake.id
  domain_name = aws_apigatewayv2_domain_name.chess.id
  stage       = aws_apigatewayv2_stage.wake_default.id
}
