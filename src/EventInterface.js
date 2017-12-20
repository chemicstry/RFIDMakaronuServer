const { EventEmitter } = require("events");

class EventInterface extends EventEmitter
{
    constructor(dataInterface) {
        super();
        this.dataInterface = dataInterface;
        this.dataInterface.SetCb(data => {
            this.emit(data.event, data.args);
        })
    }

    Send(event, args = {}) {
        this.dataInterface.Send({
            event,
            args
        });
    }
}

module.exports = EventInterface;
