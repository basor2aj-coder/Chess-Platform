'use strict';

// API Gateway sits in front of this Lambda only while the EC2 instance is
// stopped (see terraform/dns.tf for the DNS ownership split). Every request
// here means someone just tried to visit chess.basorelabs.dev while it was
// asleep -- but a plain GET / used to be enough to actually start the box,
// which internet background scanners do constantly (found via CloudWatch
// access logs after the idle-check/wake-up work shipped -- non-residential
// IPs, spoofed/ancient user-agents, one hit per scan, round the clock).
// Only a request carrying the WAKE_SECRET query key is allowed to trigger a
// real start now; everything else just sees the offline page. Once a start
// *has* been authorized, the instance transitions through 'pending' on its
// own, and every request (keyed or not) is shown the waking-up holding page
// until it's healthy, at which point DNS flips back to it directly and this
// Lambda drops out of the request path again.

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  CreateTagsCommand,
} = require('@aws-sdk/client-ec2');
const {
  Route53Client,
  ChangeResourceRecordSetsCommand,
} = require('@aws-sdk/client-route-53');

const {
  INSTANCE_ID, HOSTED_ZONE_ID, RECORD_NAME, WAKE_SECRET,
} = process.env;

const ec2 = new EC2Client({});
const route53 = new Route53Client({});

const holdingPage = fs.readFileSync(path.join(__dirname, 'holding-page.html'), 'utf8');
const offlinePage = fs.readFileSync(path.join(__dirname, 'offline-page.html'), 'utf8');

function htmlResponse(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Best-effort nudge for HTTP/1.1 clients to open a fresh connection
      // (and re-resolve DNS) on their next request instead of reusing this
      // one -- ignored under HTTP/2, which has no hop-by-hop Connection
      // header, so this doesn't fully solve browser keep-alive pooling
      // outliving a DNS flip, but it's free and helps where it applies.
      Connection: 'close',
    },
    body,
  };
}

// Constant-time compare so a scanner can't narrow down the secret by timing
// how fast a near-miss is rejected.
function hasValidKey(event) {
  const provided = event?.queryStringParameters?.key;
  if (!provided) return false;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(WAKE_SECRET);
  return providedBuf.length === expectedBuf.length
    && crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// Connects by IP (the instance has no stable hostname of its own) but sends
// SNI + a Host header matching the real domain, since Caddy routes and
// terminates TLS by hostname, not by which IP the socket landed on.
function probeHealthz(publicIp) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: publicIp,
        port: 443,
        path: '/healthz',
        method: 'GET',
        servername: RECORD_NAME,
        headers: { Host: RECORD_NAME },
        timeout: 3000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function pointDnsAtInstance(publicIp) {
  await route53.send(new ChangeResourceRecordSetsCommand({
    HostedZoneId: HOSTED_ZONE_ID,
    ChangeBatch: {
      Changes: [{
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: RECORD_NAME,
          Type: 'A',
          TTL: 60,
          ResourceRecords: [{ Value: publicIp }],
        },
      }],
    },
  }));
}

exports.handler = async (event) => {
  const described = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
  const instance = described.Reservations?.[0]?.Instances?.[0];
  const state = instance?.State?.Name;

  if (state === 'stopped') {
    if (!hasValidKey(event)) return htmlResponse(offlinePage);

    await ec2.send(new StartInstancesCommand({ InstanceIds: [INSTANCE_ID] }));
    // Give a freshly-woken instance a full new idle grace period rather than
    // resuming near whatever count it was stopped at.
    await ec2.send(new CreateTagsCommand({
      Resources: [INSTANCE_ID],
      Tags: [{ Key: 'IdleCycles', Value: '0' }],
    }));
  } else if (state === 'running' && instance.PublicIpAddress) {
    const healthy = await probeHealthz(instance.PublicIpAddress);
    if (healthy) {
      await pointDnsAtInstance(instance.PublicIpAddress);
    }
  }
  // 'pending' and 'stopping' -- nothing actionable, just show the holding
  // page; no key required here since a start already had to be authorized to
  // reach either of those states.

  return htmlResponse(holdingPage);
};
