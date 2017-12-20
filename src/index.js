const WebSocket = require('ws');
const { BidirectionalDataInterface } = require('./DataInterface.js');
const WebsocketService = require('./WebsocketService.js');
const Log = require('./Log.js');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
    Log.info("index: New websocket connection");

    var bif = new BidirectionalDataInterface();
    bif.Upstream.SetCb(data => {
        ws.send(JSON.stringify(data));
    });
    
    ws.on('message', function incoming(message) {
        bif.Upstream.Send(JSON.parse(message));
    });

    var svcMgr = new WebsocketService(bif.Downstream);
});

process.on('unhandledRejection', (reason, p) => {
    Log.error("Unhandled promise rejection");
    console.log(reason);
    console.log(p);
});
