import { createLibp2p } from 'libp2p'
import { WebSockets } from '@libp2p/websockets'
import { Noise } from '@chainsafe/libp2p-noise'
import { Mplex } from '@libp2p/mplex'
import { FloodSub } from '@libp2p/floodsub'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { KadDHT } from '@libp2p/kad-dht'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { stdinToStream, streamToConsole } from './helpers/stream.js'
import peerIdDialerJson from './helpers/peer-id-dialer.js'
import peerIdListenerJson from './helpers/peer-id-listener.js' 
import { Multiaddr } from '@multiformats/multiaddr'

async function main () {
  const autoRelayNodeAddr = process.argv[2]
  if (!autoRelayNodeAddr) {
    throw new Error('the auto relay node address needs to be specified')
  }

  const [idDialer, idListener] = await Promise.all([
    createFromJSON(peerIdDialerJson),
    createFromJSON(peerIdListenerJson)
  ])

  const dialerNode = await createLibp2p({
    peerId: idDialer,
    addresses: {
      listen: [new Multiaddr(`${autoRelayNodeAddr}/p2p-circuit`)]
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

  const relayNodeConnection = await dialerNode.dial(autoRelayNodeAddr)
  console.log(`Connected to the auto relay node via ${relayNodeConnection.remoteAddr.toString()}`)
  
  const listenerMultiaddr = new Array(new Multiaddr(autoRelayNodeAddr + '/p2p-circuit/p2p/' + idListener));
  dialerNode.peerStore.addressBook.set(idListener, listenerMultiaddr);
  
  // Output this node's address
  console.log('Dialer ready, listening on:')
  dialerNode.getMultiaddrs().forEach((ma) => {
    console.log(ma.toString())
  })

  // Dial to the remote peer (the "listener")
  const listenerMa = new Multiaddr(`/ip4/52.174.133.14/tcp/15003/ws/p2p/QmRzHnwAQXLDpRTLbQiogxUtC3iMwvtyN8Kchi49Jk5xJT/p2p-circuit/p2p/${idListener.toString()}`)
  const { stream } = await dialerNode.dialProtocol(listenerMa, '/chat/1.0.0')

  // Log a message when a remote peer connects to us
  dialerNode.connectionManager.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log('connected to: ', connection.remotePeer.toString())
  })

  // Handle messages for the protocol
  await dialerNode.handle('/chat/1.0.0', async ({ stream }) => {
    // Send stdin to the stream
    stdinToStream(stream)
    // Read the stream and output to console
    streamToConsole(stream)
  })

  console.log('Dialer dialed to listener on protocol: /chat/1.0.0')
  console.log('Type a message and see what happens')

  // Send stdin to the stream
  stdinToStream(stream)
  // Read the stream and output to console
  streamToConsole(stream)

}

main()