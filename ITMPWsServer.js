class ITMPWsServer {
  constructor(itmp, name, ws) {
    this.lnkname = name;
    this.ws = ws;
    this.msgqueue = [];

    this.ready = true;

    this.process = itmp.process;

    // Open errors will be emitted as an error event
    this.ws.on('error', (err) => {
      console.log('Error: ', err.message);
    });

    this.ws.on('open', () => {
      console.log('opened');
    });
    this.ws.on('message', (message) => {
      this.income(message);
    });
    this.ws.on('open', () => {
      // open logic
      // itmp.connect();
      this.ready = true; // port opened flag
      while (this.msgqueue.length > 0) {
        const [addr, binmsg] = this.msgqueue.shift();
        this.send(addr, binmsg);
      }
    });
    this.ws.on('close', (code, reason) => {
      console.log('closed ', code, reason);
      this.ready = false;
      itmp.deleteConnection(this.lnkname);
    });
  }

  income(message) {
    const addr = '';
    const msg = JSON.parse(message);
    if (typeof this.process === 'function') {
      this.process(addr, msg);
    }
  }

  send(addr, binmsg) {
    if (this.ready) {
      try {
        this.ws.send(JSON.stringify(binmsg));
      } catch (err) {}
    } else {
      this.msgqueue.push([addr, binmsg]);
    }
  }

  queueSize() {
    return this.msgqueue.length;
  }
}

module.exports = ITMPWsServer;
