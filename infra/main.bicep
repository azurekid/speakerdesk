// SpeakerDesk on Azure — everything the app needs in one resource group.
//
//   az deployment group create -g <rg> -f infra/main.bicep -p infra/main.bicepparam
//
// See docs/deploy-azure.md for the full walkthrough.

targetScope = 'resourceGroup'

@description('Short name used as a prefix for every resource (lowercase letters and digits).')
@minLength(3)
@maxLength(12)
param appName string = 'speakerdesk'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Deploy the container app. Use false on the very first run (before an image exists), then true.')
param deployApp bool = true

@description('Container image to run, e.g. myregistry.azurecr.io/speakerdesk:abc123. Required when deployApp is true.')
param image string = ''

@description('Public URL of the app, e.g. https://speakerdesk.example.com. Leave empty on the first deployment to use the Container Apps URL.')
param publicUrl string = ''

@description('PostgreSQL administrator login.')
param postgresAdminLogin string = 'speakerdesk'

@secure()
@description('PostgreSQL administrator password.')
param postgresAdminPassword string

@secure()
@description('Random 32+ byte secret for Better Auth (openssl rand -base64 32).')
param betterAuthSecret string

@description('Comma-separated emails that become platform admins on sign-up.')
param adminEmails string = ''

@description('Allow email + password sign-in in production (passcode sign-in is always on).')
param allowEmailPassword bool = true

@description('Optional OAuth client ids/secrets. Providers without both values stay disabled.')
param githubClientId string = ''
@secure()
param githubClientSecret string = ''
param googleClientId string = ''
@secure()
param googleClientSecret string = ''
param linkedinClientId string = ''
@secure()
param linkedinClientSecret string = ''
param microsoftClientId string = ''
@secure()
param microsoftClientSecret string = ''

@description('Minimum replicas. Keep 1 so the first request after idle is not a cold start.')
@minValue(0)
param minReplicas int = 1

@description('Maximum replicas.')
param maxReplicas int = 5

var suffix = uniqueString(resourceGroup().id)
var names = {
  logs: '${appName}-logs'
  identity: '${appName}-id'
  registry: take(replace('${appName}acr${suffix}', '-', ''), 50)
  postgres: '${appName}-pg-${suffix}'
  storage: take(replace('${appName}st${suffix}', '-', ''), 24)
  maps: '${appName}-maps'
  email: '${appName}-email'
  acs: '${appName}-acs-${suffix}'
  environment: '${appName}-env'
  app: appName
}

// ─── Monitoring ──────────────────────────────────────────────────────────────

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: names.logs
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ─── Identity + registry (the app pulls images with its managed identity) ────

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: names.identity
  location: location
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  #disable-next-line BCP334 // appName has a minimum length, so the name is never too short
  name: names.registry
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, identity.id, acrPullRoleId)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// ─── PostgreSQL ──────────────────────────────────────────────────────────────

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: names.postgres
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'speakerdesk'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// 0.0.0.0 = "allow Azure services". The app reaches the database over Azure's network.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ─── Blob storage for headshots ──────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  #disable-next-line BCP334 // appName has a minimum length, so the name is never too short
  name: names.storage
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: true // headshots are public by design: their URLs are pasted into CfPs
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource headshots 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'headshots'
  properties: { publicAccess: 'Blob' }
}

// ─── Azure Maps (venue search) ───────────────────────────────────────────────

resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: names.maps
  location: 'global'
  sku: { name: 'G2' }
  kind: 'Gen2'
  properties: { disableLocalAuth: false }
}

// ─── Email (passcodes, verification, resets) ─────────────────────────────────

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: names.email
  location: 'global'
  properties: { dataLocation: 'Europe' }
}

// Azure-managed sender domain (xxxx.azurecomm.net). Swap for a custom domain later — see the guide.
resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: names.acs
  location: 'global'
  properties: {
    dataLocation: 'Europe'
    linkedDomains: [emailDomain.id]
  }
}

// ─── Container Apps ──────────────────────────────────────────────────────────

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: names.environment
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var defaultUrl = 'https://${names.app}.${containerEnv.properties.defaultDomain}'
var appUrl = startsWith(publicUrl, 'http') ? publicUrl : defaultUrl // anything else (empty, stray quotes) falls back to the default URL
var databaseUrl = 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${database.name}?sslmode=require'
var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

var oauth = [
  { id: 'github', clientId: githubClientId, secret: githubClientSecret, envId: 'GITHUB_CLIENT_ID', envSecret: 'GITHUB_CLIENT_SECRET' }
  { id: 'google', clientId: googleClientId, secret: googleClientSecret, envId: 'GOOGLE_CLIENT_ID', envSecret: 'GOOGLE_CLIENT_SECRET' }
  { id: 'linkedin', clientId: linkedinClientId, secret: linkedinClientSecret, envId: 'LINKEDIN_CLIENT_ID', envSecret: 'LINKEDIN_CLIENT_SECRET' }
  { id: 'microsoft', clientId: microsoftClientId, secret: microsoftClientSecret, envId: 'MICROSOFT_CLIENT_ID', envSecret: 'MICROSOFT_CLIENT_SECRET' }
]
var enabledOauth = filter(oauth, p => !empty(p.clientId) && !empty(p.secret))

resource app 'Microsoft.App/containerApps@2024-03-01' = if (deployApp) {
  name: names.app
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [acrPull]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      secrets: concat([
        { name: 'database-url', value: databaseUrl }
        { name: 'better-auth-secret', value: betterAuthSecret }
        { name: 'storage-connection', value: storageConnection }
        { name: 'maps-key', value: maps.listKeys().primaryKey }
        { name: 'acs-connection', value: communication.listKeys().primaryConnectionString }
      ], map(enabledOauth, p => { name: '${p.id}-client-secret', value: p.secret }))
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'BETTER_AUTH_SECRET', secretRef: 'better-auth-secret' }
            { name: 'BETTER_AUTH_URL', value: appUrl }
            { name: 'AUTH_EMAIL_PASSWORD', value: toLower(string(allowEmailPassword)) }
            { name: 'ADMIN_EMAILS', value: adminEmails }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'storage-connection' }
            { name: 'AZURE_STORAGE_CONTAINER', value: headshots.name }
            { name: 'AZURE_MAPS_KEY', secretRef: 'maps-key' }
            { name: 'AZURE_COMMUNICATION_CONNECTION_STRING', secretRef: 'acs-connection' }
            { name: 'EMAIL_FROM', value: 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}' }
          ], flatten(map(enabledOauth, p => [
            { name: p.envId, value: p.clientId }
            { name: p.envSecret, secretRef: '${p.id}-client-secret' }
          ])))
          probes: [
            { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 30 }
            { type: 'Readiness', httpGet: { path: '/api/health?deep=1', port: 3000 }, periodSeconds: 15, failureThreshold: 3 }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [{ name: 'http', http: { metadata: { concurrentRequests: '50' } } }]
      }
    }
  }
}

output appUrl string = appUrl
output defaultUrl string = defaultUrl
output registryLoginServer string = registry.properties.loginServer
output registryName string = registry.name
output containerAppName string = names.app
output postgresServerName string = postgres.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output emailFrom string = 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
