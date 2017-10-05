//import SerialPort from 'serialport';
var SerialPort =require('serialport');
var ITMP = require('./ITMP.js');
var ITMPSerialLink = require('./seriallink');
var ITMPWsLink = require('./wslink.js' );
var ITMPWsServer = require('./ITMPWsServer.js' );
var mot823 =require('./mot823.js');

var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
app.use('/',express.static('public'));
app.ws('/ws', function(ws, req) {
  itmp.addLink(new ITMPWsServer(itmp, `ws:${req.ip}`, ws));
  console.log(`connected ws:${req.ip}`);
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});



SerialPort.list(function (err, ports) {
    ports.forEach(function(port) {
      console.log(port.comName+JSON.stringify(port));
      //console.log(port.manufacturer);
    });
  });

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
 
  //const WebSocket = require('ws');
  //var ws = new WebSocket('ws://localhost:8080/mws'); //'ws://www.host.com/path'
  function getvals(mot) {
//    let v = mot.call('stat',null, (data, opt) => { console.log("call: ",JSON.stringify(data),typeof opt==='undefined'?"":opt); });
let v1 = mot.stat((data) => { 
  //console.log("stat: ",JSON.stringify(data)); 
});
let v2 = mot.pos((data) => { 
  //console.log("stat: ",JSON.stringify(data)); 
});
}

var itmp = new ITMP();

itmp.addCall("links",(args)=>{
  let ret = [];
  for(let lnk of itmp.links.keys()) {
    ret.push(lnk);
  }
  return ret;
});


    itmp.addLink(new ITMPSerialLink(itmp, "com", "COM3"));
    itmp.addLink(new ITMPWsLink(itmp, "ws", 'ws://localhost:8080/mws?login=admin&password=admin'));

    itmp.addLink(new ITMPWsLink(itmp, "wsloop", 'ws://localhost:3000/ws?login=admin&password=admin'));
    
    //console.log (itmp.links);
    
    var m= new mot823(itmp,"com/1");

    async function demo() {
      
//    m.describe('to',(descr)=>{ console.log("to done: ",descr); }, (err)=>{console.log("to error: ",err); } );
    //await sleep(500);
//    m.describe('go',(descr)=>{ console.log("go done: ",descr); }, (err)=>{console.log("go error: ",err); } );  

//    itmp.describe("ws","go",(descr)=>{ console.log("ws done: ",descr); }, (err)=>{console.log("ws error: ",err); } ); 


    //itmp.subscribe("ws","item", {"id":1,"slot":""}, (name,data)=>{ console.log("ws event: ",name,JSON.stringify(data)); }, (err)=>{console.log("ws event error: ",err); } );

    //itmp.subscribe("ws","items/*", {}, (name,data)=>{ console.log("ws1 event: ",name,JSON.stringify(data)); }, (err)=>{console.log("ws1 event error: ",err); } );
    //itmp.subscribe("ws","items/2/time", {limit:10}, (name,data)=>{ console.log("ws2 event: ",name,JSON.stringify(data)); }, (err)=>{console.log("ws2 event error: ",err); } );
    
    itmp.on("event", (addr, url, data, opt) => { console.log("event: ",addr,url,JSON.stringify(data),typeof opt==='undefined'?"":opt); })
    //await sleep(1500);

    //itmp.unsubscribe("ws","items/2/time", {}, (data)=>{ console.log("ws2 unsevent: ", JSON.stringify(data)); }, (err)=>{console.log("ws2 unsevent error: ",err); } );

    var inter = setInterval(getvals,2000,m);
    

  }



demo();