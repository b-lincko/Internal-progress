import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const domains = [
  { name: 'Access Control (AC)', short: 'AC' },
  { name: 'Awareness \u0026 Training (AT)', short: 'AT' },
  { name: 'Audit \u0026 Accountability (AU)', short: 'AU' },
  { name: 'Configuration Management (CM)', short: 'CM' },
  { name: 'Identification \u0026 Authentication (IA)', short: 'IA' },
  { name: 'Incident Response (IR)', short: 'IR' },
  { name: 'Maintenance (MA)', short: 'MA' },
  { name: 'Media Protection (MP)', short: 'MP' },
  { name: 'Personnel Security (PS)', short: 'PS' },
  { name: 'Physical Protection (PE)', short: 'PE' },
  { name: 'Risk Assessment (RA)', short: 'RA' },
  { name: 'Security Assessment (CA)', short: 'CA' },
  { name: 'System \u0026 Communications Protection (SC)', short: 'SC' },
  { name: 'System \u0026 Information Integrity (SI)', short: 'SI' }
]

const controlTemplates: Record<string, {id: string, title: string, desc: string}[]> = {
  AC: [
    { id: '3.1.1', title: 'Limit system access to authorized users', desc: 'Limit information system access to authorized users.' },
    { id: '3.1.2', title: 'Limit system access to types of transactions', desc: 'Limit information system access to the types of transactions that authorized users are permitted to execute.' },
    { id: '3.1.3', title: 'Control flow of CUI', desc: 'Control the flow of CUI in accordance with approved authorizations.' },
    { id: '3.1.4', title: 'Separation of duties', desc: 'Separate the duties of individuals to reduce the risk of malevolent activity without collusion.' },
    { id: '3.1.5', title: 'Least privilege', desc: 'Employ the principle of least privilege, allowing only authorized accesses necessary to accomplish assigned tasks.' },
    { id: '3.1.6', title: 'Non-privileged access for nonsecurity functions', desc: 'Use non-privileged accounts when performing nonsecurity functions.' },
    { id: '3.1.7', title: 'Prevent non-privileged users from executing privileged functions', desc: 'Prevent non-privileged users from executing privileged functions.' },
    { id: '3.1.8', title: 'Limit unsuccessful logon attempts', desc: 'Limit the number of unsuccessful logon attempts.' },
    { id: '3.1.9', title: 'Privacy and security notices', desc: 'Provide privacy and security notices consistent with applicable CUI rules.' },
    { id: '3.1.10', title: 'Use session lock', desc: 'Use session lock with pattern-hiding display to prevent access/viewing.' },
    { id: '3.1.11', title: 'Terminate sessions after inactivity', desc: 'Terminate sessions after a defined period of inactivity.' },
    { id: '3.1.12', title: 'Monitor and control remote access', desc: 'Monitor and control remote access sessions.' },
    { id: '3.1.13', title: 'Employ cryptographic mechanisms', desc: 'Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.' },
    { id: '3.1.14', title: 'Route remote access through managed points', desc: 'Route remote access via managed access control points.' },
    { id: '3.1.15', title: 'Authorize wireless access', desc: 'Authorize wireless access prior to allowing such connections.' },
    { id: '3.1.16', title: 'Protect wireless access', desc: 'Protect wireless access using authentication and encryption.' },
    { id: '3.1.17', title: 'Control mobile device access', desc: 'Control connection of mobile devices.' },
    { id: '3.1.18', title: 'Encrypt mobile device data', desc: 'Encrypt CUI on mobile devices.' },
    { id: '3.1.19', title: 'Restrict USB devices', desc: 'Restrict use of organization-defined portable storage devices.' },
    { id: '3.1.20', title: 'Limit external connections', desc: 'Limit external system connections.' },
    { id: '3.1.21', title: 'Control public information', desc: 'Control CUI posted on publicly accessible systems.' },
    { id: '3.1.22', title: 'Control CUI in shared resources', desc: 'Control CUI in shared system resources.' }
  ] as any[],
  AT: [
    { id: '3.2.1', title: 'Security awareness training', desc: 'Ensure that managers, system administrators, and users are aware of security risks.' },
    { id: '3.2.2', title: 'Insider threat training', desc: 'Provide insider threat awareness training.' },
    { id: '3.2.3', title: 'Role-based training', desc: 'Provide role-based security training.' }
  ] as any[],
  AU: [
    { id: '3.3.1', title: 'Create and retain audit logs', desc: 'Create and retain system audit logs.' },
    { id: '3.3.2', title: 'Ensure audit events are reviewed', desc: 'Ensure that the auditing system is reviewed.' },
    { id: '3.3.3', title: 'Protect audit information', desc: 'Protect audit information.' },
    { id: '3.3.4', title: 'Audit failure alerts', desc: 'Alert on audit processing failures.' },
    { id: '3.3.5', title: 'Correlate audit records', desc: 'Correlate audit record review, analysis, and reporting.' },
    { id: '3.3.6', title: 'Provide audit reduction', desc: 'Provide audit reduction and report generation.' },
    { id: '3.3.7', title: 'Time stamps', desc: 'Provide time stamps for audit records.' },
    { id: '3.3.8', title: 'Protection of audit info', desc: 'Protect audit information and tools.' },
    { id: '3.3.9', title: 'Manage audit storage capacity', desc: 'Manage audit storage capacity.' }
  ] as any[],
  CM: [
    { id: '3.4.1', title: 'Establish baseline configurations', desc: 'Establish baseline configurations.' },
    { id: '3.4.2', title: 'Enforce security config', desc: 'Establish and enforce security configuration settings.' },
    { id: '3.4.3', title: 'Track and review changes', desc: 'Track, review, and approve changes.' },
    { id: '3.4.4', title: 'Security impact analysis', desc: 'Analyze security impact of changes.' },
    { id: '3.4.5', title: 'Access restrictions for changes', desc: 'Define, document, and enforce access restrictions.' },
    { id: '3.4.6', title: 'Least functionality', desc: 'Employ least functionality by configuring systems to provide only essential capabilities.' },
    { id: '3.4.7', title: 'Nonessential functions', desc: 'Restrict nonessential programs, functions, ports, protocols, and services.' },
    { id: '3.4.8', title: 'Software usage restrictions', desc: 'Apply software usage restrictions for nonessential software.' },
    { id: '3.4.9', title: 'User-installed software', desc: 'Control user installation of software.' },
    { id: '3.4.10', title: 'Component inventory', desc: 'Create and maintain an inventory of system components.' },
    { id: '3.4.11', title: 'Memory protection', desc: 'Employ mechanisms to protect memory.' }
  ] as any[],
  IA: [
    { id: '3.5.1', title: 'Identify system users', desc: 'Identify system users, processes, and devices.' },
    { id: '3.5.2', title: 'Authenticate identities', desc: 'Authenticate identities of users, processes, and devices.' },
    { id: '3.5.3', title: 'Multi-factor authentication', desc: 'Use multi-factor authentication for local and network access.' },
    { id: '3.5.4', title: 'Replay-resistant auth', desc: 'Employ replay-resistant authentication mechanisms.' },
    { id: '3.5.5', title: 'Prevent identifier reuse', desc: 'Prevent reuse of identifiers for a defined period.' },
    { id: '3.5.6', title: 'Disable identifiers after inactivity', desc: 'Disable inactive identifiers after defined period.' },
    { id: '3.5.7', title: 'Password complexity', desc: 'Enforce minimum password complexity requirements.' },
    { id: '3.5.8', title: 'Password lifetime restrictions', desc: 'Prohibit password reuse for specified generations.' },
    { id: '3.5.9', title: 'Temporary passwords', desc: 'Allow temporary passwords with immediate change upon first login.' },
    { id: '3.5.10', title: 'Store passwords with encryption', desc: 'Store and transmit passwords with encryption.' },
    { id: '3.5.11', title: 'Obscure feedback of authentication', desc: 'Obscure feedback of authentication information.' }
  ] as any[],
  IR: [
    { id: '3.6.1', title: 'Incident response policy', desc: 'Establish an operational incident-handling capability.' },
    { id: '3.6.2', title: 'Track and document incidents', desc: 'Track, document, and report incidents.' },
    { id: '3.6.3', title: 'Test incident response', desc: 'Test the incident response capability.' }
  ] as any[],
  MA: [
    { id: '3.7.1', title: 'Perform maintenance', desc: 'Perform maintenance on organizational systems.' },
    { id: '3.7.2', title: 'Controlled maintenance', desc: 'Provide controls on the tools used for maintenance.' },
    { id: '3.7.3', title: 'Sanitize equipment', desc: 'Ensure equipment removed for off-site maintenance is sanitized.' },
    { id: '3.7.4', title: 'Maintenance personnel', desc: 'Supervise maintenance personnel.' },
    { id: '3.7.5', title: 'Nonlocal maintenance', desc: 'Restrict nonlocal maintenance sessions.' },
    { id: '3.7.6', title: 'Cryptographic protection for nonlocal maintenance', desc: 'Protect nonlocal maintenance via cryptographic mechanisms.' }
  ] as any[],
  MP: [
    { id: '3.8.1', title: 'Protect system media', desc: 'Protect system media containing CUI.' },
    { id: '3.8.2', title: 'Limit access to media', desc: 'Limit access to CUI on media to authorized users.' },
    { id: '3.8.3', title: 'Sanitize media', desc: 'Sanitize media prior to disposal or release.' },
    { id: '3.8.4', title: 'Mark media', desc: 'Mark media with necessary CUI markings and distribution limitations.' },
    { id: '3.8.5', title: 'Control media transport', desc: 'Control media transport in approved areas.' },
    { id: '3.8.6', title: 'Protect backups', desc: 'Protect system backups containing CUI.' },
    { id: '3.8.7', title: 'Restrict USB device usage', desc: 'Restrict USB device usage.' },
    { id: '3.8.8', title: 'Prohibit use of portable storage without approval', desc: 'Prohibit use of portable storage devices without explicit approval.' },
    { id: '3.8.9', title: 'Encrypt backups', desc: 'Encrypt system backup media containing CUI.' }
  ] as any[],
  PS: [
    { id: '3.9.1', title: 'Screen personnel', desc: 'Screen personnel prior to authorizing access.' },
    { id: '3.9.2', title: 'Ensure CUI protection during personnel actions', desc: 'Ensure CUI protections during personnel actions.' }
  ] as any[],
  PE: [
    { id: '3.10.1', title: 'Limit physical access', desc: 'Limit physical access to systems.' },
    { id: '3.10.2', title: 'Escort visitors', desc: 'Escort visitors and monitor visitor activity.' },
    { id: '3.10.3', title: 'Control access to physical devices', desc: 'Control physical access to devices.' },
    { id: '3.10.4', title: 'Monitor physical access', desc: 'Monitor physical access to facilities.' },
    { id: '3.10.5', title: 'Protect devices from tampering', desc: 'Protect devices from physical tampering.' },
    { id: '3.10.6', title: 'Secure work areas', desc: 'Secure work areas to protect CUI.' }
  ] as any[],
  RA: [
    { id: '3.11.1', title: 'Risk assessment policy', desc: 'Periodically assess the risk to organizational operations.' },
    { id: '3.11.2', title: 'Scan for vulnerabilities', desc: 'Scan for vulnerabilities in organizational systems and applications.' },
    { id: '3.11.3', title: 'Remediate vulnerabilities', desc: 'Remediate vulnerabilities in accordance with assessments.' },
    { id: '3.11.4', title: 'Threat intelligence', desc: 'Identify cyber supply chain risks.' }
  ] as any[],
  CA: [
    { id: '3.12.1', title: 'Security assessments', desc: 'Periodically assess the security controls.' },
    { id: '3.12.2', title: 'Develop plans', desc: 'Develop and implement plans for assessment.' },
    { id: '3.12.3', title: 'Monitor security controls', desc: 'Monitor security controls on an ongoing basis.' },
    { id: '3.12.4', title: 'Review and update plans', desc: 'Review and update assessment plans.' }
  ] as any[],
  SC: [
    { id: '3.13.1', title: 'Boundary protection', desc: 'Monitor and control communications at external boundaries.' },
    { id: '3.13.2', title: 'Deny network traffic by default', desc: 'Deny network traffic by default and allow by exception.' },
    { id: '3.13.3', title: 'Separate CUI from other data', desc: 'Separate CUI from other information.' },
    { id: '3.13.4', title: 'Prevent CUI from unauthorized release', desc: 'Prevent CUI from unauthorized release.' },
    { id: '3.13.5', title: 'Implement subnetworks', desc: 'Implement subnetworks for publicly accessible components.' },
    { id: '3.13.6', title: 'Deny direct public access', desc: 'Deny direct public access between internal and external networks.' },
    { id: '3.13.7', title: 'Prevent split tunneling', desc: 'Prevent split tunneling for remote devices.' },
    { id: '3.13.8', title: 'Encrypt CUI on public networks', desc: 'Encrypt CUI on public networks.' },
    { id: '3.13.9', title: 'Encrypt CUI at rest', desc: 'Encrypt CUI at rest on mobile devices and media.' },
    { id: '3.13.10', title: 'Encrypt remote access', desc: 'Encrypt remote access sessions.' },
    { id: '3.13.11', title: 'FIPS-validated cryptography', desc: 'Use FIPS-validated cryptography for CUI protection.' }
  ] as any[],
  SI: [
    { id: '3.14.1', title: 'Flaw remediation', desc: 'Identify, report, and correct system flaws.' },
    { id: '3.14.2', title: 'Malicious code protection', desc: 'Provide protection from malicious code.' },
    { id: '3.14.3', title: 'Monitor system alerts', desc: 'Monitor system alerts and advisories.' },
    { id: '3.14.4', title: 'Update malicious code protection', desc: 'Update malicious code protection mechanisms.' },
    { id: '3.14.5', title: 'System integrity verification', desc: 'Perform periodic scans of organizational systems.' },
    { id: '3.14.6', title: 'Monitor communications', desc: 'Monitor communications for unauthorized exfiltration.' },
    { id: '3.14.7', title: 'Identify unauthorized use', desc: 'Identify unauthorized use of systems.' }
  ] as any[]
}

async function main() {
  const hash = await bcrypt.hash('admin123', 10)
  
  await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@local',
      password_hash: hash,
      role: 'Admin'
    }
  })

  console.log('Created admin user: admin@local / admin123')

  let count = 0
  for (const domain of domains) {
    const templates = controlTemplates[domain.short] || []
    for (const t of templates) {
      await prisma.control.create({
        data: {
          control_id: t.id,
          domain: domain.name,
          title: t.title,
          description: t.desc,
          status: 'Not_Started'
        }
      })
      count++
    }
  }

  console.log(`Seeded ${count} controls across ${domains.length} domains`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
