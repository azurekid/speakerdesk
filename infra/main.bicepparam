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
param githubClientId = readEnvironmentVariable('SPEAKERDESK_GITHUB_CLIENT_ID', '')
param githubClientSecret = readEnvironmentVariable('SPEAKERDESK_GITHUB_CLIENT_SECRET', '')
param googleClientId = readEnvironmentVariable('SPEAKERDESK_GOOGLE_CLIENT_ID', '')
param googleClientSecret = readEnvironmentVariable('SPEAKERDESK_GOOGLE_CLIENT_SECRET', '')
param linkedinClientId = readEnvironmentVariable('SPEAKERDESK_LINKEDIN_CLIENT_ID', '')
param linkedinClientSecret = readEnvironmentVariable('SPEAKERDESK_LINKEDIN_CLIENT_SECRET', '')
param microsoftClientId = readEnvironmentVariable('SPEAKERDESK_MICROSOFT_CLIENT_ID', '')
param microsoftClientSecret = readEnvironmentVariable('SPEAKERDESK_MICROSOFT_CLIENT_SECRET', '')
