import { CeloContract } from '@celo/contractkit'
import { ContractKit, newKit } from '@celo/contractkit'
import { Address, AllContracts } from '@celo/contractkit/lib/base'
import { AccountAssets, trackTransfers } from '@celo/contractkit/lib/explorer/assets'
import { TransactionResult } from '@celo/contractkit/lib/utils/tx-result'
import { GoldTokenWrapper } from '@celo/contractkit/lib/wrappers/GoldTokenWrapper'
import { ReserveWrapper } from '@celo/contractkit/lib/wrappers/Reserve'
import { normalizeAddress } from '@celo/utils/src/address'
import BigNumber from 'bignumber.js'
import { assert } from 'chai'
import Web3 from 'web3'
import { TransactionReceipt } from 'web3-core'
import { GethRunConfig } from '../lib/interfaces/geth-run-config'
import { MonorepoRoot, getContext, sleep } from './utils'
import { spawnCmdWithExitOnFailure } from '../lib/utils'

const TMP_PATH = '/tmp/e2e'

function assertEqualBN(value: BigNumber, expected: BigNumber) {
  assert.equal(value.toString(), expected.toString())
}

describe('tracer tests', () => {
  const validatorAddress = '0x47e172f6cfb6c7d01c1574fa3e2be7cc73269d95'
  const FromAddress = validatorAddress
  const ToAddress = '0xbBae99F0E1EE565404465638d40827b54D343638'
  /*const FromAddress = '0x5409ed021d9299bf6814279a6a1411a7e866a631'
  const DEF_FROM_PK = 'f2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d'
  const FeeRecipientAddress = '0x4f5f8a3f45d179553e7b95119ce296010f50f6f1'*/
  const TransferAmount: BigNumber = new BigNumber(Web3.utils.toWei('1', 'ether'))

  const gethConfig: GethRunConfig = {
    runPath: TMP_PATH,
    networkId: 1101,
    network: 'local',
    migrate: true,
    instances: [
      {
        name: 'validator0',
        validating: true,
        syncmode: 'full',
        port: 30303,
        rpcport: 8545,
      },
      {
        name: 'validator1',
        validating: true,
        syncmode: 'full',
        port: 30305,
        rpcport: 8547,
      },
      {
        name: 'validator2',
        validating: true,
        syncmode: 'full',
        port: 30307,
        rpcport: 8549,
      },
    ],
    migrationOverrides: {
      lockedGold: {
        unlockingPeriod: 1,
      },
      exchange: {
        minimumReports: 0,
        frozen: false,
      },
    },
  }

  const context: any = getContext(gethConfig)
  let kit: ContractKit
  let goldToken: GoldTokenWrapper

  before(async function(this: any) {
    this.timeout(0)
    //await context.hooks.before()
  })

  after(async function(this: any) {
    this.timeout(0)
    await context.hooks.after()
    //await sleep(1000000)
  })

  const restart = async () => {
    await context.hooks.restart()
    kit = newKit('http://localhost:8545')
    kit.defaultAccount = validatorAddress
    goldToken = await kit.contracts.getGoldToken()

    console.info('AllContracts')
    for (const contract of AllContracts) {
      try {
        const addr = await kit.registry.addressFor(contract)
        console.info(`${contract} = ${addr}`)
      } catch (error) {
        console.info(error)
      }
    }

    // TODO(mcortesi): magic sleep. without it unlockAccount sometimes fails
    await sleep(2)
    // Assuming empty password
    await kit.web3.eth.personal.unlockAccount(validatorAddress, '', 1000000)

    // Give the account we will send transfers as sufficient gold and dollars.
    if (FromAddress != validatorAddress) {
      const startBalance = TransferAmount.times(500)
      const resDollars = await transferCeloDollars(validatorAddress, FromAddress, startBalance)
      const resGold = await transferCeloGold(validatorAddress, FromAddress, startBalance)
      await Promise.all([resDollars.waitReceipt(), resGold.waitReceipt()])
    }
  }

  const transferCeloGold = async (
    fromAddress: string,
    toAddress: string,
    amount: BigNumber,
    txOptions: {
      gas?: number
      gasPrice?: string
      feeCurrency?: string
      gatewayFeeRecipient?: string
      gatewayFee?: string
    } = {}
  ) => {
    const res = await kit.sendTransaction({
      from: fromAddress,
      to: toAddress,
      value: amount.toString(),
      ...txOptions,
    })
    return res
  }

  const transferCeloDollars = async (
    fromAddress: string,
    toAddress: string,
    amount: BigNumber,
    txOptions: {
      gas?: number
      gasPrice?: string
      feeCurrency?: string
      gatewayFeeRecipient?: string
      gatewayFee?: string
    } = {}
  ) => {
    const kitStableToken = await kit.contracts.getStableToken()
    const res = await kitStableToken.transfer(toAddress, amount.toString()).send({
      from: fromAddress,
      ...txOptions,
    })

    return res
  }

  const testTransferGold = (
    name: string,
    transferFn: () => Promise<TransactionResult>,
    goldGasCurrency: boolean = true
  ) => {
    let trackBalances: Record<Address, AccountAssets>
    let fromInitialBalance: BigNumber
    let fromFinalBalance: BigNumber
    let toInitialBalance: BigNumber
    let toFinalBalance: BigNumber
    let receipt: TransactionReceipt
    let txn: any

    describe(`transfer cGLD: ${name}`, () => {
      before(async function(this: any) {
        this.timeout(0)
        fromInitialBalance = await goldToken.balanceOf(FromAddress)
        toInitialBalance = await goldToken.balanceOf(ToAddress)
        const txResult = await transferFn()
        receipt = await txResult.waitReceipt()
        txn = await kit.web3.eth.getTransaction(receipt.transactionHash)
        fromFinalBalance = await goldToken.balanceOf(FromAddress)
        toFinalBalance = await goldToken.balanceOf(ToAddress)
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
        //console.info(`${name} receipt`)
        //console.info(receipt)
        //console.info(`${name} trackBalances`)
        //console.info(trackBalances)
        //console.info('${name} txn')
        //console.info(txn)
      })

      it(`balanceOf should increment the receiver's balance by the transfer amount`, () =>
        assertEqualBN(toFinalBalance.minus(toInitialBalance), new BigNumber(TransferAmount)))
      it(`balanceOf should decrement the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          fromFinalBalance.minus(fromInitialBalance),
          new BigNumber(-TransferAmount).minus(
            goldGasCurrency
              ? new BigNumber(receipt.gasUsed).times(new BigNumber(txn.gasPrice))
              : new BigNumber(0)
          )
        ))
      it(`cGLD tracer should increment the receiver's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(ToAddress)].gold,
          new BigNumber(TransferAmount)
        ))
      it(`cGLD tracer should decrement the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].gold,
          new BigNumber(-TransferAmount)
        ))
    })
  }

  describe('Tracer tests', () => {
    before(async function() {
      this.timeout(0)
      await restart()
    })

    testTransferGold('normal', () => transferCeloGold(FromAddress, ToAddress, TransferAmount))

    testTransferGold(
      'with feeCurrency cUSD',
      async () => {
        const feeCurrency = await kit.registry.addressFor(CeloContract.StableToken)
        return transferCeloGold(FromAddress, ToAddress, TransferAmount, {
          feeCurrency,
        })
      },
      false
    )

    describe(`Locking gold`, () => {
      let trackBalances: Record<Address, AccountAssets>
      let receipt: TransactionReceipt

      before(async function(this: any) {
        this.timeout(0)
        const lockedGold = await kit.contracts.getLockedGold()
        const tx = await lockedGold.lock()
        const txResult = await tx.send({ value: TransferAmount.toFixed() })
        receipt = await txResult.waitReceipt()
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
      })

      it(`cGLD tracer should decrement the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].gold,
          new BigNumber(-TransferAmount)
        ))
    })

    describe(`Unlocking gold`, () => {
      let trackBalances: Record<Address, AccountAssets>
      let receipt: TransactionReceipt

      before(async function(this: any) {
        this.timeout(0)
        const lockedGold = await kit.contracts.getLockedGold()
        const tx = await lockedGold.unlock(TransferAmount)
        const txResult = await tx.send()
        receipt = await txResult.waitReceipt()
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
      })

      it(`cGLD tracer should increment the sender's pending withdrawls by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].lockedGoldPendingWithdrawl,
          new BigNumber(TransferAmount)
        ))
    })

    describe(`Withdrawing unlocked gold`, () => {
      let trackBalances: Record<Address, AccountAssets>
      let receipt: TransactionReceipt

      before(async function(this: any) {
        this.timeout(0)
        // wait for 1 second unlocking period to elapse
        await sleep(3)
        const lockedGold = await kit.contracts.getLockedGold()
        const tx = await lockedGold.withdraw(0)
        const txResult = await tx.send()
        receipt = await txResult.waitReceipt()
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
        //console.info(`Withdraw receipt`)
        //console.info(receipt)
      })

      it(`cGLD tracer should increment the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].gold,
          new BigNumber(TransferAmount)
        ))
    })

    describe(`Exchanging gold for tokens`, () => {
      let trackBalances: Record<Address, AccountAssets>
      let receipt: TransactionReceipt
      let reserve: ReserveWrapper

      before(async function(this: any) {
        this.timeout(0)
        reserve = await kit.contracts.getReserve()
        const exchange = await kit.contracts.getExchange()
        const approveTx = await goldToken.approve(exchange.address, TransferAmount.toFixed())
        const approveTxRes = await approveTx.send()
        await approveTxRes.waitReceipt()

        const tx = await exchange.exchange(TransferAmount, 1, true)
        const txResult = await tx.send()
        receipt = await txResult.waitReceipt()
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
        //console.info(`Exchange gold receipt`)
        //console.info(receipt)
      })

      it(`cGLD tracer should decrement the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].gold,
          new BigNumber(-TransferAmount)
        ))

      it(`cGLD tracer should increment the reserve's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(reserve.address)].gold,
          new BigNumber(TransferAmount)
        ))
    })

    describe(`Exchanging tokens for gold`, () => {
      let trackBalances: Record<Address, AccountAssets>
      let receipt: TransactionReceipt

      before(async function(this: any) {
        this.timeout(0)
        const exchange = await kit.contracts.getExchange()
        const quote = await exchange.quoteGoldBuy(TransferAmount)

        const stableToken = await kit.contracts.getStableToken()
        const approveTx = await stableToken.approve(exchange.address, quote.toFixed())
        const approveTxRes = await approveTx.send()
        await approveTxRes.waitReceipt()

        const tx = await exchange.exchange(quote, 1, false)
        const txResult = await tx.send()
        receipt = await txResult.waitReceipt()
        trackBalances = await trackTransfers(kit, receipt.blockNumber)
        //console.info(`Exchange token receipt`)
        //console.info(receipt)
      })

      it(`cGLD tracer should increment the sender's balance by the transfer amount`, () =>
        assertEqualBN(
          trackBalances[normalizeAddress(FromAddress)].gold,
          new BigNumber(TransferAmount)
        ))
    })

    describe(`Deploying release gold`, () => {
      before(async function(this: any) {
        this.timeout(0)
        //const startBlockNumber = await this.web3.eth.getBlockNumber()
        const args = [
          '--cwd',
          `${MonorepoRoot}/packages/protocol`,
          'run',
          'truffle',
          'exec',
          `${MonorepoRoot}/packages/protocol/scripts/truffle/deploy_release_contracts.js`,
          '--network',
          'testing',
          '--start_gold',
          '50',
          '--grants',
          `${MonorepoRoot}/packages/protocol/scripts/truffle/releaseGoldContracts.json`,
          '--output_file',
          '/tmp/e2e/releaseGold.txt',
          '--yesreally',
        ]
        await spawnCmdWithExitOnFailure('yarn', args)
        //const endBlockNumber = await this.web3.eth.getBlockNumber()
      })
    })
  })
})
