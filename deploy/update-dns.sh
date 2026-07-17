#!/bin/bash
# Run this from your own machine (not the EC2 box) after launching or
# restarting the table-chess instance. Since it doesn't hold a static
# Elastic IP (deliberately, to avoid paying for it while stopped), its
# public IP changes on every start -- this points chess.basorelabs.dev at
# whatever that IP currently is.
#
# Requires: AWS CLI v2 installed and configured (`aws configure`) with
# credentials that can describe EC2 instances and edit the Route 53 zone.
set -euo pipefail

DOMAIN="basorelabs.dev"
RECORD_NAME="chess.basorelabs.dev"
INSTANCE_NAME_TAG="table-chess"

INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME_TAG" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" == "None" ]; then
  echo "No running instance found tagged Name=$INSTANCE_NAME_TAG" >&2
  exit 1
fi

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text)

if [ -z "$PUBLIC_IP" ] || [ "$PUBLIC_IP" == "None" ]; then
  echo "Instance $INSTANCE_ID has no public IP yet -- still booting?" >&2
  exit 1
fi

HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$DOMAIN" \
  --query "HostedZones[0].Id" \
  --output text | sed 's|/hostedzone/||')

echo "Instance:    $INSTANCE_ID"
echo "Public IP:   $PUBLIC_IP"
echo "Hosted zone: $HOSTED_ZONE_ID"

CHANGE_BATCH=$(cat <<JSON
{
  "Comment": "Point $RECORD_NAME at the current table-chess instance",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$RECORD_NAME",
      "Type": "A",
      "TTL": 300,
      "ResourceRecords": [{"Value": "$PUBLIC_IP"}]
    }
  }]
}
JSON
)

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "$CHANGE_BATCH" > /dev/null

echo "Done: $RECORD_NAME -> $PUBLIC_IP"
