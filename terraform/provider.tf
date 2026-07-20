# Credentials come from the standard AWS CLI chain (~/.aws/credentials),
# same as `aws` commands run from this machine -- nothing extra to configure.
provider "aws" {
  region = "us-east-1"
}
