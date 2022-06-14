import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { KadDHT } from '@libp2p/kad-dht'
import { FloodSub } from '@libp2p/floodsub'
import { Multiaddr } from '@multiformats/multiaddr'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { loadJsonFile } from 'load-json-file';

import { stdinToStream, streamToConsole } from './helpers/stream.js'

async function main () {

  const config = await loadJsonFile('config.json')

  const [idListener] = await Promise.all([
    createFromJSON(await loadJsonFile(config.peerId))
  ])

  const listenerNode = await createLibp2p({
    peerId: idListener,
    addresses: {
      listen: [new Multiaddr(`${config.relayNodeAddress}/p2p-circuit`)]
    },
    transports: [
      new WebSockets(),
    ],
    streamMuxers: [
        new Mplex()
    ],
    connectionEncryption: [
      new Noise()
    ],
    dht: new KadDHT(),
    pubsub: new FloodSub(),
    relay: {
      enabled: true,
      autoRelay: {
        enabled: true,
        maxListeners: 2
      }
    }
  })
  
  await listenerNode.start()
  console.log(`Node started with id ${listenerNode.peerId.toString()}`)

  const relayNodeConnection = await listenerNode.dial(config.relayNodeAddress)
  console.log(`Connected to the HOP relay ${relayNodeConnection.remotePeer.toString()}`)

  listenerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  await listenerNode.handle('/chat/1.0.0', async ({ stream }) => {
    stdinToStream(stream)
    streamToConsole(stream)
  })

  console.log('Listener ready, listening on:')
  listenerNode.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  })

}

main()