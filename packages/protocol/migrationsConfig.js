const { toFixed } = require('@celo/utils/lib/fixidity')
const { CeloContractName } = require('@celo/protocol/lib/registry-utils')

const BigNumber = require('bignumber.js')
const minimist = require('minimist')
const path = require('path')
const lodash = require('lodash')
const web3 = require('web3')

const argv = minimist(process.argv.slice(2), {
  default: {
    build_directory: path.join(__dirname, 'build'),
  },
  string: ['migration_override', 'build_directory', 'network'],
})
const network = require('./truffle-config.js').networks[argv.network]

// Almost never use exponential notation in toString
// http://mikemcl.github.io/bignumber.js/#exponential-at
BigNumber.config({
  EXPONENTIAL_AT: 1e9,
})

const SECOND = 1
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const YEAR = 365 * DAY

const DefaultConfig = {
  attestations: {
    attestationExpiryBlocks: HOUR / 5, // ~1 hour,
    attestationRequestFeeInDollars: 0.05,
    selectIssuersWaitBlocks: 4,
    maxAttestations: 100,
  },
  blockchainParameters: {
    gasForNonGoldCurrencies: 50000,
    minimumClientVersion: {
      major: 0,
      minor: 9,
      patch: 0,
    },
    deploymentBlockGasLimit: 20000000,
    blockGasLimit: 10000000,
  },
  doubleSigningSlasher: {
    reward: '1000000000000000000000', // 1000 cGLD
    penalty: '9000000000000000000000', // 9000 cGLD
  },
  downtimeSlasher: {
    reward: '10000000000000000000', // 10 cGLD
    penalty: '100000000000000000000', // 100 cGLD
    // slashableDowntime: (12 * HOUR) / 5, // ~12 hours
    slashableDowntime: (12 * MINUTE) / 5, // ~12 hours
  },
  election: {
    minElectableValidators: '22',
    maxElectableValidators: '100',
    maxVotesPerAccount: 100,
    electabilityThreshold: 1 / 1000,
    frozen: false,
  },
  epochRewards: {
    targetVotingYieldParameters: {
      initial: 0.00016, // (x + 1) ^ 365 = 1.06
      max: 0.0005, // (x + 1) ^ 365 = 1.20
      adjustmentFactor: 0, // Change to 1 / 3650 once mainnet activated
    },
    rewardsMultiplierParameters: {
      max: 2,
      adjustmentFactors: {
        underspend: 1 / 2,
        overspend: 5,
      },
    },
    // Intentionally set lower than the expected value at steady state to account for the fact that
    // users may take some time to start voting with their cGLD.
    targetVotingGoldFraction: 1 / 2,
    maxValidatorEpochPayment: '205479452054794520547', // (75,000 / 365) * 10 ^ 18
    communityRewardFraction: 1 / 4,
    // TODO(asa): Must be set before RC1
    carbonOffsettingPartner: '0x0000000000000000000000000000000000000000',
    carbonOffsettingFraction: 1 / 200,
    frozen: false,
  },
  exchange: {
    spread: 5 / 1000,
    reserveFraction: 1 / 100,
    updateFrequency: 5 * MINUTE,
    minimumReports: 5,
    frozen: false,
  },
  gasPriceMinimum: {
    minimumFloor: 1000000000,
    targetDensity: 1 / 2,
    adjustmentSpeed: 1 / 2,
  },
  goldToken: {
    frozen: false,
  },
  governance: {
    queueExpiry: 4 * WEEK,
    dequeueFrequency: DAY, // Change to 1 week once mainnet activated
    concurrentProposals: 3,
    approvalStageDuration: DAY, // Change to 3 days once mainnet activated
    referendumStageDuration: 2 * DAY, // Change to 1 week once mainnet activated
    executionStageDuration: 3 * DAY,
    minDeposit: 100, // 100 cGLD
    participationBaseline: 5 / 100, // Start with low participation requirements, let the protocol adjust
    participationBaselineFloor: 5 / 100,
    participationBaselineUpdateFactor: 1 / 5,
    participationBaselineQuorumFactor: 1,
  },
  governanceApproverMultiSig: {
    // 2/4 multsig
    signatories: [
      '0x32830A3f65DF98aFCFA18bAd35009Aa51163D606',
      '0x7c593219ad21e172c1fdc6bfdc359699fa428adb',
      '0x31af68f73fb93815b3eB9a6FA76e63113De5f733',
      '0x47fE4b9fFDB9712fC5793B1b5E86d96a4664cf02',
    ],
    numRequiredConfirmations: 2,
    numInternalRequiredConfirmations: 2,
    useMultiSig: true,
  },
  lockedGold: {
    unlockingPeriod: 3 * DAY,
  },
  oracles: {
    reportExpiry: 5 * MINUTE,
  },
  random: {
    randomnessBlockRetentionWindow: HOUR / 5, // 1 hour to match attestationExpiryBlocks
  },
  registry: {
    predeployedProxyAddress: '0x000000000000000000000000000000000000ce10',
  },
  reserve: {
    tobinTaxStalenessThreshold: HOUR, // 1 hour
    tobinTax: toFixed(0.005).toFixed(), // 0.5%
    tobinTaxReserveRatio: toFixed(2).toFixed(), // 2
    dailySpendingRatio: toFixed(0.05).toFixed(), // 5%
    spenders: [],
    otherAddresses: ['0xd0a57D8acFe9979d33933d8A52971E6DC9E2DbF0'],
    assetAllocationSymbols: ['cGLD', 'BTC', 'ETH', 'DAI'],
    assetAllocationWeights: [0.5, 0.3, 0.15, 0.05],
  },
  reserveSpenderMultiSig: {
    // 2/2 multsig
    signatories: [
      '0x49eFFA2ceF5FccA5540f421d6b28e76184cc0fDF',
      '0x4550F1576fAC966Ac8b9F42e1D5D66D3A14dD8D3',
    ],
    numRequiredConfirmations: 2,
    numInternalRequiredConfirmations: 2,
  },
  stableToken: {
    decimals: 18,
    goldPrice: 1,
    tokenName: 'Celo Dollar',
    tokenSymbol: 'cUSD',
    inflationRate: 1,
    inflationPeriod: 1.5 * YEAR,
    initialBalances: {
      addresses: [],
      values: [],
    },
    oracles: [],
    frozen: false,
  },
  transferWhitelist: {
    addresses: [
      '0x49eFFA2ceF5FccA5540f421d6b28e76184cc0fDF',
      '0x4550F1576fAC966Ac8b9F42e1D5D66D3A14dD8D3',
      '0xd0a57D8acFe9979d33933d8A52971E6DC9E2DbF0',
      '0x36940810BfDB329B31e38d3e97aFD673081B497C',
      '0xfCf982bb4015852e706100B14E21f947a5Bb718E',
      '0xe90bB6dE0996D41cb0A843A06839EEf38c6E5456',
      '0xbA8761304CEc7bE0f83C6F8Fa7EBBa3eE0b6Ae97',
      '0xb566bB6D1850A345FA39EF38fefaC4E892348d51',
      '0xDb39DBE5abE42466F122b24c44518b1089ef8fC8',
      '0x671D520ae3E89Ea5383A5d7162bCed79FD25CdEe',
      '0x469be98FE71AFf8F6e7f64F9b732e28A03596B5C',
      '0x8f55CE88b4F62F22c663f5A539414dcCeF969c32',
      '0xF607d4dd519B4bc963C9c48E8650E67C51DbC35b',
      '0x515033209a0A29034DC3F037cC72a6014b902341',
      '0x6E36F0D3cF12aa592FF88D03938584562c9239cA',
      '0x0583BC2C09BA66e2f3a656f100d4c1F6ff502cb7',
      '0x093e9756B8e53fb656615C8aFEC5A02bb07a7466',
      '0x0DF3BdC3DacdDb111C8fee5202C12E0C7F7f8BCE',
      '0x1794Ba1E0e8633199C82BB68F3De83e1356B2052',
      '0x1a95c5B20b2E01b6108095a0135bDA395EB8D7E5',
      '0x278ffF514F407a95904Bc44a1919B3Efab0c56B4',
      '0x308B01FA9CB4926266adDfa8E482f56Fb8326e16',
      '0x3398c769Ae877a1D9d8B9baAe369EBaeDB2eaC25',
      '0x37C1D40495bce6e95b7139d3af4Cb34821fB6627',
      '0x385BF28009c53DD819690A57C48C2944C46bC620',
      '0x40d0e20402742dB53Cb1981BA12d66Db804CF1a2',
      '0x4CB9ef592D2aA41D54Fd5698BCbB3b8B0524fae7',
      '0x523EC2a0085A8Dfcf18AE640f59262e8Caa54A50',
      '0x59375F9160276B8EFE3f15B207dC01451E3e1f21',
      '0x5f03c997fe82ca4bF0B588c99bA2dAaeBe82DcE3',
      '0x6797E630E3dae8B76A97803606b3630fAf374745',
      '0x782FD27FB84eb0c115F96ea5D9b12CdaB4cf79ac',
      '0x81250109ce510287f2C7c485bbfD90519b0e1633',
      '0x86eF089baAA1E77fe61A30aFBABb7f89a11655FB',
      '0x9fb8A270Fa10CD52f85628315efC53065eAd48b6',
      '0xa11fcF0F8E0Be0A5Ad0181239D910C126E3Bfc2d',
      '0xa554718a49dF008434f447dE61799168617883Ec',
      '0xa9FF8E054DD575aa8FDf960f6a5108b685469D56',
      '0xac510cA27793E987Eb72ca6e44B5cf42E694710B',
      '0xB31056Aa58f6E7775Fa991f321C181F3aF333D42',
      '0xC0E14BDD2244e595BbF415Bb7011a44b39192c49',
      '0xCE7dfcA4dB4Cf970b4Bd8FDbA33754e09C51cC98',
      '0xCEa3eF8e187490A9d85A1849D98412E5D27D1Bb3',
      '0xd25811D3c30D8c16837Fd192b5Ff29eAeBc9Ebd9',
      '0xD6561EcE2D9f844a4beBf3D3606457612B9fF60b',
      '0xe0F3feEAac44ac55954FEF3f1DA3c3A7e71539F5',
      '0xeA4252D285Ca6c74EeC1Fb5B5735C1E522A9414B',
      '0xF3C3e5C13d2ed106F17293D1DA6EFCbb4E50A7A1',
      '0xF4314cb9046bECe6AA54bb9533155434d0c76909',
      '0xf8CD95dEa7Bb63cC094f2BD12e5080B7A1408f4F',
      '0xFcC245C3b20A1f9176417b120062eE2E9B656f9c',
    ],
    registryIds: [
      web3.utils.soliditySha3(CeloContractName.Governance),
      web3.utils.soliditySha3(CeloContractName.LockedGold),
      web3.utils.soliditySha3(CeloContractName.Reserve),
    ],
  },
  validators: {
    groupLockedGoldRequirements: {
      value: '10000000000000000000000', // 10k gold per validator
      duration: 180 * DAY,
    },
    validatorLockedGoldRequirements: {
      value: '10000000000000000000000', // 10k gold
      // MUST BE KEPT IN SYNC WITH MEMBERSHIP HISTORY LENGTH
      duration: 60 * DAY,
    },
    validatorScoreParameters: {
      exponent: 10,
      adjustmentSpeed: 0.1,
    },
    // MUST BE KEPT IN SYNC WITH VALIDATOR LOCKED GOLD DURATION
    membershipHistoryLength: 60,
    commissionUpdateDelay: (3 * DAY) / 5, // Approximately 3 days with 5s block times
    maxGroupSize: 5,
    slashingPenaltyResetPeriod: 30 * DAY,

    // Register a number of cLabs groups to contain an initial set of validators to run test
    // networks.
    validatorKeys: [],
    attestationKeys: [],
    groupName: 'C-Labs',
    commission: 0.1,
    votesRatioOfLastVsFirstGroup: 2.0,
  },
}

const NetworkConfigs = {
  development: {
    downtimeSlasher: {
      slashableDowntime: 60, // epoch length is 100 for unit tests
    },
    election: {
      minElectableValidators: '10',
      frozen: false,
    },
    epochRewards: {
      frozen: false,
    },
    exchange: {
      frozen: false,
      minimumReports: 1,
    },
    goldToken: {
      frozen: false,
    },
    governanceApproverMultiSig: {
      signatories: [network.from],
      numRequiredConfirmations: 1,
      numInternalRequiredConfirmations: 1,
    },
    reserve: {
      initialBalance: 100000000,
      otherAddresses: ['0x7457d5E02197480Db681D3fdF256c7acA21bDc12'], // Add an arbitrary "otherReserveAddress" so that reserve spending can be tested.
    },
    reserveSpenderMultiSig: {
      signatories: [network.from],
      numRequiredConfirmations: 1,
      numInternalRequiredConfirmations: 1,
    },
    stableToken: {
      oracles: [network.from],
      frozen: false,
    },
  },
  testing: {
    downtimeSlasher: {
      slashableDowntime: 6,
    },
    election: {
      minElectableValidators: '1',
      frozen: false,
    },
    epochRewards: {
      frozen: false,
      targetVotingYieldParameters: {
        initial: 0.00016,
        max: 0.0005,
        adjustmentFactor: 0.1,
      },
    },
    exchange: {
      frozen: false,
    },
    goldToken: {
      frozen: false,
    },
    governance: {
      skipSetConstitution: true,
      skipTransferOwnership: true,
    },
    stableToken: {
      frozen: false,
    },
    reserve: {
      initialBalance: 100000000,
    },
  },
  baklava: {
    blockchainParameters: {
      minimumClientVersion: {
        major: 0,
        minor: 10,
        patch: 0,
      },
    },
    election: {
      minElectableValidators: '25', // About half of the expected genesis set.
    },
    governance: {
      // Set to be able to complete a proposal in about a day, but give everyone a chance to participate.
      dequeueFrequency: 4 * HOUR,
      approvalStageDuration: 4 * HOUR,
      referendumStageDuration: DAY,
      executionStageDuration: WEEK,
    },
    lockedGold: {
      unlockingPeriod: 6 * HOUR, // 1/12 of the mainnet period.
    },
    stableToken: {
      oracles: [
        '0x0d473f73AAf1C2bf7EBd2be7196C71dBa6C1724b',
        '0x8F7ca85A9E4A18B551b765706bd0B6f26927D86F',
        '0x3EaEe6C693420Ae86643EB2837978da8eEbf973f',
        '0xDd3E5FcE22938c0f482004527D468a8799C4a61E',
        '0xFb2Ee4Da251fC6A9DF7eb8d5c4ea1DeC99d127eA',
        '0xd321C7356DFB5b6F4AD9e5B58C51B46409fe1442',
        '0xbbbC38f6a383293522d4aEDaA98b7d2D73E90A73',
        '0xB9E0b0B8fdA1001392c8fFd19f6B7ad5286589F2',
        '0x44740e3eedfD3a2A2e7662de9165a6E20bBcC72C',
        '0x7a2cb0438e7B9801C29B39Ff94439aFf930CDf9F',
      ],
    },
    validators: {
      groupLockedGoldRequirements: {
        duration: 15 * DAY, // 1/12 of the mainnet duration.
      },
      validatorLockedGoldRequirements: {
        duration: 5 * DAY, // 1/12 of the mainnet duration.
      },
      membershipHistoryLength: 15, // Number of epochs in the group lockup period.
    },
  },
  alfajores: {
    election: {
      minElectableValidators: '1',
    },
    epochRewards: {
      frozen: false,
    },
    exchange: {
      frozen: false,
      minimumReports: 1,
    },
    goldToken: {
      frozen: false,
    },
    stableToken: {
      frozen: false,
    },
    reserve: {
      initialBalance: 100000000,
    },
    oracles: {
      reportExpiry: 1000 * DAY,
    },
  },
}

NetworkConfigs.baklavastaging = NetworkConfigs.baklava
NetworkConfigs.alfajoresstaging = NetworkConfigs.alfajores

const linkedLibraries = {
  FixidityLib: [
    'LockedGold',
    'Exchange',
    'GasPriceMinimum',
    'Governance',
    'GovernanceTest',
    'Proposals',
    'SortedOracles',
    'StableToken',
    'Validators',
  ],
  Proposals: ['Governance', 'GovernanceTest', 'ProposalsTest'],
  LinkedList: ['AddressLinkedList', 'SortedLinkedList', 'LinkedListTest'],
  SortedLinkedList: [
    'AddressSortedLinkedList',
    'IntegerSortedLinkedList',
    'SortedLinkedListWithMedian',
  ],
  SortedLinkedListWithMedian: ['AddressSortedLinkedListWithMedian'],
  AddressLinkedList: ['Validators', 'ValidatorsTest'],
  AddressSortedLinkedList: ['Election', 'ElectionTest'],
  IntegerSortedLinkedList: ['Governance', 'GovernanceTest', 'IntegerSortedLinkedListTest'],
  AddressSortedLinkedListWithMedian: ['SortedOracles', 'AddressSortedLinkedListWithMedianTest'],
  Signatures: ['Accounts', 'TestAttestations', 'Attestations', 'LockedGold', 'Escrow'],
}

const config = lodash.cloneDeep(DefaultConfig)

const migrationOverride = argv.migration_override ? JSON.parse(argv.migration_override) : {}

// Use lodash merge to deeply override defaults.
if (argv.network && NetworkConfigs[argv.network]) {
  lodash.merge(config, NetworkConfigs[argv.network])
}
lodash.merge(config, migrationOverride)

module.exports = {
  build_directory: argv.build_directory,
  config,
  linkedLibraries,
}
