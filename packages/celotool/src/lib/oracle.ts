import { DynamicEnvVar, fetchEnv, envVar } from 'src/lib/env-utils'
import { getCloudProviderFromContext, getContextDynamicEnvVarValues } from './context-utils'
import { CloudProvider, BaseClusterManager } from './k8s-cluster/base'
import { AksHsmOracleDeployer, AksHsmOracleDeploymentConfig, AksHsmOracleIdentity } from './k8s-oracle/aks-hsm'
import { BaseOracleDeployer } from './k8s-oracle/base'
import { AwsHsmOracleDeployer, AwsHsmOracleDeploymentConfig, AwsHsmOracleIdentity } from './k8s-oracle/aws-hsm'
import { AwsClusterConfig } from './k8s-cluster/aws'
import { AKSClusterConfig } from './k8s-cluster/aks'
import { AccountType, getPrivateKeysFor, privateKeyToAddress } from './generate_utils'
import { PrivateKeyOracleIdentity, PrivateKeyOracleDeploymentConfig, PrivateKeyOracleDeployer } from './k8s-oracle/pkey'
import { ensureLeading0x } from '@celo/utils/src/address'

/**
 * Maps each cloud provider to the correct function to get the appropriate
 * HSM-based oracle deployer.
 */
const hsmOracleDeployerGetterByCloudProvider: {
  [key in CloudProvider]?: (celoEnv: string, context: string, useForno: boolean, clusterManager: BaseClusterManager) => BaseOracleDeployer
} = {
  [CloudProvider.AWS]: getAwsHsmOracleDeployer,
  [CloudProvider.AZURE]: getAksHsmOracleDeployer,
}

/**
 * Gets the appropriate oracle deployer for the given context. If the env vars
 * specify that the oracle addresses should be generated from the mnemonic,
 * then the cloud-provider agnostic deployer PrivateKeyOracleDeployer is used.
 */
export function getOracleDeployerForContext(celoEnv: string, context: string, useForno: boolean, clusterManager: BaseClusterManager) {
  // If the mnemonic-based oracle address env var has a value, we should be using
  // the private key oracle deployer
  const { addressesFromMnemonicCount } = getContextDynamicEnvVarValues(
    mnemonicBasedOracleIdentityConfigDynamicEnvVars,
    context,
    {
      addressesFromMnemonicCount: '',
    }
  )
  if (addressesFromMnemonicCount) {
    const addressesFromMnemonicCountNum = parseInt(addressesFromMnemonicCount, 10)
    // This is a cloud-provider agnostic deployer because it doesn't rely
    // on cloud-specific HSMs
    return getPrivateKeyOracleDeployer(celoEnv, context, useForno, addressesFromMnemonicCountNum)
  }
  // If we've gotten this far, we should be using an HSM-based oracle deployer
  const cloudProvider: CloudProvider = getCloudProviderFromContext(context)
  return hsmOracleDeployerGetterByCloudProvider[cloudProvider]!(celoEnv, context, useForno, clusterManager)
}

/**
 * ----------- AksHsmOracleDeployer helpers -----------
 */

/**
 * Gets an AksHsmOracleDeployer by looking at env var values
 */
function getAksHsmOracleDeployer(celoEnv: string, context: string, useForno: boolean, clusterManager: BaseClusterManager) {
  const { addressKeyVaults } = getContextDynamicEnvVarValues(
    aksHsmOracleIdentityConfigDynamicEnvVars,
    context,
    {
      addressKeyVaults: '',
    }
  )
  const identities = getAksHsmOracleIdentities(addressKeyVaults)
  const deploymentConfig: AksHsmOracleDeploymentConfig = {
    context,
    clusterConfig: clusterManager.clusterConfig as AKSClusterConfig,
    identities,
    useForno,
  }
  return new AksHsmOracleDeployer(deploymentConfig, celoEnv)
}

/**
 * Given a string addressAzureKeyVaults containing comma separated info of the form:
 * <address>:<keyVaultName>:<resourceGroup (optional)>
 * eg: 0x0000000000000000000000000000000000000000:keyVault0,0x0000000000000000000000000000000000000001:keyVault1:resourceGroup1
 * returns an array of AksHsmOracleIdentity in the same order
 */
export function getAksHsmOracleIdentities(addressAzureKeyVaults: string): AksHsmOracleIdentity[] {
  const identityStrings = addressAzureKeyVaults.split(',')
  const identities = []
  for (const identityStr of identityStrings) {
    const [address, keyVaultName, resourceGroup] = identityStr.split(':')
    // resourceGroup can be undefined
    if (!address || !keyVaultName) {
      throw Error(
        `Address or key vault name is invalid. Address: ${address} Key Vault Name: ${keyVaultName}`
      )
    }
    identities.push({
      address,
      identityName: getOracleAzureIdentityName(keyVaultName, address),
      keyVaultName,
      resourceGroup
    })
  }
  return identities
}

/**
 * @return the intended name of an azure identity given a key vault name and address
 */
function getOracleAzureIdentityName(keyVaultName: string, address: string) {
  // from https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules#microsoftmanagedidentity
  const maxIdentityNameLength = 128
  return `${keyVaultName}-${address}`.substring(0, maxIdentityNameLength)
}

/**
 * Config values pulled from env vars used for generating an AksHsmOracleIdentity
 */
interface AksHsmOracleIdentityConfig {
  addressKeyVaults: string
}

/**
 * Env vars corresponding to each value for the AksHsmOracleIdentityConfig for a particular context
 */
const aksHsmOracleIdentityConfigDynamicEnvVars: { [k in keyof AksHsmOracleIdentityConfig]: DynamicEnvVar } = {
  addressKeyVaults: DynamicEnvVar.ORACLE_ADDRESS_AZURE_KEY_VAULTS,
}

/**
 * ----------- AwsHsmOracleDeployer helpers -----------
 */

/**
 * Gets an AwsHsmOracleDeployer by looking at env var values
 */
function getAwsHsmOracleDeployer(celoEnv: string, context: string, useForno: boolean, clusterManager: BaseClusterManager) {
  const { addressKeyAliases } = getContextDynamicEnvVarValues(
    awsHsmOracleIdentityConfigDynamicEnvVars,
    context,
    {
      addressKeyAliases: '',
    }
  )

  const identities = getAwsHsmOracleIdentities(addressKeyAliases)
  const deploymentConfig: AwsHsmOracleDeploymentConfig = {
    context,
    identities,
    useForno,
    clusterConfig: clusterManager.clusterConfig as AwsClusterConfig
  }
  return new AwsHsmOracleDeployer(deploymentConfig, celoEnv)
}

/**
 * Given a string addressKeyAliases containing comma separated info of the form:
 * <address>:<keyAlias>:<region (optional)>
 * eg: 0x0000000000000000000000000000000000000000:keyAlias0,0x0000000000000000000000000000000000000001:keyAlias1:region1
 * returns an array of AwsHsmOracleIdentity in the same order
 */
export function getAwsHsmOracleIdentities(addressKeyAliases: string): AwsHsmOracleIdentity[] {
  const identityStrings = addressKeyAliases.split(',')
  const identities = []
  for (const identityStr of identityStrings) {
    const [address, keyAlias, region] = identityStr.split(':')
    // region can be undefined
    if (!address || !keyAlias) {
      throw Error(
        `Address or key alias is invalid. Address: ${address} Key Alias: ${keyAlias}`
      )
    }
    identities.push({
      address,
      keyAlias,
      region
    })
  }
  return identities
}

/**
 * Config values pulled from env vars used for generating an AwsHsmOracleIdentity
 */
interface AwsHsmOracleIdentityConfig {
  addressKeyAliases: string
}

/**
 * Env vars corresponding to each value for the AwsHsmOracleIdentityConfig for a particular context
 */
const awsHsmOracleIdentityConfigDynamicEnvVars: { [k in keyof AwsHsmOracleIdentityConfig]: DynamicEnvVar } = {
  addressKeyAliases: DynamicEnvVar.ORACLE_ADDRESS_AWS_KEY_ALIASES,
}

/**
 * ----------- PrivateKeyOracleDeployer helpers -----------
 */

/**
 * Gets an AwsHsmOracleDeployer by looking at env var values and generating private keys
 * from the mnemonic
 */
function getPrivateKeyOracleDeployer(celoEnv: string, context: string, useForno: boolean, count: number): PrivateKeyOracleDeployer {
  const identities: PrivateKeyOracleIdentity[] = getPrivateKeysFor(
    AccountType.PRICE_ORACLE,
    fetchEnv(envVar.MNEMONIC),
    count
  ).map((pkey) => ({
    address: privateKeyToAddress(pkey),
    privateKey: ensureLeading0x(pkey)
  }))
  const deploymentConfig: PrivateKeyOracleDeploymentConfig = {
    context,
    identities,
    useForno
  }
  return new PrivateKeyOracleDeployer(deploymentConfig, celoEnv)
}

/**
 * Config values pulled from env vars used for generating a PrivateKeyOracleIdentity
 * from a mnemonic
 */
interface MnemonicBasedOracleIdentityConfig {
  addressesFromMnemonicCount: string
}

/**
 * Env vars corresponding to each value for the MnemonicBasedOracleIdentityConfig for a particular context
 */
const mnemonicBasedOracleIdentityConfigDynamicEnvVars: { [k in keyof MnemonicBasedOracleIdentityConfig]: DynamicEnvVar } = {
  addressesFromMnemonicCount: DynamicEnvVar.ORACLE_ADDRESSES_FROM_MNEMONIC_COUNT,
}
