class Tag
{
    constructor(ATQA, SAK, UID, ATS, transceiveFn)
    {
        this.ATQA = ATQA;
        this.SAK = SAK;
        this.UID = UID;
        this.ATS = ATS;
        this.Transceive = transceiveFn;
    }

    async Authenticate()
    {
        return false;
    }

    static Identify(ATQA, SAK, ATS)
    {
        return false;
    }
}

module.exports = Tag;
