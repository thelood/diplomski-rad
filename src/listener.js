import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { TCP } from '@libp2p/tcp'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { KadDHT } from '@libp2p/kad-dht'
import { Multiaddr } from '@multiformats/multiaddr'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { loadJsonFile } from 'load-json-file';
import { stdinToStream, streamToConsole } from './helpers/stream.js'

async function main () {
  const config = await loadJsonFile('config.json')

  const [listenerPeerId] = await Promise.all([
    createFromJSON(await loadJsonFile(config.listenerNode))
  ])

  const listenerNode = await createLibp2p({
    peerId: listenerPeerId,
    addresses: {
      listen: [new Multiaddr(`${config.relayNodeAddress}/p2p-circuit`)]
    },
    transports: [
      new WebSockets(),
      new TCP()
    ],
    streamMuxers: [
        new Mplex()
    ],
    connectionEncryption: [
      new Noise()
    ],
    dht: new KadDHT(),
    relay: {
      enabled: true,
      autoRelay: {
        enabled: true,
        maxListeners: 2
      }
    }
  })
  
  await listenerNode.start()
  console.log(`[Listener Node] started with id ${listenerNode.peerId.toString()}`)

  const relayNodeConnection = await listenerNode.dial(config.relayNodeAddress)
  console.log(`Connected to the relay node [${relayNodeConnection.remotePeer.toString()}]`)

  listenerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  await listenerNode.handle('/chat/1.0.0', async ({ stream }) => {
    console.log('Type a message and see what happens')
    stdinToStream(stream)
    streamToConsole(stream)
  })

  console.log('Listener ready, listening on:')
  listenerNode.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  })

}

main()