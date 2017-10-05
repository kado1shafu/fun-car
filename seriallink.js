var SerialPort =require('serialport');
var crc8 =require('./crc8');
var cbor = require('cbor');

class ITMPSerialLink {
    constructor(processFrame, name, portname, props) {
        var that = this;
        this.lnkname=name;
        props = props || { baudRate: 115200 };
        this.port = new SerialPort(portname, props, function (err) {
            if (err) {
                return console.log('Open Error: ', err.message);
            }
        });

        this.process = processFrame; // callback to process incoming frames

        // incoming messages encoding
        this.inbuf = Buffer.allocUnsafe(1024); // buffer for incoming bytes
        this.inpos = 0; // number of received bytes (inbuf position)
        this.lastchar=0; // code of last received char =0 means no special character
        this.incrc = 0xFF; // current crc calculation

        this.ready = false; // port opened flag
        this.busy = false; // bus busy flag
        this.timerId = null; // timeout timer id

        this.cur_addr = 0; // current transaction address
        this.cur_buf = Buffer.allocUnsafe(1024);
        this.msgqueue = [];
        
        // Open errors will be emitted as an error event
        this.port.on('error', function(err) {
            console.log('Error: ', err.message);
        });
        this.port.on('data', function(data) { 
            that.income(data);
        });
        this.port.on('open', function() { // open logic
            that.ready = true; // port opened flag
          });
    }

    income(data) {
        for (var i=0;i<data.length;i++){
            if (this.lastchar === 0x7D) {
                this.inbuf[this.inpos]=data[i]^0x20;
                this.incrc = crc8.docrc8(this.incrc,this.inbuf[this.inpos]);
                this.inpos++;
                this.lastchar = 0;
            } else if (data[i] === 0x7D) {
                this.lastchar = 0x7D;
            } else if (data[i] === 0x7E) {
                if (this.inpos>2 && this.incrc === 0/*this.inbuf[this.inpos-1]*/ ) {
                    let addr = this.inbuf[0];

                    if (typeof this.process === "function") {
                        let msg=cbor.decode(this.inbuf.slice(1,this.inpos-1));
                        this.process(addr,msg);
                    }
            
                    this.lastchar = 0;
                    this.inpos = 0;
                    this.incrc = 0xFF;
                    this.nexttransaction();
                }
            } else {
                this.inbuf[this.inpos]=data[i];
                this.incrc = crc8.docrc8(this.incrc,this.inbuf[this.inpos]);
                this.inpos++;
            }
        }
    }

    nexttransaction() {
        var that = this;
        if (this.msgqueue.length > 0) {
            var [addr,msg] = this.msgqueue.shift();
            this.cur_addr = addr;
            clearTimeout ( this.timerId );
            this.timerId = setTimeout(() => { that.timeisout(); },1000);
            this.internalsend(addr, msg);
        } else {
            this.cur_addr = 0;
            if (this.busy) {
                this.busy = false;
                clearTimeout ( this.timerId );
            } else {
                console.log('message written');      
            }
        }
    }
    
    timeisout(){
        if (typeof this.cur_err === 'function') {
            this.cur_err("timeout");
        }
        this.nexttransaction();
    }

    send(addr, msg) {
        var binmsg=cbor.encode(msg);
        
        var that = this;

        if (this.busy) {
            this.msgqueue.push([addr,binmsg]);
        } else {
            this.busy = true;
            this.cur_addr = addr;
            this.timerId = setTimeout(() => { that.timeisout(); },1000); 
            this.internalsend(addr, binmsg);
        }
    }
    
    internalsend(addr, binmsg) {
        if (this.cur_buf.length < binmsg.length * 2  ) {
            this.cur_buf = Buffer.allocUnsafe( binmsg.length * 2 );
        }
        
        let crc = 0xFF;
        this.cur_buf[0] = 0x7E;
        this.cur_buf[1] = addr; // address
        crc = crc8.docrc8(crc, this.cur_buf[1] );

        var pos=2;
        for (var i=0;i<binmsg.length;i++){
            crc = crc8.docrc8(crc,binmsg[i]);
            if (binmsg[i]===0x7E  || binmsg[i]===0x7D ) {
                this.cur_buf[pos]=0x7D;
                this.cur_buf[pos+1]=binmsg[i]^0x20;
                pos=pos+2;
            } else {
                this.cur_buf[pos]=binmsg[i];
                pos++;
            }
        }
        if (crc===0x7E  || crc===0x7D ) {
            this.cur_buf[pos]=0x7D;
            this.cur_buf[pos+1]=crc^0x20;
            pos=pos+2;
        } else {
            this.cur_buf[pos]=crc;
            pos++;
        }

        this.cur_buf[pos]=0x7E;
        let sndbuf = this.cur_buf.slice(0, pos+1);

        this.port.write(sndbuf, function(errdt) {
        if (errdt) {
            console.log('Error on write: ', err.message);
        }
        
        //console.log('message written');
        });
//    var timerId = setTimeout( (key)=>{ var prom = that.transactions.get(key); that.transactions.delete(key); prom.err("timeout"); }, 2000, key);
    }
    queueSize(addr){
        return this.msgqueue.length;
    }

}

module.exports = ITMPSerialLink;