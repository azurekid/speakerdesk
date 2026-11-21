using './main.bicep'

// Non-secret settings — edit freely.
param appName = 'speakerdesk'
param adminEmails = readEnvironmentVariable('SPEAKERDESK_ADMIN_EMAILS', '')
param publicUrl = readEnvironmentVariable('SPEAKERDESK_PUBLIC_URL', '')
param image = readEnvironmentVariable('SPEAKERDESK_IMAGE', '')
// JSON list, e.g. [{"name":"speakerdesk.eu","certificateName":"..."}]. Set the GitHub variable CUSTOM_DOMAINS.
param customDomains = json(readEnvironmentVariable('SPEAKERDESK_CUSTOM_DOMAINS', '[]'))

// Your verified email domain, e.g. speakerdesk.eu. Empty keeps the Azure-managed sender.
param customEmailDomain = readEnvironmentVariable('SPEAKERDESK_EMAIL_DOMAIN', '')
param deployApp = bool(readEnvironmentVariable('SPEAKERDESK_DEPLOY_APP', 'true'))

// Secrets come from environment variables so they never land in git.
param postgresAdminPassword = readEnvironmentVariable('SPEAKERDESK_PG_PASSWORD')
param betterAuthSecret = readEnvironmentVariable('SPEAKERDESK_AUTH_SECRET')

// Optional sign-in providers (leave the variables unset to disable).
param githubClientId = readEnvironmentVariable('SPEAKERDESK_GITHUB_CLIENT_ID', '')
param githubClientSecret = readEnvironmentVariable('SPEAKERDESK_GITHUB_CLIENT_SECRET', '')
param googleClientId = readEnvironmentVariable('SPEAKERDESK_GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('SPEAKERDESK_GOOGLE_CLIENT_SECRET', '')
param linkedinClientId = readEnvironmentVariable('SPEAKERDESK_LINKEDIN_CLIENT_ID', '')
param linkedinClientSecret = readEnvironmentVariable('SPEAKERDESK_LINKEDIN_CLIENT_SECRET', '')
param microsoftClientId = readEnvironmentVariable('SPEAKERDESK_MICROSOFT_CLIENT_ID', '')
param microsoftClientSecret = readEnvironmentVariable('SPEAKERDESK_MICROSOFT_CLIENT_SECRET', '')

// Optional wallet passes (leave unset to hide the "Add to Apple/Google Wallet" buttons).
param appleWalletPassTypeId = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_PASS_TYPE_ID', '')
param appleWalletTeamId = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_TEAM_ID', '')
param appleWalletCert = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_CERT', '')
param appleWalletKey = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_KEY', '')
param appleWalletKeyPassphrase = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_KEY_PASSPHRASE', '')
param appleWalletWwdrCert = readEnvironmentVariable('SPEAKERDESK_APPLE_WALLET_WWDR_CERT', '')
param googleWalletIssuerId = readEnvironmentVariable('SPEAKERDESK_GOOGLE_WALLET_ISSUER_ID', '')
param googleWalletServiceAccountEmail = readEnvironmentVariable('SPEAKERDESK_GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL', '')
param googleWalletPrivateKey = readEnvironmentVariable('SPEAKERDESK_GOOGLE_WALLET_PRIVATE_KEY', '')
