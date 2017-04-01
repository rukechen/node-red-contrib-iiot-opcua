/*
 The BSD 3-Clause License

 Copyright 2016,2017 - Klaus Landsdorf (http://bianco-royal.de/)
 Copyright 2015,2016 - Mika Karaila, Valmet Automation Inc. (node-red-contrib-opcua)
 All rights reserved.
 node-red-iiot-opcua
 */
'use strict'

module.exports = function (RED) {
  let coreConnector = require('./core/opcua-iiot-core-connector')

  function OPCUAIIoTConnectorConfiguration (config) {
    const CONNECTION_START_DELAY = 2000 // 2 sec.
    const UNLIMITED_LISTENERS = 0

    RED.nodes.createNode(this, config)
    this.endpoint = config.endpoint
    this.loginEnabled = config.loginEnabled
    this.name = config.name
    this.credentials = config.credentials

    let node = this
    node.client = null
    node.userIdentity = {}

    if (node.credentials && node.loginEnabled) {
      node.userIdentity.userName = node.credentials.user
      node.userIdentity.password = node.credentials.password
      coreConnector.internalDebugLog('connecting with login data on ' + node.endpoint)
    }

    node.connectOPCUAEndpoint = function () {
      coreConnector.internalDebugLog('connecting on ' + node.endpoint)
      node.session = null
      node.opcuaClient = null
      coreConnector.connect(node.endpoint).then(function (opcuaClient) {
        coreConnector.internalDebugLog('connected on ' + node.endpoint)
        node.opcuaClient = opcuaClient
        node.emit('connected', node.opcuaClient)
      }).catch(node.handleError)
    }

    node.startSession = function (timeoutSeconds) {
      coreConnector.internalDebugLog('request for new session')
      return new Promise(
        function (resolve, reject) {
          coreConnector.createSession(node.opcuaClient, node.userIdentity).then(function (session) {
            coreConnector.internalDebugLog('starting session on ' + node.endpoint)
            session.timeout = coreConnector.core.calcMillisecondsByTimeAndUnit(timeoutSeconds || 10, 's')
            session.startKeepAliveManager()
            session.on('error', node.handleError)
            resolve(session)
            coreConnector.internalDebugLog('session started on ' + node.endpoint)
          }).catch(reject)
        })
    }

    node.closeSession = function (done) {
      if (node.session) {
        coreConnector.internalDebugLog('close Session Id: ' + node.session.sessionId)
        coreConnector.closeSession(node.session).then(function (done) {
          coreConnector.internalDebugLog('sucessfully closed for reconnect on ' + node.endpoint)
          done()
        }).catch(done)
      } else {
        coreConnector.internalDebugLog('No Session To Close' + node.endpoint)
        done()
      }
    }

    node.handleError = function (err) {
      if (err) {
        node.error(err, {payload: 'Connector Error'})
      } else {
        coreConnector.internalDebugLog('Error on ' + node.endpoint)
      }
    }

    node.setMaxListeners(UNLIMITED_LISTENERS)
    setTimeout(node.connectOPCUAEndpoint, CONNECTION_START_DELAY)

    node.on('close', function (done) {
      node.closeSession(done)
    })
  }

  RED.nodes.registerType('OPCUA-IIoT-Connector', OPCUAIIoTConnectorConfiguration, {
    credentials: {
      user: {type: 'text'},
      password: {type: 'password'}
    }
  })

  // SecurityPolicy enum via REST
}
