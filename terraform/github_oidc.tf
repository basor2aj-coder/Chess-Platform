# Lets the CI/CD deploy job (.github/workflows/ci-cd.yml) start the EC2
# instance before deploying, without putting long-lived AWS access keys in
# repo secrets. GitHub's OIDC provider thumbprint is fixed/well-known -- see
# https://github.blog/changelog/2023-06-27-github-actions-update-on-oidc-integration-with-aws/
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# Scoped to this one repo, main branch only -- matches the existing deploy
# job's `if: github.ref == 'refs/heads/main'` guard, so a PR run (or a push
# to any other branch) can never assume this role.
resource "aws_iam_role" "github_actions_deploy" {
  name = "table-chess-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:basor2aj-coder/Chess-Platform:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "start-and-describe-one-instance"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DescribeInstanceStatusRequiresWildcard"
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus"]
        Resource = "*"
      },
      {
        Sid      = "StartOneInstance"
        Effect   = "Allow"
        Action   = ["ec2:StartInstances"]
        Resource = aws_instance.table_chess.arn
      },
    ]
  })
}
