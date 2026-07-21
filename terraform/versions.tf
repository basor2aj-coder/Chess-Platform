terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Zips the plain-Node Lambda source in lambda/wake and lambda/idle-check --
    # no build step, no npm install (the Lambda Node 20.x runtime ships the
    # AWS SDK v3 clients these use).
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
