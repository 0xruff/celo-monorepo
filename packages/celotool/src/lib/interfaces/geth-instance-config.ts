export interface GethInstanceConfig {
  name: string
  validating?: boolean
  validatingGasPrice?: number
  syncmode: string
  port: number
  proxyport?: number
  rpcport?: number
  wsport?: number
  lightserv?: boolean
  privateKey?: string
  etherbase?: string
  proxies?: Array<string[2]>
  isProxied?: boolean
  isProxy?: boolean
  bootnodeEnode?: string
  nodekey?: string
  proxy?: string
  proxiedValidatorAddress?: string
  proxyAllowPrivateIp?: boolean
  ethstats?: string
  pid?: number
  args?: string[]
}
