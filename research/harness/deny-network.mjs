import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

function record(endpoint) {
  if (process.env.ARKIVE_ENDPOINT_LOG) {
    fs.appendFileSync(process.env.ARKIVE_ENDPOINT_LOG, `${String(endpoint)}\n`)
  }
  throw new Error(`NETWORK_DISABLED:${endpoint}`)
}

globalThis.fetch = async (input) => record(typeof input === 'string' ? input : input?.url)
http.request = (...args) => record(args[0])
http.get = (...args) => record(args[0])
https.request = (...args) => record(args[0])
https.get = (...args) => record(args[0])
net.connect = (...args) => record(args[0])
net.createConnection = (...args) => record(args[0])
tls.connect = (...args) => record(args[0])
