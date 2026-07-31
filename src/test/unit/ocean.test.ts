import { OceanNode } from '../../OceanNode.js'
import { OceanIndexer } from '../../components/Indexer/index.js'
import { OceanP2P } from '../../components/P2P/index.js'
import { KeyManager } from '../../components/KeyManager/index.js'
import { BlockchainRegistry } from '../../components/BlockchainRegistry/index.js'
import { OceanProvider } from '../../components/Provider/index.js'
import { Database } from '../../components/database/index.js'
import { ENVIRONMENT_VARIABLES, getConfiguration } from '../../utils/index.js'
import { OceanNodeConfig } from '../../@types/OceanNode.js'

import { expect } from 'chai'
import {
  OverrideEnvConfig,
  TEST_ENV_CONFIG_FILE,
  buildEnvOverrideConfig,
  setupEnvironment,
  tearDownEnvironment
} from '../utils/utils.js'

let envOverrides: OverrideEnvConfig[]

// NOTE: describe() bodies must stay synchronous — Mocha does not await an async
// describe callback, so anything after its first `await` (it()/before()/after()
// registrations) gets scheduled on a microtask instead of during suite-tree
// construction, racing unpredictably with other test files' hooks. That race was
// the actual cause of intermittent "Invalid PRIVATE_KEY" failures elsewhere in the
// suite, so all setup below lives in before() instead of directly in the describe body.
describe('Status command tests', () => {
  let config: OceanNodeConfig
  let db: Database
  let oceanIndexer: OceanIndexer
  let oceanProvider: OceanProvider
  let oceanNode: OceanNode

  before(async () => {
    envOverrides = buildEnvOverrideConfig(
      [
        ENVIRONMENT_VARIABLES.PRIVATE_KEY,
        ENVIRONMENT_VARIABLES.IPFS_GATEWAY,
        ENVIRONMENT_VARIABLES.ARWEAVE_GATEWAY,
        ENVIRONMENT_VARIABLES.RPCS,
        ENVIRONMENT_VARIABLES.INDEXER_NETWORKS
      ],
      [
        '0xc594c6e5def4bab63ac29eed19a134c130388f74f019bc74b8f4389df2837a58',
        'https://ipfs.io/',
        'https://arweave.net/',
        '{ "1": "https://rpc.eth.gateway.fm", "137": "https://polygon.meowrpc.com" }',
        JSON.stringify([1, 137])
      ]
    )
    envOverrides = await setupEnvironment(TEST_ENV_CONFIG_FILE, envOverrides)
    config = await getConfiguration(true)
    db = await Database.init(config.dbConfig)
    const keyManager = new KeyManager(config)
    const blockchainRegistry = new BlockchainRegistry(keyManager, config)
    const oceanP2P = new OceanP2P(config, keyManager, db)
    oceanIndexer = new OceanIndexer(db, config, blockchainRegistry)
    oceanProvider = new OceanProvider(db)
    oceanNode = OceanNode.getInstance(config, db, oceanP2P)
  })

  after(async () => {
    // Restore original local setup / env variables after test
    await tearDownEnvironment(envOverrides)
    await oceanIndexer.stopAllChainIndexers()
  })

  it('Ocean Node instance', () => {
    expect(oceanNode).to.be.instanceOf(OceanNode)
    expect(config.supportedNetworks).to.eql({
      '1': 'https://rpc.eth.gateway.fm',
      '137': 'https://polygon.meowrpc.com'
    })
    expect(oceanNode.getDatabase()).to.not.eql(null)
    expect(config.hasP2P).to.eql(true)
    expect(config.hasIndexer).to.eql(true)
  })
  it('Ocean P2P should be initialized correctly', () => {
    expect(oceanNode.getP2PNode()).to.not.eql(null)
    expect(OceanNode.getInstance(config, db).getP2PNode()).to.not.eql(null)
  })
  it('Ocean Indexer should be initialized correctly', () => {
    oceanNode.addIndexer(oceanIndexer)
    expect(oceanNode.getIndexer().getSupportedNetworks()).to.eql(config.indexingNetworks)
    expect(oceanNode.getIndexer().getDatabase()).to.eql(db)
  })
  it('Ocean Provider should be initialized correctly', () => {
    oceanNode.addProvider(oceanProvider)
    expect(oceanNode.getProvider().getDatabase()).to.eql(db)
  })
})
