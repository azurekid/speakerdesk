using './main.bicep'

// Non-secret settings — edit freely.
param appName = 'speakerdesk'
param adminEmails = readEnvironmentVariable('SPEAKERDESK_ADMIN_EMAILS', '')
param publicUrl = readEnvironmentVariable('SPEAKERDESK_PUBLIC_URL', '')
param image = readEnvironmentVariable('SPEAKERDESK_IMAGE', '')
param deployApp = bool(readEnvironmentVariable('SPEAKERDESK_DEPLOY_APP', 'true'))

// Secrets come from environment variables so they never land in git.
param postgresAdminPassword = readEnvironmentVariable('SPEAKERDESK_PG_PASSWORD')
param betterAuthSecret = readEnvironmentVariable('SPEAKERDESK_AUTH_SECRET')

// Optional sign-in providers (leave the variables unset to disable).
param githubClientId = readEnvironmentVariable('GITHUB_CLIENT_ID', '')
param githubClientSecret = readEnvironmentVariable('GITHUB_CLIENT_SECRET', '')
param googleClientId = readEnvironmentVariable('GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('GOOGLE_CLIENT_SECRET', '')
param linkedinClientId = readEnvironmentVariable('LINKEDIN_CLIENT_ID', '')
param linkedinClientSecret = readEnvironmentVariable('LINKEDIN_CLIENT_SECRET', '')
param microsoftClientId = readEnvironmentVariable('MICROSOFT_CLIENT_ID', '')
param microsoftClientSecret = readEnvironmentVariable('MICROSOFT_CLIENT_SECRET', '')
