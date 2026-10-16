function asArray(value) {
  return Array.isArray(value) ? value.filter((x) => x && typeof x === 'object') : [];
}
function getId(item) { return typeof item.id === 'string' ? item.id : null; }
function mergeEntityArrays(baseValue, clientValue, serverValue) {
  const base=asArray(baseValue), client=asArray(clientValue), server=asArray(serverValue);
  const bm=new Map(), cm=new Map(), sm=new Map();
  for(const x of base){const id=getId(x); if(id) bm.set(id,x)}
  for(const x of client){const id=getId(x); if(id) cm.set(id,x)}
  for(const x of server){const id=getId(x); if(id) sm.set(id,x)}
  const ids=new Set([...bm.keys(),...cm.keys(),...sm.keys()]);
  const out=[];
  for(const id of ids){
    const b=bm.get(id), c=cm.get(id), s=sm.get(id);
    const ce=cm.has(id), se=sm.has(id), be=bm.has(id);
    if(!be&&ce&&!se){out.push(c);continue}
    if(!be&&!ce&&se){out.push(s);continue}
    if(!be){if(ce)out.push(c);else if(se)out.push(s);continue}
    const cc=JSON.stringify(c??null)!==JSON.stringify(b??null);
    const sc=JSON.stringify(s??null)!==JSON.stringify(b??null);
    if(cc&&!sc){if(ce)out.push(c);continue}
    if(!cc&&sc){if(se)out.push(s);continue}
    if(!cc&&!sc){if(se)out.push(s);else if(ce)out.push(c);continue}
    // Server wins concurrent edits; a server deletion must not be resurrected.
    if(se)out.push(s);
  }
  return out;
}
function ids(xs){return xs.map(x=>x.id).sort()}
function assert(name, ok){if(!ok) throw new Error('FAIL: '+name); console.log('PASS:',name)}
const A={id:'A',v:1}, B={id:'B',v:2}, C={id:'C',v:3};
assert('baseline retained', ids(mergeEntityArrays([A],[A],[A])).join()==='A');
assert('client deletion propagates', ids(mergeEntityArrays([A],[],[A])).length===0);
assert('server edit beats stale client', mergeEntityArrays([A],[A], [{id:'A',v:9}])[0].v===9);
assert('independent client addition preserved', ids(mergeEntityArrays([A],[A,B],[A])).join()==='A,B');
assert('independent server addition preserved', ids(mergeEntityArrays([A],[A],[A,C])).join()==='A,C');
assert('both independent additions merge', ids(mergeEntityArrays([A],[A,B],[A,C])).join()==='A,B,C');
assert('server concurrent edit wins', mergeEntityArrays([A],[{id:'A',v:2}],[{id:'A',v:3}])[0].v===3);
assert('client edit accepted when server unchanged', mergeEntityArrays([A],[{id:'A',v:2}],[A])[0].v===2);
assert('client deletion wins when server unchanged', mergeEntityArrays([A],[],[A]).length===0);
assert('server deletion wins over concurrent client edit', ids(mergeEntityArrays([A],[{id:'A',v:9}],[])).length===0);
assert('server deletion stays deleted with unchanged stale client', ids(mergeEntityArrays([A],[A],[])).length===0);
assert('server edit wins over concurrent client deletion', mergeEntityArrays([A],[],[{id:'A',v:9}])[0].v===9);
console.log('sync invariant tests: PASS (12/12)');
