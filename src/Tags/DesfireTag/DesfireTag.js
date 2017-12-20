const Tag = require('../../Tag.js');
const Log = require('../../Log.js');
const crypto = require('crypto');

// Unique desfire AID used in select file ISO7816-4 instruction
const DESFIRE_AID = Buffer.from('D2760000850100', 'hex');

// Status codes
const DF_STATUS_OPERATION_OK = 0x00;
const DF_STATUS_ADDITIONAL_FRAME = 0xAF;

// Instructions
const DF_INS_ADDITIONAL_FRAME = 0xAF;
const DFEV1_INS_AUTHENTICATE_AES = 0xAA;

const testkey = Buffer.from('00102030405060708090A0B0B0A09080', 'hex');

function RotateBuffer(data)
{
    return Buffer.concat([data.slice(1), data.slice(0, 1)]);
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

class DesfireTag extends Tag
{
    constructor(ATQA, SAK, UID, ATS, transceiveFn)
    {
        super(ATQA, SAK, UID, ATS, transceiveFn);

        this.IV = Buffer.alloc(16);
        this.Connected = false;
    }

    AESEncrypt(plaintext, key) {
        var cipher = crypto.createCipheriv('aes-128-cbc', key, this.IV);
        cipher.setAutoPadding(false);
        var enc = cipher.update(plaintext);
        var final = cipher.final();
        enc = Buffer.concat([enc, final]);
        this.IV = enc.slice(enc.length-16, enc.length);
        return enc;
    }
     
    AESDecrypt(ciphertext, key){
        var decipher = crypto.createDecipheriv('aes-128-cbc', key, this.IV);
        decipher.setAutoPadding(false);
        var dec = decipher.update(ciphertext);
        var final = decipher.final();
        this.IV = ciphertext.slice(ciphertext.length-16, ciphertext.length);
        return Buffer.concat([dec, final]);
    }

    static Identify(ATQA, SAK, ATS)
    {
        // Desfire footprint
        if (ATQA[0] == 0x03 && ATQA[1] == 0x44 && SAK == 0x20 && !(Buffer.from("7577810280", 'hex').compare(ATS)))
            return true;
        else
            return false;
    }

    async DesfireTransceive(instruction, data, CLA, P1, P2)
    {
        // Build ISO7816_4_CAPDU packet
        var buf = Buffer.alloc(6+data.length);
        buf.writeUInt8(CLA !== undefined ? CLA : 0x90, 0); // CLA
        buf.writeUInt8(instruction, 1); // INS
        buf.writeUInt8(P1 !== undefined ? P1 : 0x00, 2); // P1
        buf.writeUInt8(P2 !== undefined ? P2 : 0x00, 3); // P2
        buf.writeUInt8(data.length, 4); // Lc
        data.copy(buf, 5); // Data
        buf.writeUInt8(0x00, 5+data.length); // Le

        Log.verbose("DesfireTag::DesfireTransceive(): Sent", buf.toString('hex'));

        // Transceive with card
        buf = await this.Transceive(buf);

        Log.verbose("DesfireTag::DesfireTransceive(): Received", buf.toString('hex'));

        if (buf.length < 2)
            throw new Error("DesfireTag::DesfireTransceive(): Wrong response size");

        // Parse ISO7816_4_RAPDU packet
        var data = buf.slice(0, buf.length-2);
        var SW1 = buf.readUInt8(buf.length-2);
        var SW2 = buf.readUInt8(buf.length-1);

        if (SW2 != DF_STATUS_OPERATION_OK && SW2 != DF_STATUS_ADDITIONAL_FRAME)
            throw new Error("DesfireTag::DesfireTransceive(): Bad response status code " + SW2);
        
        return data;
    }

    // Should (theoretically must) be called before issuing any desfire commands
    async Connect()
    {
        try {
            // INS 0xA4 SELECT_FILE
            // CLA 0x00 ISO7816_4_CLA_WITHOUT_SM_LAST
            // P1 0x04
            await this.DesfireTransceive(0xA4, DESFIRE_AID, 0x00, 0x04);
        } catch (e) {
            Log.debug("DesfireTag::Connect(): Transceive failed", {e});
            console.log(e);
            this.Connected = false;
            return false;
        }

        Log.debug("DesfireTag::Connect(): Connected.");

        this.Connected = true;
        return true;
    }

    async Authenticate()
    {
        // Master key
        const keyno = 0;

        // Reset IV
        this.IV.fill(0x00);

        // Make sure tag is connected
        if (!this.Connected)
            if (!await this.Connect())
                return false;
    
        // write keyno as payload
        var AuthBuf = Buffer.alloc(1);
        AuthBuf.writeUInt8(keyno, 0);

        // Initiate auth with tag and receive RndB (encrypted)
        var RndBEnc;
        try {
            RndBEnc = await this.DesfireTransceive(DFEV1_INS_AUTHENTICATE_AES, AuthBuf);
        } catch (e) {
            Log.error("DesfireTag::Authenticate(): Authentication request failed", {e});
            return false;
        }

        // Decrypt RndB
        const RndB = this.AESDecrypt(RndBEnc, testkey);

        // Rotate RndB
        const RndBRot = RotateBuffer(RndB);

        // Generate RndA
        var RndA = Buffer(RndB.length);
        for (var i = 0; i < RndA.length; ++i)
            RndA[i] = getRandomIntInclusive(0, 255);
        
        // Build authentication token
        var Token = Buffer.alloc(RndBRot.length + RndA.length);
        RndA.copy(Token, 0);
        RndBRot.copy(Token, RndA.length);

        // Encrypt authentication token
        const TokenEnc = this.AESEncrypt(Token, testkey);

        // Continue auth by sending token and receiving RndARot (encrypted)
        var RndARotEnc;
        try {
            RndARotEnc = await this.DesfireTransceive(DF_INS_ADDITIONAL_FRAME, TokenEnc);
        } catch (e) {
            Log.error("DesfireTag::Authenticate(): Authentication with token failed", {e});
            return false;
        }

        // Decrypt RndARot
        const RndARot = this.AESDecrypt(RndARotEnc, testkey);

        // Build local RndARot
        const RndARotLocal = RotateBuffer(RndA);

        // Check if buffers match
        if (!RndARot.compare(RndARotLocal))
            return true;
        else
            return false;
    }
}

module.exports = DesfireTag;
