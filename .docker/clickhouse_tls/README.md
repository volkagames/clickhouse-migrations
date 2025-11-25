# ClickHouse TLS Certificates

Self-signed TLS/SSL certificates for ClickHouse development and testing.

## Quick Start

Generate certificates and start ClickHouse:

```bash
./generate-certificates.sh
docker-compose up -d
```

Test connection:

```bash
curl --cacert certificates/ca.crt https://localhost:8443
```

## What's Generated

| Certificate | Purpose | Validity | Algorithm |
|------------|---------|----------|-----------|
| `ca.crt/key` | Certificate Authority | 10 years | ECDSA secp384r1 |
| `server.crt/key` | ClickHouse TLS | 10 years | ECDSA secp384r1 |
| `client.crt/key` | Mutual TLS (optional) | 10 years | ECDSA secp384r1 |

**Server SAN:** localhost, clickhouse, *.clickhouse.local, 127.0.0.1, ::1

## Configuration

Pre-configured in [ssl-config.xml](ssl-config.xml):

- **HTTPS Port:** 8443
- **Native TLS Port:** 9440
- **Verification Mode:** relaxed (verifies client certs if provided, doesn't require them)

Verification modes: `none` | `relaxed` | `strict`

## Testing

```bash
# HTTPS endpoint
curl --cacert certificates/ca.crt https://localhost:8443

# With client certificate
curl --cacert certificates/ca.crt \
     --cert certificates/client.crt \
     --key certificates/client.key \
     https://localhost:8443

# Native protocol
openssl s_client -connect localhost:9440 -CAfile certificates/ca.crt
clickhouse-client --host localhost --port 9440 --secure
```

## Using in Code

**Node.js:**
```typescript
import { createClient } from '@clickhouse/client'
import fs from 'fs'

const client = createClient({
  host: 'https://localhost:8443',
  tls: {
    ca_cert: fs.readFileSync('./certificates/ca.crt'),
    cert: fs.readFileSync('./certificates/client.crt'),
    key: fs.readFileSync('./certificates/client.key'),
  }
})
```

## Customization

Edit [generate-certificates.sh](generate-certificates.sh) to customize:

- **Domains/IPs:** Modify `server.ext` section
- **Validity:** Change `DAYS_VALID` variable
- **Organization:** Update `-subj` parameters

Then regenerate:

```bash
rm certificates/*.{crt,key}
./generate-certificates.sh
```

## Verification

```bash
# Verify certificates
openssl verify -CAfile certificates/ca.crt certificates/server.crt

# Check expiration
openssl x509 -in certificates/server.crt -noout -dates

# View certificate details
openssl x509 -in certificates/server.crt -noout -text
```

## Troubleshooting

**ClickHouse won't start:**
```bash
docker logs clickhouse
docker exec clickhouse ls -la /etc/clickhouse-server/certs/
```

**Connection refused:**
```bash
docker exec clickhouse ss -tuln | grep -E "8443|9440"
nc -zv localhost 8443
```

**Certificate expired:**
```bash
rm certificates/*.{crt,key}
./generate-certificates.sh
docker-compose restart clickhouse
```

**TLS handshake failed:**
```bash
openssl s_client -connect localhost:9440 -CAfile certificates/ca.crt -showcerts
```

## Security Notes

⚠️ **For development only.** Production should use trusted CA certificates.

- Private keys (`*.key`) are gitignored—never commit or share them
- File permissions: `chmod 644 *.crt` and `chmod 600 *.key`
- Production: Use Let's Encrypt, enable strict verification, rotate regularly

## File Permissions

```bash
chmod 644 certificates/*.crt  # Public certificates
chmod 600 certificates/*.key  # Private keys (owner only)
```

## Structure

```
clickhouse_tls/
├── certificates/              # Generated (gitignored)
│   ├── ca.crt/key            # Certificate Authority
│   ├── server.crt/key        # ClickHouse server
│   └── client.crt/key        # Client authentication
├── generate-certificates.sh  # Generation script
├── ssl-config.xml            # ClickHouse TLS config
└── README.md                 # This file
```
