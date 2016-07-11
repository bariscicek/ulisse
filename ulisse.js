'use strict'

const fs = require('fs')
const _ = require('lodash')
const program = require('commander')
const async = require('async')
const Binlog = require('./lib/Binlog')
const lutils = require('./utils')

program
  .version('0.0.1')
  .option('-c, --conf <val>', 'configuration file')
  .option('--debug', 'debug')
  .parse(process.argv)

if (!program.conf) {
  program.conf = 'config.json'
}

var conf = _.extend(
  {},
  JSON.parse(fs.readFileSync(__dirname + '/' + program.conf, 'UTF8'))
)

if (!conf.id) {
  conf.id = 1
}

var rc_sub = lutils.redis_cli(conf.redis)
var rc_pub = lutils.redis_cli(conf.redis)

var binlog = new Binlog({
  mysql: conf.mysql
})

binlog.start()

binlog.on('dbs', data => {
  rc_pub.publish(conf.dest, { a: 'dbs', o: data })
})
  
binlog.on('dbe', data => {
  rc_pub.publish(conf.dest, { a: 'dbe', o: data })
})

rc_sub.on('message', (channel, msg) => {
  try {
    msg = JSON.parse(msg)
  } catch(e) {
    console.error(e, msg)
    msg = null
  }

  if (!msg) return

  console.log('COMMAND', msg)
  handleCommand(msg)
})

var handleCommand = (msg) => {
  switch (msg.action) {
    case 'snap':
      binlog.snap.apply(binlog, msg.args)
    break
  }
}

rc_sub.subscribe('ulisse:' + conf.id)