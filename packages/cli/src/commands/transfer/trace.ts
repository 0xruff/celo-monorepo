// celotooljs port-forward -e alfajores
// celocli config:set --node http://localhost:8545
// wget https://files.slack.com/files-pri/T7RKE6B5G-FV64J6PUM/tracer.js
// celocli transfer:trace --tracer tracer.js \
//   --transaction 0x641bca4a3febb911eaed4e5ab9e2dbd3672063e71264e222ccb9b1732a7db505
// celocli transfer:trace --tracer tracer.js --blockNumber 603190

import { traceBlock, traceTransaction } from '@celo/contractkit/lib/utils/web3-utils'
import { flags } from '@oclif/command'
import fs from 'fs'
import { BaseCommand } from '../../base'
import { printValueMapRecursive } from '../../utils/cli'

export default class Trace extends BaseCommand {
  static description = 'Trace a transaction'

  static flags = {
    ...BaseCommand.flags,
    blockNumber: flags.integer({ description: 'Block number to trace' }),
    tracer: flags.string({ description: 'Javascript tracer code' }),
    transaction: flags.string({ description: 'Transaction hash to trace' }),
  }

  async run() {
    const res = this.parse(Trace)
    const tracer = res.flags.tracer ? fs.readFileSync(res.flags.tracer).toString() : ''

    if (res.flags.transaction) {
      printValueMapRecursive(
        await traceTransaction(this.originalProvider, res.flags.transaction, tracer)
      )
    } else if (res.flags.blockNumber) {
      printValueMapRecursive(await traceBlock(this.originalProvider, res.flags.blockNumber, tracer))
    }
  }
}
