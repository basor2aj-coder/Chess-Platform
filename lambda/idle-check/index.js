'use strict';

// Runs on a fixed schedule (see terraform/lambda_idle_check.tf) regardless of
// whether the instance is up. Only stops it once /status has read zero
// active rooms for IDLE_THRESHOLD_CYCLES consecutive checks in a row -- a
// single blip (deploy in progress, a probe timeout) must never cost someone
// a live game.

const https = require('https');
const {
  EC2Client,
  DescribeInstancesCommand,
  StopInstancesCommand,
  CreateTagsCommand,
} = require('@aws-sdk/client-ec2');
const {
  Route53Client,
  ChangeResourceRecordSetsCommand,
} = require('@aws-sdk/client-route-53');

const {
  INSTANCE_ID,
  HOSTED_ZONE_ID,
  RECORD_NAME,
  APIGW_DOMAIN_TARGET,
  APIGW_DOMAIN_ZONE_ID,
} = process.env;
const APP_STATUS_PATH = process.env.APP_STATUS_PATH || '/status';
const IDLE_THRESHOLD_CYCLES = Number(process.env.IDLE_THRESHOLD_CYCLES || '5');

const ec2 = new EC2Client({});
const route53 = new Route53Client({});

function getIdleCycles(instance) {
  const tag = (instance.Tags || []).find((t) => t.Key === 'IdleCycles');
  const value = tag ? Number(tag.Value) : 0;
  return Number.isFinite(value) ? value : 0;
}

async function setIdleCycles(value) {
  await ec2.send(new CreateTagsCommand({
    Resources: [INSTANCE_ID],
    Tags: [{ Key: 'IdleCycles', Value: String(value) }],
  }));
}

function probeStatus(publicIp) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: publicIp,
        port: 443,
        path: APP_STATUS_PATH,
        method: 'GET',
        servername: RECORD_NAME,
        headers: { Host: RECORD_NAME },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve({ ok: false });
          try {
            const parsed = JSON.parse(body);
            resolve({ ok: true, activeRooms: parsed.activeRooms });
          } catch {
            resolve({ ok: false });
          }
        });
      },
    );
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

async function pointDnsAtApiGateway() {
  await route53.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: HOSTED_ZONE_ID,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: RECORD_NAME,
          Type: 'A',
          AliasTarget: {
            HostedZoneId: APIGW_DOMAIN_ZONE_ID,
            DNSName: APIGW_DOMAIN_TARGET,
            EvaluateTargetHealth: false,
          },
        },
      }],
    },
  }));
}

exports.handler = async () => {
  const described = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
  const instance = described.Reservations?.[0]?.Instances?.[0];
  const state = instance?.State?.Name;

  if (state !== 'running') {
    // Safety net for a manual/out-of-band stop (e.g. from the console): make
    // sure DNS still points somewhere that can wake the instance back up.
    if (state === 'stopped') await pointDnsAtApiGateway();
    return;
  }

  if (!instance.PublicIpAddress) return;

  const { ok, activeRooms } = await probeStatus(instance.PublicIpAddress);
  const idleCycles = getIdleCycles(instance);

  if (!ok) {
    // Inconclusive -- leave the counter untouched rather than guessing.
    return;
  }

  if (activeRooms > 0) {
    if (idleCycles !== 0) await setIdleCycles(0);
    return;
  }

  const nextIdleCycles = idleCycles + 1;
  if (nextIdleCycles >= IDLE_THRESHOLD_CYCLES) {
    await ec2.send(new StopInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
    await pointDnsAtApiGateway();
    await setIdleCycles(0);
  } else {
    await setIdleCycles(nextIdleCycles);
  }
};
