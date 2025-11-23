import * as path from 'node:path';

/**
 * Get paths to TLS certificate fixtures
 */
export function getTLSCertificatePaths() {
  const certFixturesPath = path.join(__dirname, '..', '..', '.docker', 'clickhouse_tls', 'certificates');

  return {
    certFixturesPath,
    caCertPath: path.join(certFixturesPath, 'ca.crt'),
    clientCertPath: path.join(certFixturesPath, 'client.crt'),
    clientKeyPath: path.join(certFixturesPath, 'client.key'),
  };
}
