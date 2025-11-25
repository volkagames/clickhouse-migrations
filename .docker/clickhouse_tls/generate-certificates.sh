#!/bin/bash

# ClickHouse TLS Certificate Generation Script
# This script generates a complete set of certificates for ClickHouse TLS setup

set -e

CERT_DIR="certificates"
DAYS_VALID=3650  # 10 years

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ClickHouse TLS Certificate Generator ===${NC}"

# Create certificates directory
mkdir -p "$CERT_DIR"

# Step 1: Generate CA (Certificate Authority)
echo -e "\n${YELLOW}Step 1: Generating CA (Certificate Authority)...${NC}"

# Generate CA private key
openssl ecparam -name secp384r1 -genkey -noout -out "$CERT_DIR/ca.key"

# Generate CA certificate
openssl req -new -x509 -sha384 -key "$CERT_DIR/ca.key" -out "$CERT_DIR/ca.crt" -days $DAYS_VALID \
  -subj "/C=US/ST=CA/O=ClickHouse Connect Test/CN=localhost"

echo -e "${GREEN}✓ CA certificate generated${NC}"

# Step 2: Generate Server Certificate
echo -e "\n${YELLOW}Step 2: Generating Server Certificate...${NC}"

# Generate server private key
openssl ecparam -name secp384r1 -genkey -noout -out "$CERT_DIR/server.key"

# Generate server CSR (Certificate Signing Request)
openssl req -new -sha384 -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
  -subj "/C=US/ST=CA/O=ClickHouse Connect Test/CN=localhost"

# Create server extension file for SAN (Subject Alternative Names)
cat > "$CERT_DIR/server.ext" <<EOF
subjectAltName = @alt_names
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
DNS.2 = clickhouse
DNS.3 = *.clickhouse.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Sign server certificate with CA
openssl x509 -req -sha384 -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/server.crt" -days $DAYS_VALID \
  -extfile "$CERT_DIR/server.ext"

echo -e "${GREEN}✓ Server certificate generated${NC}"

# Step 3: Generate Client Certificate
echo -e "\n${YELLOW}Step 3: Generating Client Certificate...${NC}"

# Generate client private key
openssl ecparam -name secp384r1 -genkey -noout -out "$CERT_DIR/client.key"

# Generate client CSR
openssl req -new -sha384 -key "$CERT_DIR/client.key" -out "$CERT_DIR/client.csr" \
  -subj "/C=US/ST=CA/O=ClickHouse Connect Test/CN=client"

# Create client extension file
cat > "$CERT_DIR/client.ext" <<EOF
extendedKeyUsage = clientAuth
EOF

# Sign client certificate with CA
openssl x509 -req -sha384 -in "$CERT_DIR/client.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/client.crt" -days $DAYS_VALID \
  -extfile "$CERT_DIR/client.ext"

echo -e "${GREEN}✓ Client certificate generated${NC}"

# Step 4: Cleanup temporary files
echo -e "\n${YELLOW}Step 4: Cleaning up temporary files...${NC}"
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.ext "$CERT_DIR"/*.srl

# Step 5: Set proper permissions
echo -e "\n${YELLOW}Step 5: Setting proper permissions...${NC}"
chmod 644 "$CERT_DIR"/*.crt
chmod 600 "$CERT_DIR"/*.key

# Step 6: Display certificate information
echo -e "\n${GREEN}=== Certificate Generation Complete ===${NC}"
echo -e "\nGenerated files:"
ls -lh "$CERT_DIR"

echo -e "\n${YELLOW}CA Certificate Details:${NC}"
openssl x509 -in "$CERT_DIR/ca.crt" -noout -subject -issuer -dates

echo -e "\n${YELLOW}Server Certificate Details:${NC}"
openssl x509 -in "$CERT_DIR/server.crt" -noout -subject -issuer -dates
echo "Subject Alternative Names:"
openssl x509 -in "$CERT_DIR/server.crt" -noout -text | grep -A 1 "Subject Alternative Name"

echo -e "\n${YELLOW}Client Certificate Details:${NC}"
openssl x509 -in "$CERT_DIR/client.crt" -noout -subject -issuer -dates

echo -e "\n${GREEN}Done! You can now use these certificates with ClickHouse.${NC}"
