const EventEmitter = require('events');

class ITMP extends EventEmitter {
  constructor(portname, props) {
    super();
    this.links = new Map();

    this.msgid = 0;

    this.transactions = new Map();
    this.subscriptions = new Map();

    this.pollsubs = new Map();
    this.urls = new Map();

    this.addCall('transactions', (args) => {
      const ret = [];
      for (const trid of this.transactions.keys()) {
        const tr = this.transactions.get(trid);
        ret.push({ id: trid, itmp: tr.msg[0], third: tr.msg[2] });
      }
      return ret;
    });

    this.addCall('subscriptions', (args) => {
      const ret = {};
      for (const sb of this.subscriptions.keys()) {
        ret[sb] = this.subscriptions.get(sb);
      }
      for (const sb of this.pollsubs.keys()) {
        ret[sb] = this.pollsubs.get(sb);
      }
      return ret;
    });
  }

  addLink(lnk) {
    const linkname = lnk.lnkname;
    this.links.set(linkname, lnk);
    lnk.process = (addr, data) => {
      if (typeof addr === 'undefined' || (typeof addr === 'string' && addr.length === 0)) {
        this.process(linkname, data);
      } else {
        this.process(`${linkname}/${addr}`, data);
      }
    };
  }
  deleteConnection(name) {
    this.links.delete(name);
  }

  processConnect(key, payload) {
    this.processConnect();
    const t = this.transactions.get(key);
    if (t !== undefined) {
      clearTimeout(t.timeout);
      this.transactions.delete(key);
      const [code, message] = payload;
      if (t.err !== undefined) {
        t.err(code, message);
      }
    } else {
      console.log('unexpected error', payload);
    }
  }

  processError(key, payload) {
    const t = this.transactions.get(key);
    if (t !== undefined) {
      clearTimeout(t.timeout);
      this.transactions.delete(key);
      const [code, message] = payload;
      if (t.err !== undefined) { t.err(code, message); }
    } else {
      console.log('unexpected error', payload);
    }
  }

  processCall(addr, id, payload) {
    const [uri, args, opts] = payload;
    if (uri === '') {
      const ret = {};
      for(let lnk of this.urls.keys()) {
        ret[lnk] = ': function';
      }
      for(let lnk of this.links.keys()) {
        ret[lnk] = '*';
      }
      this.answer(addr, [9, id, ret]);
    } else {
      const f = this.urls.get(uri);
      if (f !== undefined) {
        const ret = f.call(args, opts);
        this.answer(addr, [9, id, ret]);
      } else {
        const [link, subaddr, suburi = ''] = this.getLink(uri);
        if (link !== undefined) {
          if (link.call) {
            this.answer(addr, [9, id, link.call(subaddr, suburi)]);
          } else {
            this.transactionLink(link, subaddr, [8, 0, suburi, args, opts], (answerdata) => {
              this.answer(addr, [9, id, answerdata]);
            }, (errcode, errmsg) => {
              this.answer(addr, [5, id, errcode, errmsg]);
            });
          }
        } else {
          console.log(`unexpected call${JSON.stringify(payload)}`);
          this.answer(addr, [5, id, 404, 'no such uri']);
        }
      }
    }
  }
  processResult(key, payload) {
    const t = this.transactions.get(key);
    if (t !== undefined) {
      clearTimeout(t.timeout);
      this.transactions.delete(key);
      // if (typeof t.progress !== 'undefined'){} 
      const [result, properties] = payload;
      t.done(result, properties);
    } else {
      console.log('unexpected result', payload);// msg);
    }
  }
  processEvent(addr, payload) {
    // console.log("subscribed",msg);
    const [topic, args, ots] = payload;
    let used = false;
    const subskey = `${addr}/${topic}`;
    const subskeyParts = subskey.split('/');
    let subspath = subskeyParts[0];
    for (let k = 1; k < subskeyParts.length; k++) {
      const t = this.subscriptions.get(`${subspath}/*`);
      if (t !== undefined) {
        t.done(topic, args, ots);
        used = true;
      }
      subspath = `${subspath}/${subskeyParts[k]}`;
    }
    const t = this.subscriptions.get(subskey);
    if (t !== undefined) {
      used = true;
      t.done(topic, args, ots);
    } else if (!used) {
      console.log('unexpected result', payload);
    }
    if (!used) {
      this.emit('event', addr, topic, args, ots);
    }
  }
  processSubscribe(addr, id, payload) {
    // console.log("subscribу",msg);
    const [uri, opts] = payload;
    const f = this.urls.get(uri);
    if (f !== undefined && f.subscribe) {
      const s = { addr };
      const ret = f.subscribe(uri, opts, s);
      this.answer(addr, [17, id, ret]);
      this.pollsubs.set(uri, s);
    } else {
      const [link, subaddr, suburi = ''] = this.getLink(uri);
      if (link !== undefined) {
        if (link.subscribe) {
          link.subscribe(subaddr, suburi, opts, (answerdata) => {
            this.answer(addr, [17, id, answerdata]);
          }, (errcode, errmsg) => {
            this.answer(addr, [5, id, errcode, errmsg]);
          });
          this.pollsubs.set(`${link.lnkname}/${subaddr}/${suburi}`, { addr });
        }
      } else {
        console.log(`unexpected subs${JSON.stringify(payload)}`);
        this.answer(addr, [5, id, 404, 'no such uri']);
      }
    }
  }
  processDescribe(addr, id, payload) {
    const [uri, args, opts] = payload;
    if (uri === '') {
      this.answer(addr, [7, id, 'js root']);
    } else {
      const f = this.urls.get(uri);
      if (f !== undefined) {
        const ret = f.desription;
        this.answer(addr, [7, id, ret]);
      } else {
        const [link, subaddr, suburi = ''] = this.getLink(uri);
        if (link !== undefined) {
          this.transactionLink(link, subaddr, [6, 0, suburi, args, opts], (answerdata) => {
            this.answer(addr, [7, id, answerdata]);
          }, (errcode, errmsg) => {
            this.answer(addr, [5, id, errcode, errmsg]);
          });
        } else {
          console.log(`unexpected descr${JSON.stringify(payload)}`);
          this.answer(addr, [5, id, 404, 'no such uri']);
        }
      }
    }
  }

  processSubscribed(addr, key, id, payload) {
    const t = this.transactions.get(key);
    if (t !== undefined) {
      // const [ots] = payload;
      this.transactions.delete(key);
      clearTimeout(t.timeout);
      this.subscriptions.set(`${addr}/${t.msg[2]}`, { err: t.err, done: t.done });
      // t.done(msg.length >= 3 ? msg[2] : null); 
    } else {
      console.log('unexpected result', payload);
    }
  }

  processUnsubscribed(key, payload) {
    const t = this.transactions.get(key);
    if (t !== undefined) {
      clearTimeout(t.timeout);
      this.transactions.delete(key);
      if (t.done !== undefined) {
        const [id, opts] = payload;
        t.done(opts);
      }
    } else {
      console.log('unexpected result', payload);
    }
  }

  process(addr, msg) {
    if (Array.isArray(msg) && msg.length >= 1 && typeof msg[0] === 'number') {
      let [command, ...payload] = msg;
      let key;
      let id;
      if (msg.length >= 1 && typeof msg[1] === 'number') {
        [id, ...payload] = payload;
        key = `${addr}:${id}`;
      } else {
        key = `${addr}:`;
        id = '';
      }

      switch (command) {
        case 0: // [CONNECT, Connection:id, Realm:uri, Details:dict] open connection
          this.processConnect(key, payload);
          break;
        case 1: // [CONNECTED, CONNECT.Connection:id, Session:id, Details:dict] confirm connection
        case 2: // [ABORT, Code:integer, Reason:string, Details:dict] terminate connection
        case 4: // [DISCONNECT, Code:integer, Reason:string, Details:dict] clear finish connection
        case 5: // [ERROR, Request:id, Code:integer, Reason:string, Details:dict] error notificarion
          this.processError(key, payload);
          break;
        case 6: // [DESCRIBE, Request:id, Topic:uri, Options:dict] get description
          this.processDescribe(addr, id, payload);
          break;
        case 7: { // [DESCRIPTION, DESCRIBE.Request:id, description:list, Options:dict] response
          const t = this.transactions.get(key);
          if (t !== undefined) {
            clearTimeout(t.timeout);
            this.transactions.delete(key);
            const [result, properties] = payload;
            t.done(result, properties);
          } else {
            console.log('unexpected result', JSON.stringify(msg));
          }
          break;
        }
        // RPC
        case 8: // [CALL, Request:id, Procedure:uri, Arguments, Options:dict] call
          this.processCall(addr, id, payload);
          break;
        case 9: // [RESULT, CALL.Request:id, Result, Details:dict] call response
          this.processResult(key, payload);
          break;
        // RPC Extended
        case 10: // [ARGUMENTS, CALL.Request:id,ARGUMENTS.Sequuence:integer,Arguments,Options:dict]
          //  additional arguments for call
          break;
        case 11: // [PROGRESS, CALL.Request:id, PROGRESS.Sequuence:integer, Result, Details:dict] 
          //  call in progress
          break;
        case 12: // [CANCEL, CALL.Request:id, Details:dict] call cancel
          // publish
          break;
        case 13: // [EVENT, Request:id, Topic:uri, Arguments, Options:dict] event
          this.processEvent(addr, payload);
          break;
        case 14: // [PUBLISH, Request:id, Topic:uri, Arguments, Options:dict] event with acknowledge
          console.log('publish', msg);
          break;
        case 15: // [PUBLISHED, PUBLISH.Request:id, Publication:id, Options:dict] event acknowledged
          console.log('published', msg);
          break;
          // subscribe	
        case 16: // [SUBSCRIBE, Request:id, Topic:uri, Options:dict] subscribe
          this.processSubscribe(addr, id, payload);
          break;
        case 17: // [SUBSCRIBED, SUBSCRIBE.Request:id, Options:dict] subscription confirmed
          this.processSubscribed(addr, key, id, payload);
          break;
        case 18: // [UNSUBSCRIBE, Request:id, Topic:uri, Options:dict]
          console.log('unsubscribe', msg);
          break;
        case 20: // [UNSUBSCRIBED, UNSUBSCRIBE.Request:id, Options:dict]
          this.processUnsubscribed();
          break;
        // keep alive
        case 33: // [KEEP_ALIVE, Request:id, Options:dict] keep alive request
        case 34: // [KEEP_ALIVE_RESP, KEEP_ALIVE.Request:id, Options:dict] keep alive responce
        default:
      }
    } else {
      console.log('wrong message ', msg);
    }
  }

  answer(addr, msg, err) {
    let subaddr = '';
    let linkname = '';
    if (typeof addr === 'string') {
      const addrparts = addr.split('/', 2);
      if (Array.isArray(addrparts)) {
        linkname = addrparts[0];
        subaddr = addrparts[1];
      } else {
        linkname = addr;
      }
    }
    const link = this.links.get(linkname);
    if (typeof link !== 'object' && typeof err === 'function') {
      err(500, 'no link');
    }

    // let that = this;

    link.send(subaddr, msg);
    // var key = addr+":"+((typeof msg[1] === "number" ) ? msg[1] : "");
    // var timerId = setTimeout( (key)=>{ var prom = that.transactions.get(key); 
    // that.transactions.delete(key); prom.err("timeout");
    // }, 2000, key);
    // that.transactions.set(key, {'done':done, 'err':err, 'timeout':timerId, 'msg':msg} );
  }

  getLink(addr) {
    const [linkname, subaddr, uri] = addr.split('/', 3);
    const link = this.links.get(linkname);
    if (!link || !link.addressable) {
      if (uri) {
        return [link, undefined, `${subaddr}/${uri}`];
      }
      return [link, undefined, subaddr];
    }
    return [link, subaddr, uri];
  }

  transactionLink(link, subaddr = '', msg, done, err) {
    if (typeof link !== 'object') {
      err(500, 'no link found');
    }

    var that = this;
    if (typeof msg[1] === 'number') {
      msg[1] = this.msgid++;
    }

    link.send(subaddr, msg, done, err);
    const key = `${link.lnkname}/${subaddr}:${(typeof msg[1] === 'number') ? msg[1] : ''}`;
    const timerId = setTimeout((tkey) => {
      const prom = that.transactions.get(tkey); that.transactions.delete(tkey);
      if (typeof prom.err === 'function') {
        prom.err('timeout');
      }
    }, 2000, key);
    that.transactions.set(key, { done, err, timeout: timerId, msg });
  }

  transaction(addr, msg, done, err) {
    const [linkname, subaddr = ''] = addr.split('/', 2);
    const link = this.links.get(linkname);


    if (typeof link !== 'object') {
      if (typeof err === 'function') {
        err(500, 'no such link');
      }
      return;
    }
    if (typeof msg[1] === 'number') {
      msg[1] = this.msgid++;
    }

    link.send(subaddr, msg, done, err);
    const key = `${addr}:${(typeof msg[1] === 'number') ? msg[1] : ''}`;
    const timerId = setTimeout((tkey) => {
      const prom = this.transactions.get(tkey); this.transactions.delete(tkey);
      if (typeof prom.err === 'function') {
        prom.err(504, 'timeout');
      }
    }, 2000, key);
    this.transactions.set(key, { done, err, timeout: timerId, msg });
  }

  emitEvent(topic, msg) {
    const to = this.pollsubs.get(topic);
    if (to) {
      const [link, subaddr, uri = ''] = this.getLink(to.addr);
      if (typeof link !== 'object') {
        return;
      }
      const id = this.msgid++;

      link.send(subaddr, [13, id, topic, msg]);
    }
  }

  call(addr, name, param, done, err) {
    const msg = [8, 0, name, [param]];
    return this.transaction(addr, msg, done, err);
  }

  connect(addr, name, param, done, err) {
    const msg = [0, 0, name, [param]];
    return this.transaction(addr, msg, done, err);
  }

  describe(addr, name, done, err) {
    const msg = [6, 0, name];
    return this.transaction(addr, msg, done, err);
  }

  subscribe(addr, url, param, done, err) {
    const msg = [16, 0, url, param];
    return this.transaction(addr, msg, done, err);
  }

  unsubscribe(addr, url, param, done, err) {
    const subskey = `${addr}/${url}`;
    const t = this.subscriptions.get(subskey);
    if (t !== undefined) {
      this.subscriptions.delete(subskey);
      const msg = [18, 0, url, param];
      return this.transaction(addr, msg, done, err);
    }
    err(404, 'subscription not found');
  }
  addCall(name, func) {
    this.urls.set(name, { call: func });
  }

  addSubscribe(name, func) {
    this.urls.set(name, { subscribe: func });
  }

  queueSize(addr) {
    let subaddr = '';
    let linkname = '';
    if (typeof addr === 'string') {
      const addrparts = addr.split('/', 2);
      if (Array.isArray(addrparts)) {
        linkname = addrparts[0];
        subaddr = addrparts[1];
      } else {
        linkname = addr;
      }
    }
    const link = this.links.get(linkname);
    if (typeof link !== 'object') {
      return -1;
    }

    return link.queueSize(subaddr);
  }
}

module.exports = ITMP;
