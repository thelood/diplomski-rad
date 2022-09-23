# Relay node

https://github.com/libp2p/js-libp2p-relay-server

Relay node is up and running on Azure VM. It's IP address is publicly available and can be found on: 20.101.50.219

Use ```libp2p-relay-server --peerId ./relay-server-id.json``` to start relay node.

```relay-server-id.json``` is located at: ```src/peers``` folder


# Setup

1. Clone reposiotry ```git clone https://github.com/thelood/diplomski-rad```
2. Navigate to _src_ folder and run ```npm install```

# Run listener node
To start listener node run ```node listener.js```

# Run dialer node
To start dialer node run ```node dialer.js```
