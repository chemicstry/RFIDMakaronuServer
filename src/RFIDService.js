const EventInterface = require('./EventInterface.js');
const TagFactory = require('./TagFactory.js');
const Log = require('./Log.js');

const TAG_TRANSCEIVE_TIMEOUT = 1000;

class RFIDService
{
    constructor(eventInterface)
    {
        this.eventInterface = eventInterface;

        this.eventInterface.on("RFIDService_NewTarget", this.OnNewTarget.bind(this));

        this.transceiveReqItr = 0; // Transceive request iterator
        this.transceivePromises = [];
        this.eventInterface.on("RFIDService_TagTransceive", this.OnTagTransceive.bind(this));
    }

    async TagTransceive(buf)
    {
        // Get new transceive id (to match incoming )
        var id = this.transceiveReqItr++;

        this.eventInterface.Send("RFIDService_TagTransceive", {
            id: id,
            data: buf.toString('hex')
        });

        return new Promise((resolve, reject) => {
            // Create timeout in case transceive gets stuck
            var timeout = setTimeout(() => {
                Log.error("RFIDService::TagTransceive(): request timed out");
                reject("Transceive timeout");
            }, TAG_TRANSCEIVE_TIMEOUT);

            // Create callback function to resolve promise
            this.transceivePromises[id] = {
                reject: reject,
                resolve: (buf) => {
                    delete this.transceivePromises[id];
                    clearTimeout(timeout);
                    resolve(buf);
                }
            };
        })
    }

    OnTagTransceive(args)
    {
        var id = args.id;

        if (!this.transceivePromises[id])
            return Log.error("RFIDService::OnTagTransceive(): Promise not found", {id});
        
        if (args.error)
        {
            this.transceivePromises[id].reject(args.error);
            Log.error("RFIDService::OnTagTransceive(): Failed", {id, error});
            return;
        }

        // Resolve promise
        this.transceivePromises[id].resolve(Buffer.from(args.data, 'hex'));
    }

    async OnNewTarget(args)
    {
        Log.debug("RFIDService::OnNewTarget()", args);

        const UID = Buffer.from(args.UID, 'hex');
        const ATS = Buffer.from(args.ATS, 'hex');

        var TagClass;

        try {
            TagClass = TagFactory.Identify(args.ATQA, args.SAK, ATS);
        } catch (e) {
            return Log.error("RFIDService::OnNewTarget(): Identify failed.", {TagClass});
        }
        
        // Initialize tag
        var tag = new TagClass(args.ATQA, args.SAK, UID, ATS, (buf) => this.TagTransceive(buf));

        // Authenticate
        var res = await tag.Authenticate();

        if (res)
            Log.info("RFIDService::OnNewTarget(): Authentication success!");
        else
            Log.error("RFIDService::OnNewTarget(): Authentication FAILED!");

        // Release target
        this.eventInterface.Send("RFIDService_ReleaseTarget", {});
    }
}

module.exports = RFIDService;
