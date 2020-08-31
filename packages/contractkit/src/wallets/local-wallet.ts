import { normalizeAddressWith0x } from '@celo/base/lib/address'
import { privateKeyToAddress } from '@celo/utils/lib/address'
import { LocalSigner } from './signers/local-signer'
import { Wallet, WalletBase } from './wallet'

export class LocalWallet extends WalletBase<LocalSigner> implements Wallet {
  /**
   * Register the private key as signer account
   * @param privateKey account private key
   */
  addAccount(privateKey: string): Promise<string> {
    // Prefix 0x here or else the signed transaction produces dramatically different signer!!!
    privateKey = normalizeAddressWith0x(privateKey)
    const accountAddress = normalizeAddressWith0x(privateKeyToAddress(privateKey))
    if (!this.hasAccount(accountAddress)) {
      this.addSigner(accountAddress, new LocalSigner(privateKey))
    }
    return Promise.resolve(accountAddress)
  }
}
