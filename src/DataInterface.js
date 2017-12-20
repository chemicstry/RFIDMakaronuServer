class DataInterface {
    constructor(rxcb, txcb) {
        this.rxcb = rxcb;
        this.txcb = txcb;
    }

    SetCb(rxcb)
    {
        // Hack to pass by reference
        this.rxcb[0] = rxcb;
    }

    Send(data)
    {
        if (this.txcb[0])
            this.txcb[0](data);
    }
}

class BidirectionalDataInterface {
    constructor() {
        this.upstreamcb = [];
        this.downstreamcb = [];
        this.Downstream = new DataInterface(this.downstreamcb, this.upstreamcb);
        this.Upstream = new DataInterface(this.upstreamcb, this.downstreamcb);
    }
}

module.exports = {
    DataInterface,
    BidirectionalDataInterface,
};
