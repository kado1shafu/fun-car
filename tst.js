//import SerialPort from 'serialport';
var SerialPort =require('serialport');
var ITMP = require('./ITMP.js');
var ITMPSerialLink = require('./seriallink');
var ITMPWsLink = require('./wslink.js' );
var ITMPWsServer = require('./ITMPWsServer.js' );
var mot823 = require('./mot823.js');
var SHEAD = require('./stepmod.js');
var os = require('os');

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
  iteration++;

  if ( (iteration % 10) == 2) {
    m.goto("mot1/go",200,9400,(data) => { 
      console.log("4 stat: ",JSON.stringify(data)); 
    });
  } else if ( (iteration % 10) == 6) {
    m.goto("mot1/go",4900,18000,(data) => { 
      console.log("6 stat: ",JSON.stringify(data)); 
    });
  } else {
    let v1 = m.stat("mot1/pos",(data) => { 
      console.log("m stat: ",JSON.stringify(data)); 
    }, (code,txt)=> {
      console.log("m err: ",code, " ", JSON.stringify(txt)); 
    });
 }

 if ( (iteration % 15) == 2) {
  m.goto("mot2/go",200,5000, (data) => { 
    console.log("4 stat: ",JSON.stringify(data)); 
  });
} else if ( (iteration % 15) == 8) {
  m.goto("mot2/go",16000, 10000, (data) => { 
    console.log("6 stat: ",JSON.stringify(data)); 
  });
} else {
  let v1 = m.stat("mot2/pos",(data) => { 
    console.log("m stat: ",JSON.stringify(data)); 
  }, (code,txt)=> {
    console.log("m err: ",code, " ", JSON.stringify(txt)); 
  });
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

var lastCPU;

itmp.addSubscribe("stat",(args,opts,s)=>{
  var inter = setInterval(()=>{ 
    let cp= os.cpus();
    lastCPU = process.cpuUsage(lastCPU);
    itmp.emitEvent("stat", {Vin:13.6,cpu:cp[0].speed,mem:os.totalmem(),freemem:os.freemem(),up:os.uptime(),usage:lastCPU}); 
  }, 1000, args);
  s.timer=inter;
});

itmp.addCall("position",(args)=>{
  console.log(Date.now() / 1000,"p:",JSON.stringify(args));
  mot1.setpower(Math.round(args[0]*5-args[1]*10),Math.round(args[0]*5+args[1]*10));
});

itmp.addCall("arm",(args)=>{
  console.log(Date.now() / 1000,"a:",JSON.stringify(args));
  mot2.setpower(Math.round(args[1]*30),Math.round(args[0]*30));
});
  

    itmp.addLink(new ITMPSerialLink(itmp, "com", "COM4"));
    itmp.addLink(new ITMPSerialLink(itmp, "com2", "COM5"));
    itmp.addLink(new ITMPWsLink(itmp, "ws", 'ws://localhost:8080/mws?login=admin&password=admin'));

    itmp.addLink(new ITMPWsLink(itmp, "wsloop", 'ws://localhost:3000/ws?login=admin&password=admin'));
    
    //console.log (itmp.links);
    
    var mot1 = new mot823(itmp,"com2/1");
    var mot2 = new mot823(itmp,"com2/4");
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

    var inter = setInterval(getvals,300,m);
    

  }



demo();