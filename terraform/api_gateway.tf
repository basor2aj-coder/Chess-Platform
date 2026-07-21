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
