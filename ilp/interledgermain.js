////server

const { createServer } = require('ilp-protocol-stream')
const Plugin = require('ilp-plugin-btp')


// Connects to the given plugin and waits for streams.
async function run () {
  const server = await createServer({
    plugin: new Plugin({ server: process.env.BTP_SERVER })
  })

  const { destinationAccount, sharedSecret } = server.generateAddressAndSecret()
}


////client
const { createConnection } = require('ilp-protocol-stream')
const getPlugin = require('ilp-plugin-btp')

const { destinationAccount, sharedSecret } =
  providedByTheServerSomehow()

async function run () {
  const connection = await createConnection({
    plugin: new Plugin({ server: process.env.BTP_SERVER}),
    destinationAccount,
    sharedSecret
  })
}

server.on('connection', connection => { ...
