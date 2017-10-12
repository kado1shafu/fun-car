//import SerialPort from 'serialport';
var SerialPort =require('serialport');
var ITMP = require('./ITMP.js');
var ITMPSerialLink = require('./seriallink');
var ITMPWsLink = require('./wslink.js' );
var ITMPWsServer = require('./ITMPWsServer.js' );
var mot823 = require('./mot823.js');
var SHEAD = require('./stepmod.js');

var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var bodyParser = require('body-parser');

app.use('/',express.static('public'));
app.ws('/ws', function(ws, req) {
  if (req.connection.remoteFamily==='IPv6') {
    itmp.addLink(new ITMPWsServer(itmp, `ws:[${req.connection.remoteAddress}]:${req.connection.remotePort}`, ws));
  } else {
    itmp.addLink(new ITMPWsServer(itmp, `ws:${req.connection.remoteAddress}:${req.connection.remotePort}`, ws));
  }
  console.log(`connected ws:${req.ip}`);
});

var server = app.listen(3000, function () {
  console.log(`App listening on address '${server.address().address}' and port ${server.address().port}`);
});
/*app.get('/index.htm', function (req, res) {
  res.sendFile( __dirname + "/" + "index.htm" );
})*/

app.get('/process_get', function (req, res) {
  // Prepare output in JSON format
  response = {
     first_name:req.query.first_name,
     last_name:req.query.last_name
  };
  console.log(response);
  res.end(JSON.stringify(response));
})

// Create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.post('/process_post', urlencodedParser, function (req, res) {
  // Prepare output in JSON format
  response = {
     first_name:req.body.first_name,
     last_name:req.body.last_name
  };
  console.log(response);
  res.end(JSON.stringify(response));
})


SerialPort.list(function (err, ports) {
    ports.forEach(function(port) {
      console.log(port.comName+JSON.stringify(port));
      //console.log(port.manufacturer);
    });
  });

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
 
  var iteration = 0;
  //const WebSocket = require('ws');
  //var ws = new WebSocket('ws://localhost:8080/mws'); //'ws://www.host.com/path'
  function getvals(m) {
//    let v = mot.call('stat',null, (data, opt) => { console.log("call: ",JSON.stringify(data),typeof opt==='undefined'?"":opt); });
let v1 = m.stat((data) => { 
  console.log("m stat: ",JSON.stringify(data)); 
}, (code,txt)=> {
  console.log("m err: ",code, " ", JSON.stringify(txt)); 
});
  iteration++;

  if ( (iteration % 10) == 2) {
    m.goto(2000);
  }
  if ( (iteration % 10) == 6) {
    m.goto(6000);
  }
//let v2 = m.pos((data) => { 
  //console.log("stat: ",JSON.stringify(data)); 
//});
}

var itmp = new ITMP();

itmp.addCall("links",(args)=>{
  let ret = [];
  for(let lnk of itmp.links.keys()) {
    ret.push(lnk);
  }
  return ret;
});


    itmp.addLink(new ITMPSerialLink(itmp, "com", "COM4"));
    itmp.addLink(new ITMPWsLink(itmp, "ws", 'ws://localhost:8080/mws?login=admin&password=admin'));

    itmp.addLink(new ITMPWsLink(itmp, "wsloop", 'ws://localhost:3000/ws?login=admin&password=admin'));
    
    //console.log (itmp.links);
    
    //var m= new mot823(itmp,"com/1");
    var m=new SHEAD(itmp,"com/3");


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