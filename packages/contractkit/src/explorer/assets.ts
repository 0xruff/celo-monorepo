import { Address, normalizeAddress } from '@celo/utils/lib/address'
import BigNumber from 'bignumber.js'
import { ContractKit } from '../kit'
import { traceBlock } from '../utils/web3-utils'

export class DerivedAccountAssets {
  lockedGold: BigNumber
  lockedGoldPendingWithdrawl: BigNumber
  pendingVotes: BigNumber
  tokenUnits: Record<string, BigNumber>
  activeVoteUnits: Record<Address, BigNumber>

  constructor() {
    this.lockedGold = new BigNumber(0)
    this.lockedGoldPendingWithdrawl = new BigNumber(0)
    this.pendingVotes = new BigNumber(0)
    this.tokenUnits = {}
    this.activeVoteUnits = {}
  }
}

export class ReleaseGoldAssets extends DerivedAccountAssets {
  gold: BigNumber

  constructor() {
    super()
    this.gold = new BigNumber(0)
  }
}

export class AccountAssets extends DerivedAccountAssets {
  gold: BigNumber
  releaseGold: Record<Address, ReleaseGoldAssets>

  constructor() {
    super()
    this.gold = new BigNumber(0)
    this.releaseGold = {}
  }
}

function getAccount(
  accounts: Record<Address, AccountAssets>,
  accountAddress: Address,
  filter: boolean
): AccountAssets | undefined {
  const address = normalizeAddress(accountAddress)
  if (filter && !(address in accounts)) return undefined
  return accounts[address] || (accounts[address] = new AccountAssets())
}

export async function trackTransfers(
  kit: ContractKit,
  blockNumber: number,
  assets: Record<Address, AccountAssets> | undefined = undefined,
  filter: boolean = false
): Promise<Record<Address, AccountAssets>> {
  const ret = assets || {}

  const goldTransfers = await traceBlock(
    kit.web3.currentProvider,
    blockNumber,
    'cgldTransferTracer'
  )
  for (const transaction of goldTransfers) {
    for (const transfer of transaction) {
      const from = getAccount(ret, transfer.from, filter)
      const to = getAccount(ret, transfer.to, filter)
      if (from) from.gold = from.gold.minus(transfer.value)
      if (to) to.gold = to.gold.plus(transfer.value)
    }
  }

  const lockedGold = await kit.contracts.getLockedGold()
  const goldLocked = await lockedGold.getGoldLockedEvents(blockNumber)
  for (const locked of goldLocked) {
    const account = getAccount(ret, locked.account, filter)
    // For lock() the gold was debited from account.gold by cgld_transfer_tracer
    if (account) account.lockedGold = account.lockedGold.plus(locked.value)
    // Can't distuinguish LockedGold lock() and relock() only from logs
    // await pendingWithdrawls = lockedGold.getPendingWithdrawls(account)
    // await sumPendingWithdrals =
  }

  const goldUnlocked = await lockedGold.getGoldUnlockedEvents(blockNumber)
  for (const unlocked of goldUnlocked) {
    const account = getAccount(ret, unlocked.account, filter)
    if (account)
      account.lockedGoldPendingWithdrawl = account.lockedGoldPendingWithdrawl.plus(unlocked.value)
  }

  const goldWithdrawn = await lockedGold.getGoldWithdrawnEvents(blockNumber)
  for (const withdrawn of goldWithdrawn) {
    const account = getAccount(ret, withdrawn.account, filter)
    if (account) account.gold = account.gold.plus(withdrawn.value)
  }

  const election = await kit.contracts.getElection()
  const voteCast = await election.getValidatorGroupVoteCastEvents(blockNumber)
  for (const vote of voteCast) {
    const account = getAccount(ret, vote.account, filter)
    if (account) account.pendingVotes = account.pendingVotes.plus(vote.value)
  }

  const voteActivated = await election.getValidatorGroupVoteActivatedEvents(blockNumber)
  for (const vote of voteActivated) {
    const account = getAccount(ret, vote.account, filter)
    // needs conversion to units
    if (account)
      account.activeVoteUnits[vote.group] = (
        account.activeVoteUnits[vote.group] || new BigNumber(0)
      ).plus(vote.value)
  }

  const voteRevoked = await election.getValidatorGroupVoteRevokedEvents(blockNumber)
  for (const vote of voteRevoked) {
    const account = getAccount(ret, vote.account, filter)
    if (account) account.lockedGold = account.lockedGold.plus(vote.value)
  }

  // StableToken.creditTo and StableToken.debitFrom should emit a Transfer event like StableToken._mint
  const stableTokenName = 'cUSD'
  const stableToken = await kit.contracts.getStableToken()
  const stableTransfers = await stableToken.getTransferEvents(blockNumber)
  for (const transfer of stableTransfers) {
    const from = getAccount(ret, transfer.from, filter)
    const to = getAccount(ret, transfer.to, filter)
    // needs event change to distuinguish StableToken instances from only logs
    // needs conversion to units
    if (from)
      from.tokenUnits[stableTokenName] = (
        from.tokenUnits[stableTokenName] || new BigNumber(0)
      ).minus(transfer.value)
    if (to)
      to.tokenUnits[stableTokenName] = (to.tokenUnits[stableTokenName] || new BigNumber(0)).plus(
        transfer.value
      )
  }

  // ReleaseGold

  // Epoch rewards

  // Slashing

  return ret
}
