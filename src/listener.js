import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { KadDHT } from '@libp2p/kad-dht'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { stdinToStream, streamToConsole } from './helpers/stream.js'
import peerIdDialerJson from './helpers/peer-id-dialer.js'
import peerIdListenerJson from './helpers/peer-id-listener.js' 
import { FloodSub } from '@libp2p/floodsub'
import { Multiaddr } from '@multiformats/multiaddr'

async function main () {
  const autoRelayNodeAddr = process.argv[2]
  if (!autoRelayNodeAddr) {
    throw new Error('the relay address needs to be specified as a parameter')
  }

  const [idDialer, idListener] = await Promise.all([
    createFromJSON(peerIdDialerJson),
    createFromJSON(peerIdListenerJson)
  ])

  const listenerNode = await createLibp2p({
    peerId: idListener,
    addresses: {
      listen: [new Multiaddr(`${autoRelayNodeAddr}/p2p-circuit`)]
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

  const relayNodeConnection = await listenerNode.dial(autoRelayNodeAddr)
  console.log(`Connected to the HOP relay ${relayNodeConnection.remotePeer.toString()}`)
  
  const dialerMultiaddr = new Array(new Multiaddr(autoRelayNodeAddr + '/p2p-circuit/p2p/' + idDialer));
  listenerNode.peerStore.addressBook.set(idDialer, dialerMultiaddr);

  // Log a message when a remote peer connects to us
  listenerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  // Handle messages for the protocol
  await listenerNode.handle('/chat/1.0.0', async ({ stream }) => {
    // Send stdin to the stream
    stdinToStream(stream)
    // Read the stream and output to console
    streamToConsole(stream)
  })

    // Output listen addresses to the console
    console.log('Listener ready, listening on:')
    listenerNode.getMultiaddrs().forEach((ma) => {
      console.log(ma.toString())
    })

    console.log('Dialer dialed to listener on protocol: /chat/1.0.0')
  console.log('Type a message and see what happens')

}

main()