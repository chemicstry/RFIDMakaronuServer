const EventInterface = require('./EventInterface.js');
const RFIDService = require('./RFIDService.js');
const Log = require('./Log.js');

class WebsocketService
{
    constructor(dataInterface)
    {
        this.dataInterface = dataInterface;
        this.eventInterface = new EventInterface(dataInterface);

        this.rfidService = new RFIDService(this.eventInterface);

        // Send server hello
        this.eventInterface.Send("hello", {});
        this.eventInterface.on("hello", this.OnHello.bind(this));
    }

    OnHello(args)
    {
        Log.info("WebsocketService::OnHello(): Client hello", {args});
    }
}

module.exports = WebsocketService;
