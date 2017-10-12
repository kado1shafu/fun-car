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

        this.addCall("transactions",(args)=>{
            let ret = [];
            for(let trid of this.transactions.keys()) {
                let tr=this.transactions.get(trid);
                ret.push({id:trid,itmp:tr.msg[0],third:tr.msg[2]});
            }
            return ret;
          });

          this.addCall("subscriptions",(args)=>{
            let ret = {};
            for(let sb of this.subscriptions.keys()) {
              ret[sb]= this.subscriptions.get(sb);
            }
            for(let sb of this.pollsubs.keys()) {
                ret[sb]= this.pollsubs.get(sb);
              }
            return ret;
          });
                  
    }

    addLink(lnk) {
        var linkname=lnk.lnkname;
        var that = this;
        this.links.set(linkname, lnk);
        lnk.process = function(addr, data) {
            if (typeof addr === 'undefined' || (typeof addr === 'string' && addr.length === 0) ) {
                that.process(linkname, data);
            } else {
                that.process(linkname+"/"+addr, data);
            }
        }
    }
    deleteConnection(name){
        this.links.delete(name);

    }
    
    process(addr, msg) {
        if ( Array.isArray(msg) && msg.length >= 1 && typeof msg[0] === 'number' ) {
            let [command, ...payload] = msg;
            let key;
            let id;
            if ( msg.length >= 1 && typeof msg[1] === 'number' ) {
                [id, ...payload] = payload;
                key = addr+':'+id;
            } else {
                key=addr+':';
                id="";
            }
            
            switch (command) {
                case 0: {// [CONNECT, Connection:id, Realm:uri, Details:dict]	open connection
                    let t = this.transactions.get(key);
                    if (t !== undefined) { 
                        clearTimeout(t.timeout);
                        this.transactions.delete(key);
                        let [code, message] = payload;
                        if (t.err !== undefined) {t.err( code,message );} 
                    } else {
                        console.log('unexpected error',msg);
                    }
                break;
                }
                case 2: // [PARAMETERS, CONNECT.Connection:id, Details:dict]	privide additional parameters for proper connection
                case 1: // [CONNECTED, CONNECT.Connection:id, Session:id, Details:dict]	confirm connection
                case 2: // [ABORT, Code:integer, Reason:string, Details:dict]	terminate connection
                case 4: // [DISCONNECT, Code:integer, Reason:string, Details:dict]	clear finish connection
                //Error	
                case 5: {// [ERROR, Request:id, Code:integer, Reason:string, Details:dict]	error notificarion
                    let t = this.transactions.get(key);
                    if (t !== undefined) { 
                        clearTimeout(t.timeout);
                        this.transactions.delete(key);
                        let [code, message] = payload;
                        if (t.err !== undefined) {t.err( code,message );} 
                    } else {
                        console.log('unexpected error',msg);
                    }
                break;
                }
                //Description	
                case 6: { // [DESCRIBE, Request:id, Topic:uri, Options:dict]	get description
                    let [uri, args, opts] = payload;
                    var that = this;
                    if (uri === ""){
                        this.answer(addr,[7,id,"super puper"]);
                    } else {
                        let f=this.urls.get(uri);
                        if (f !== undefined) {
                            let ret = f.desription;
                            this.answer(addr,[7,id,ret]);
                        } else {
                            let [link, subaddr, suburi=""] = this.getLink(uri);
                            if (link !== undefined){
                                this.transactionLink(link,subaddr,[6,0,suburi,args,opts],(answerdata)=>{
                                    that.answer(addr,[7,id,answerdata])
                                }, (errcode,errmsg)=>{
                                    that.answer(addr,[5,id,errcode,errmsg]); 
                                });
                            } else {
                                console.log('unexpected descr'+JSON.stringify(payload));
                                this.answer(addr,[5,id,404,"no such uri"]);
                            }
                        }
                    }
                    break;
                }
                case 7: { // [DESCRIPTION, DESCRIBE.Request:id, description:list, Options:dict]	description response
                    let t = this.transactions.get(key);
                    if (t !== undefined) { 
                        clearTimeout(t.timeout); 
                        this.transactions.delete(key);
                        let [result, properties] = payload;
                        t.done(result, properties);
                    } else {
                        console.log('unexpected result',JSON.stringify(msg));
                    }
                    break;
                }
            //RPC	
                case 8: {// [CALL, Request:id, Procedure:uri, Arguments, Options:dict]	call
                    let [uri, args, opts] = payload;
                    var that = this;
                    if (uri === ""){
                        let ret = {};
                        for(let lnk of this.urls.keys()) {
                            ret[lnk] = ": function";
                        }
                        for(let lnk of this.links.keys()) {
                            ret[lnk] = "*";
                        }
                        this.answer(addr,[9,id,ret]);
                    } else {
                        let f=this.urls.get(uri);
                        if (f !== undefined) {
                            let ret = f.call(args,opts);
                            this.answer(addr,[9,id,ret]);
                        } else {
                            let [link, subaddr, suburi=""] = this.getLink(uri);
                            if (link !== undefined){
                                this.transactionLink(link,subaddr,[8,0,suburi,args,opts],(answerdata)=>{
                                    that.answer(addr,[9,id,answerdata])
                                }, (errcode,errmsg)=>{
                                    that.answer(addr,[5,id,errcode,errmsg]); 
                                });
                            } else {
                                console.log('unexpected call'+JSON.stringify(payload));
                                this.answer(addr,[5,id,404,"no such uri"]);
                            }
                        }
                    }
                    break;
                }
                case 9: {// [RESULT, CALL.Request:id, Result, Details:dict] call response
                    let t = this.transactions.get(key);
                    if (t !== undefined) { 
                        clearTimeout(t.timeout); 
                        this.transactions.delete(key);
                        //if (typeof t.progress !== 'undefined'){} 
                        let [result, properties] = payload;
                        t.done(result, properties);
                    } else {
                        console.log('unexpected result',msg);
                    }
                    break;
                }
                //RPC Extended	
                case 10: // [ARGUMENTS, CALL.Request:id, ARGUMENTS.Sequuence:integer, Arguments, Options:dict] additional arguments for call
                case 11: // [PROGRESS, CALL.Request:id, PROGRESS.Sequuence:integer, Result, Details:dict] call in progress
                case 12: // [CANCEL, CALL.Request:id, Details:dict]	call cancel
                //publish	
                case 13: { // [EVENT, Request:id, Topic:uri, Arguments, Options:dict]	event
                    //console.log("subscribed",msg);
                    let [topic, args, ots] = payload;
                    let used=false;
                    let subskey=addr+'/'+topic;
                    let subskeyParts=subskey.split("/");
                    let subspath=subskeyParts[0];
                    for (let k=1;k<subskeyParts.length;k++) {
                        let t = this.subscriptions.get(`${subspath}/*`);
                        if (t !== undefined) {
                            t.done(topic, args, ots); 
                            used=true;
                        }
                        subspath=subspath+"/"+subskeyParts[k];
                    }
                    let t = this.subscriptions.get(subskey);
                    if (t !== undefined) {
                        used=true;
                        t.done(topic, args, ots); 
                    } else if (!used) {
                        console.log('unexpected result',msg);
                    }
                    if (!used)
                        this.emit("event",addr, topic, args, ots);
                    break;
                }
                case 14: // [PUBLISH, Request:id, Topic:uri, Arguments, Options:dict]	event with acknowledge awaiting
                    console.log("publish",msg);
                    break;
                case 15: // [PUBLISHED, PUBLISH.Request:id, Publication:id, Options:dict]	event acknowledged
                    console.log("published",msg);
                    break;
                //subscribe	
                case 16: {// [SUBSCRIBE, Request:id, Topic:uri, Options:dict]	subscribe
                    console.log("subscribу",msg);
                    let [uri, opts] = payload;
                    let [link, subaddr, suburi=""] = this.getLink(uri);
                    if (link !== undefined){
                        link.subscribe(subaddr, suburi, opts,(answerdata)=>{
                            this.answer(addr,[17,id,answerdata])
                        }, (errcode,errmsg)=>{
                            this.answer(addr,[5,id,errcode,errmsg]); 
                        });
                        this.pollsubs.set(link.lnkname+"/"+subaddr+"/"+suburi,addr);
                    } else {
                        console.log('unexpected subs'+JSON.stringify(payload));
                        this.answer(addr,[5,id,404,"no such uri"]);
                    }
                break;
                }
                case 17: {// [SUBSCRIBED, SUBSCRIBE.Request:id, Options:dict]	subscription confirmed
                    let t = this.transactions.get(key);
                    if (t !== undefined) {
                        let [id, ots] = payload;
                        this.transactions.delete(key);
                        clearTimeout(t.timeout);
                        this.subscriptions.set(`${addr}/${t.msg[2]}`,{'err':t.err, 'done':t.done})
                        //t.done(msg.length >= 3 ? msg[2] : null); 
                    } else {
                        console.log('unexpected result',msg);
                    }
                    break;
                }
                case 18: {// [UNSUBSCRIBE, Request:id, Topic:uri, Options:dict]	
                    console.log("unsubscribe",msg);
                    break;
                }
                case 20: {// [UNSUBSCRIBED, UNSUBSCRIBE.Request:id, Options:dict]	
                    let t = this.transactions.get(key);
                    if (t !== undefined) { 
                        clearTimeout(t.timeout); 
                        this.transactions.delete(key);
                        if (t.done !== undefined) {
                            let [id, opts] = payload;
                            t.done(opts);
                        }
                    } else {
                        console.log('unexpected result',msg);
                    }
                    break;
                }
                //keep alive	
                case 33: // [KEEP_ALIVE, Request:id, Options:dict]	keep alive request
                case 34: // [KEEP_ALIVE_RESP, KEEP_ALIVE.Request:id, Options:dict]	keep alive responce                        }
            }
        } else {
            console.log('wrong message ',msg);
        }
    }

    answer(addr, msg) {
        var subaddr="";
        var linkname="";
        if (typeof addr === 'string') {
            var addrparts = addr.split('/',2);
            if (Array.isArray(addrparts)){
                linkname = addrparts[0];
                subaddr = addrparts[1];
            } else {
                linkname = addr;
            }
        }
        var link=this.links.get(linkname);
        if (typeof link !== 'object' && typeof err === 'function')
            err(500, "no link");

        var that = this;

        link.send(subaddr,msg);
        //var key = addr+":"+((typeof msg[1] === "number" ) ? msg[1] : "");
        //var timerId = setTimeout( (key)=>{ var prom = that.transactions.get(key); that.transactions.delete(key); prom.err("timeout"); }, 2000, key);
        //that.transactions.set(key, {'done':done, 'err':err, 'timeout':timerId, 'msg':msg} );
    }
    getLink(addr){
        var [linkname,subaddr,uri] = addr.split('/',3);
        var link=this.links.get(linkname);
        if (!link || !link.addressable) {
            if (uri) return [link,undefined,`${subaddr}/${uri}`];
            else return [link,undefined,subaddr];
        }
        return [link,subaddr,uri];
    }

    transactionLink(link,subaddr="", msg, done, err) {
        if (typeof link !== 'object')
            err(500,'no link found');

        var that = this;
        if (typeof msg[1] === "number"){
            msg[1] = this.msgid++;  
        }

        link.send(subaddr,msg,done,err);
        var key = link.lnkname+"/"+subaddr+":"+((typeof msg[1] === "number" ) ? msg[1] : "");
        var timerId = setTimeout( (key)=>{ var prom = that.transactions.get(key); that.transactions.delete(key); 
            if (typeof prom.err === 'function')
                prom.err("timeout"); 
        }, 2000, key);
        that.transactions.set(key, {'done':done, 'err':err, 'timeout':timerId, 'msg':msg} );
    }

    transaction(addr, msg, done, err) {
        let [linkname,subaddr = ""] = addr.split("/",2);
        var link=this.links.get(linkname);


        if (typeof link !== 'object') {
            if (typeof err === 'function')
                err(500,"no such link");
            return;
        }
        if (typeof msg[1] === "number"){
            msg[1] = this.msgid++;  
        }
        var that = this;

        link.send(subaddr,msg,done,err);
        var key = addr+":"+((typeof msg[1] === "number" ) ? msg[1] : "");
        var timerId = setTimeout( (key)=>{ var prom = that.transactions.get(key); that.transactions.delete(key); 
                if (typeof prom.err === 'function')
                prom.err(504,"timeout"); 
        }, 2000, key);
        that.transactions.set(key, {'done':done, 'err':err, 'timeout':timerId, 'msg':msg} );
    }

    emitEvent(topic, msg) {
        var to = this.pollsubs.get(topic);
        if (to) {
            var [link, subaddr, uri=""] = this.getLink(to);
            if (typeof link !== 'object') {
                return;
            }
            let id = this.msgid++;  
            var that = this;

            link.send(subaddr,[13,id,topic,msg]);//,done,err);
        }
    }

    call(addr, name, param, done, err) {
        var msg=[8,0,name,[param]];
        return this.transaction(addr,msg,done,err);
    }

    connect(addr, name, param, done, err) {
        var msg=[0,0,name,[param]];
        return this.transaction(addr,msg,done,err);
    }

    describe(addr,name,done,err) {
        var msg=[6,0,name];
        return this.transaction(addr,msg,done,err);
    }
    
    subscribe(addr, url, param, done, err){
        var msg=[16,0,url,param];
        return this.transaction(addr,msg,done,err);
    }

    unsubscribe(addr, url, param, done, err){
        let subskey=addr+'/'+url;
        let t = this.subscriptions.get(subskey);
        if (t !== undefined) {
            this.subscriptions.delete(subskey);
            var msg=[18,0,url,param];
            return this.transaction(addr,msg,done,err);
        } else {
            err(404,'subscription not found');
        }
    }
    addCall(name,func) {
        this.urls.set(name,{call:func});
    }
      
    queueSize(addr){
        var subaddr="";
        var linkname="";
        if (typeof addr === 'string') {
            var addrparts = addr.split('/',2);
            if (Array.isArray(addrparts)){
                linkname = addrparts[0];
                subaddr = addrparts[1];
            } else {
                linkname = addr;
            }
        }
        var link=this.links.get(linkname);
        if (typeof link !== 'object')
            return -1;

        var that = this;

        return link.queueSize(subaddr);
        
    }
}

module.exports = ITMP;