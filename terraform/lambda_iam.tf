# Shared execution role for both the wake-up Lambda (lambda_wake.tf) and the
# idle-check Lambda (lambda_idle_check.tf) -- their permission needs are
# identical, so one role keeps this from being duplicated twice.
resource "aws_iam_role" "chess_lambda" {
  name = "table-chess-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Standard CloudWatch Logs write permissions for a Lambda function.
resource "aws_iam_role_policy_attachment" "chess_lambda_basic_execution" {
  role       = aws_iam_role.chess_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ec2:DescribeInstances has no resource-level permission support -- AWS
# requires Resource = "*" for it regardless of how narrow the intent is, so
# that one statement can't be scoped down further. Every other action here
# is scoped to the single table-chess instance and the single basorelabs.dev
# hosted zone.
resource "aws_iam_role_policy" "chess_lambda" {
  name = "table-chess-lambda-ec2-route53"
  role = aws_iam_role.chess_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeInstancesRequiresWildcard"
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances"]
        Resource = "*"
      },
      {
        Sid    = "StartStopTagOneInstance"
        Effect = "Allow"
        Action = [
          "ec2:StartInstances",
          "ec2:StopInstances",
          "ec2:CreateTags",
        ]
        Resource = aws_instance.table_chess.arn
      },
      {
        Sid    = "UpdateOneHostedZone"
        Effect = "Allow"
        Action = [
          "route53:ChangeResourceRecordSets",
          "route53:ListResourceRecordSets",
        ]
        Resource = "arn:aws:route53:::hostedzone/${data.aws_route53_zone.basorelabs.zone_id}"
      },
    ]
  })
}
