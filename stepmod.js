
class itmpnode {
    constructor(itmp, addr) {
        this.itmp = itmp;
        this.addr = addr;
    }
    describe(name, done, err) {
        return this.itmp.describe(this.addr, name, done, err);

    }

}

class SHEAD extends itmpnode {
    constructor(itmp, addr) {
        super(itmp, addr);
        var that = this;
        itmp.connect(addr,"",null,()=>{
            itmp.describe(addr,"",(description)=>{
                that.description = description;
            });
            that.ready = true;

        });
        itmp.describe(addr,"",(description)=>{
            that.description = description;
            if (Array.isArray(description)) {
                that.links = [];
                for(let lnk of description) {
                    that.links.push(lnk);
                  }
            }
        });
}
    processstatus(data, done) {
        this.cur = data[0];
        this.target = data[1];
        this.sp = data[2]; 

        if (typeof done === 'function')
            done({cur:this.cur,target:this.target,sp:this.sp});
    }
    call(name,param,done,err) {
        this.itmp.call(this.addr, name, param, done,err);
    }
    stat(id, done,err) {
        this.itmp.call(this.addr, id, null, (data)=>{ 
            done({cur:data[0],target:data[1],sp:data[2]}); 
        },err);
    }
    goto (id, pos,sp, done,err) {
        var that = this;
        this.itmp.call(this.addr, id, [pos,sp], (data) => {that.processstatus(data,done);} );
    }
}

/*
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();
myEmitter.on('event', () => {
  console.log('an event occurred!');
});
myEmitter.emit('event');
*/

module.exports = SHEAD;