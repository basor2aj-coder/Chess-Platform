# The "front door" Lambda that sits behind API Gateway (api_gateway.tf) only
# while the instance is stopped -- see the DNS ownership split explained at
# the top of dns.tf. Source lives in ../lambda/wake; no build step, plain
# CommonJS, zipped by Terraform itself via the archive provider.
data "archive_file" "wake" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/wake"
  output_path = "${path.module}/build/wake.zip"
}

resource "aws_lambda_function" "wake" {
  function_name = "table-chess-wake"
  role          = aws_iam_role.chess_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10

  filename         = data.archive_file.wake.output_path
  source_code_hash = data.archive_file.wake.output_base64sha256

  environment {
    variables = {
      INSTANCE_ID    = aws_instance.table_chess.id
      HOSTED_ZONE_ID = data.aws_route53_zone.basorelabs.zone_id
      RECORD_NAME    = "chess.basorelabs.dev"
    }
  }
}

# Created explicitly (rather than left to Lambda's default 30-day/Never
# retention) to match the cost-conscious posture used elsewhere in this repo
# (e.g. state_backend.tf's lifecycle rule) -- these logs have no long-term
# value.
resource "aws_cloudwatch_log_group" "wake" {
  name              = "/aws/lambda/${aws_lambda_function.wake.function_name}"
  retention_in_days = 14
}

resource "aws_lambda_permission" "apigw_invoke_wake" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.wake.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.wake.execution_arn}/*/*"
}
