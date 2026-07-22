# Set via terraform/wake_secret.auto.tfvars (gitignored, see .gitignore's
# terraform/*.tfvars entry) -- never committed, generated once with
# `openssl rand -hex 32`.
variable "wake_secret" {
  description = "Query-string key that authorizes the wake Lambda (lambda_wake.tf) to actually start the EC2 instance while it's stopped. Without it, requests just see the offline page -- keeps internet background scanners from being the ones to spin the box up."
  type        = string
  sensitive   = true
}
