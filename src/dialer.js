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
  
  const [dialerPeerId, listenerPeerId] = await Promise.all([
    createFromJSON(await loadJsonFile(config.dialerNode)),
    createFromJSON(await loadJsonFile(config.listenerNode))
  ])

  const dialerNode = await createLibp2p({
    peerId: dialerPeerId,
    addresses: {
      listen: [new Multiaddr(`${config.relayNodeAddress}/p2p-circuit`)]
    },
    transports: [
      new WebSockets(),
      new TCP()
    ],
    connectionEncryption: [
      new Noise()
    ],
    streamMuxers: [
      new Mplex()
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

  await dialerNode.start()
  console.log(`[Dialer Node] started with id ${dialerNode.peerId.toString()}`)

  const relayNodeConnection = await dialerNode.dial(config.relayNodeAddress)
  console.log(`Connected to the auto relay node via ${relayNodeConnection.remoteAddr.toString()}`)

  const listenerMultiaddr = new Array(new Multiaddr(config.relayNodeAddress + '/p2p-circuit/p2p/' + listenerPeerId));
  dialerNode.peerStore.addressBook.set(listenerPeerId, listenerMultiaddr);
  
  console.log('Dialer ready, listening on:')
  dialerNode.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  })

  const listenerMa = new Multiaddr(config.relayNodeAddress + '/p2p-circuit/p2p/' + listenerPeerId)
  const { stream } = await dialerNode.dialProtocol(listenerMa, '/chat/1.0.0')
  
  // Log a message when a remote peer connects to us
  dialerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  console.log('Type a message and see what happens')

  stdinToStream(stream)
  streamToConsole(stream)
}

main()