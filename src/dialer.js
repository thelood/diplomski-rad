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
  
  const [idDialer, idListener] = await Promise.all([
    createFromJSON(await loadJsonFile(config.peerId)),
    createFromJSON(await loadJsonFile(config.remotePeer))
  ])

  const dialerNode = await createLibp2p({
    peerId: idDialer,
    addresses: {
      listen: [new Multiaddr(`${config.relayNodeAddress}/p2p-circuit`)]
    },
    transports: [
      new WebSockets()
    ],
    connectionEncryption: [
      new Noise()
    ],
    streamMuxers: [
      new Mplex()
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

  await dialerNode.start()
  console.log(`[Diarler Node] started with id ${dialerNode.peerId.toString()}`)

  const relayNodeConnection = await dialerNode.dial(config.relayNodeAddress)
  console.log(`Connected to the auto relay node via ${relayNodeConnection.remoteAddr.toString()}`)
  
  const listenerMultiaddr = new Array(new Multiaddr(config.relayNodeAddress + '/p2p-circuit/p2p/' + config.remotePeerId));
  dialerNode.peerStore.addressBook.set(idListener, listenerMultiaddr);
  
  console.log('Dialer ready, listening on:')
  dialerNode.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  })

  const listenerMa = new Multiaddr(config.relayNodeAddress + '/p2p-circuit/p2p/' + config.remotePeerId.toString())
  const { stream } = await dialerNode.dialProtocol(listenerMa, '/chat/1.0.0')
  
  dialerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  await dialerNode.handle('/chat/1.0.0', async ({ stream }) => {
    stdinToStream(stream)
    streamToConsole(stream)
  })

  console.log('Dialer dialed to listener on protocol: /chat/1.0.0')
  console.log('Type a message and see what happens')

  stdinToStream(stream)
  streamToConsole(stream)

}

main()