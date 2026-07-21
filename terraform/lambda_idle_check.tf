# Polls the app's own /status endpoint on a fixed cadence and stops the
# instance once it's read zero active rooms for IDLE_THRESHOLD_CYCLES checks
# in a row. Source lives in ../lambda/idle-check.
data "archive_file" "idle_check" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/idle-check"
  output_path = "${path.module}/build/idle-check.zip"
}

resource "aws_lambda_function" "idle_check" {
  function_name = "table-chess-idle-check"
  role          = aws_iam_role.chess_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 10

  filename         = data.archive_file.idle_check.output_path
  source_code_hash = data.archive_file.idle_check.output_base64sha256

  environment {
    variables = {
      INSTANCE_ID     = aws_instance.table_chess.id
      HOSTED_ZONE_ID  = data.aws_route53_zone.basorelabs.zone_id
      RECORD_NAME     = "chess.basorelabs.dev"
      APP_STATUS_PATH = "/status"
      # 5 checks x the 5-minute schedule below = 25 minutes of confirmed zero
      # activity before stopping -- long enough that a lull between games
      # doesn't trigger a shutdown, short enough to actually save money.
      IDLE_THRESHOLD_CYCLES = "5"
      APIGW_DOMAIN_TARGET   = aws_apigatewayv2_domain_name.chess.domain_name_configuration[0].target_domain_name
      APIGW_DOMAIN_ZONE_ID  = aws_apigatewayv2_domain_name.chess.domain_name_configuration[0].hosted_zone_id
    }
  }
}

resource "aws_cloudwatch_log_group" "idle_check" {
  name              = "/aws/lambda/${aws_lambda_function.idle_check.function_name}"
  retention_in_days = 14
}

# EventBridge Scheduler invokes the Lambda Invoke API directly using this
# role's credentials -- unlike API Gateway (lambda_wake.tf), that's a plain
# IAM-authorized call, so no resource-based aws_lambda_permission is needed
# here.
resource "aws_iam_role" "scheduler" {
  name = "table-chess-idle-check-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_idle_check" {
  name = "invoke-idle-check-lambda"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.idle_check.arn
    }]
  })
}

# Started out DISABLED on purpose -- see the rollout plan. Flipped to
# ENABLED only after the wake/idle Lambdas were sanity-checked directly
# (aws lambda invoke), the DNS ownership split in dns.tf was confirmed to
# behave as expected, and /status was confirmed live on the real instance.
resource "aws_scheduler_schedule" "idle_check" {
  name       = "table-chess-idle-check"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(5 minutes)"
  state               = "ENABLED"

  target {
    arn      = aws_lambda_function.idle_check.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
