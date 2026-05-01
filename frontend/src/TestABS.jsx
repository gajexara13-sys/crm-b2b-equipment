import React,{useState,useEffect} from 'react'
import axios from 'axios'
const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c})
const FR=['0.063','0.125','0.25','0.5','1.0','2.0','4.0','8.0','11.2','16.0','22.4','31.5']
const S={inp:{padding:'6px 8px',border:'1px solid #ddd',borderRadius:4,fontSize:13,width:'100%',boxSizing:'border-box',textAlign:'center'},inpE:{padding:'6px 8px',border:'2px solid #e53e3e',borderRadius:4,fontSize:13,width:'100%',boxSizing:'border-box',textAlign:'center',background:'#fff5f5'},th:{padding:'7px 8px',background:'#1a3a5c',color:'#fff',fontSize:11,fontWeight:600,textAlign:'center',whiteSpace:'nowrap'},thB:{padding:'7px 8px',background:'#2e6da4',color:'#fff',fontSize:11,fontWeight:600,textAlign:'center',whiteSpace:'nowrap'},td:{padding:'5px 6px',fontSize:12,borderBottom:'1px solid #eee',textAlign:'center'},tdR:{padding:'5px 6px',fontSize:12,borderBottom:'1px solid #eee',textAlign:'center',fontWeight:700,color:'#185fa5'},sec:{background:'#fff',borderRadius:8,padding:'1rem',marginBottom:'1rem',border:'1px solid #e8ecf5'},secH:{fontSize:11,fontWeight:700,color:'#185fa5',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'},lbl:{display:'block',fontSize:11,color:'#666',marginBottom:3,fontWeight:500}}
const fv=v=>{const n=parseFloat(v);return isNaN(n)?null:n}
function Ni({val,onChange,err}){return <input type="text" inputMode="decimal" value={val} onChange={e=>onChange(e.target.value)} style={err?S.inpE:S.inp} placeholder="-"/>}

export default function TestABS({sampleId,onClose}){
  const [sample,setSample]=useState(null)
  const [gost,setGost]=useState('58401')
  const [pc,setPc]=useState(2)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [errs,setErrs]=useState({})
  const [saved,setSaved]=useState(false)
  const [saving,setSaving]=useState(false)
  const [g,setG]=useState({p1:Array(12).fill(''),p2:Array(12).fill('')})
  const setGv=(par,i,v)=>setG(p=>({...p,[par]:p[par].map((x,j)=>j===i?v:x)}))
  const gAvg=FR.map((_,i)=>{
    const a=fv(g.p1[i]),b=fv(g.p2[i])
    if(pc===1) return a===null?'':a.toFixed(1)
    if(a!==null&&b!==null) return ((a+b)/2).toFixed(1)
    if(a!==null) return a.toFixed(1)
    return ''
  })
  const [bin,setBin]=useState({b1:'',a1:'',b2:'',a2:''})
  const bCalc=()=>{
    const b1=fv(bin.b1),a1=fv(bin.a1),b2=fv(bin.b2),a2=fv(bin.a2)
    const c1=(b1&&a1&&b1>0)?((b1-a1)/b1*100):null
    const c2=(b2&&a2&&b2>0)?((b2-a2)/b2*100):null
    const av=pc===1?c1:(c1!==null&&c2!==null?(c1+c2)/2:c1)
    return {c1,c2,av}
  }
  const [bulk,setBulk]=useState(Array(3).fill(null).map(()=>({dry:'',sat:'',water:''})))
  const setBulkV=(i,k,v)=>setBulk(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))
  const bulkCalc=r=>{
    const d=fv(r.dry),s=fv(r.sat),w=fv(r.water)
    return (d!==null&&s!==null&&w!==null&&(s-w)>0)?(d/(s-w)).toFixed(3):null
  }
  const bulkAvg=()=>{
    const vs=bulk.map(r=>fv(bulkCalc(r))).filter(v=>v!==null)
    return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null
  }
  const [maxd,setMaxd]=useState(Array(2).fill(null).map(()=>({mpik:'',mpikW:'',msamp:'',mpikSW:''})))
  const setMaxdV=(i,k,v)=>setMaxd(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))
  const maxdCalc=r=>{
    const mp=fv(r.mpik),mw=fv(r.mpikW),ms=fv(r.msamp),msw=fv(r.mpikSW)
    if(mp!==null&&mw!==null&&ms!==null&&msw!==null){
      const den=(mw-mp)+ms-msw
      return den>0?(ms/den).toFixed(3):null
    }
    return null
  }
  const maxdAvg=()=>{
    const vs=[maxdCalc(maxd[0]),maxdCalc(maxd[1])].filter(v=>v!==null).map(Number)
    return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null
  }
  const airVoids=()=>{
    const rb=fv(bulkAvg()),rm=fv(maxdAvg())
    return (rb!==null&&rm!==null&&rm>0)?((1-rb/rm)*100).toFixed(1):null
  }
  const [wres,setWres]=useState(Array(6).fill(null).map(()=>({dry:'',sat:'',water:''})))
  const setWresV=(i,k,v)=>setWres(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))
  const wresCalc=r=>{
    const d=fv(r.dry),s=fv(r.sat),w=fv(r.water)
    if(d!==null&&s!==null&&w!==null&&(s-w)>0){const vol=s-w;return{vol:vol.toFixed(1),rho:(d/vol).toFixed(3)}}
    return{vol:'-',rho:'-'}
  }
  const wresAvg=()=>{
    const vs=wres.map(r=>fv(wresCalc(r).rho)).filter(v=>v!==null)
    return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null
  }
  const [notes,setNotes]=useState('')
  const [conclusion,setConclusion]=useState('')
  useEffect(()=>{if(sampleId)api.get(`/samples/${sampleId}`).then(r=>setSample(r.data)).catch(()=>{})},[sampleId])
  const handleSave=async()=>{
    if(!date){setErrs({date:true});alert('Заполните дату испытаний');return}
    setSaving(true)
    try{
      const bc=bCalc()
      await api.post('/tests',{sample_id:sampleId,test_type:`gost_${gost}`,tested_at:date,notes,status:'done',
        grain_composition:{fractions:FR,p1:g.p1,p2:pc===2?g.p2:null,avg:gAvg},
        binder_content:{...bin,c1:bc.c1,c2:bc.c2,avg:bc.av},
        bulk_density:{samples:bulk.map(r=>({...r,rho:bulkCalc(r)})),avg:bulkAvg()},
        max_density:{samples:maxd.map(r=>({...r,rho:maxdCalc(r)})),avg:maxdAvg()},
        air_voids:airVoids(),
        water_resistance:{samples:wres.map(r=>({...r,...wresCalc(r)})),avg:wresAvg()}
      })
      setSaved(true);setTimeout(()=>onClose&&onClose(),1500)
    }catch(e){alert('Ошибка: '+(e.response?.data?.detail||e.message))}
    finally{setSaving(false)}
  }

  return(
    <div style={{fontFamily:'-apple-system,sans-serif',color:'#1a1a2e'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #e8ecf5'}}>
        <div>
          <h2 style={{margin:0,fontSize:16,fontWeight:700}}>Карточка испытаний АБС / ЩМАС</h2>
          {sample&&<div style={{fontSize:12,color:'#666',marginTop:4}}>Проба: {sample.lab_number} — {sample.material_name}</div>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <select value={gost} onChange={e=>setGost(e.target.value)} style={{padding:'6px 10px',borderRadius:6,border:'1px solid #ddd',fontSize:13}}>
            <option value="58401">ГОСТ 58401</option>
            <option value="58406">ГОСТ 58406</option>
          </select>
          <select value={pc} onChange={e=>setPc(+e.target.value)} style={{padding:'6px 10px',borderRadius:6,border:'1px solid #ddd',fontSize:13}}>
            <option value={2}>2 паралл.</option>
            <option value={1}>1 опред.</option>
          </select>
        </div>
      </div>
      {saved&&<div style={{background:'#e8f5e9',color:'#2e7d32',padding:'10px 14px',borderRadius:6,marginBottom:12}}>✓ Сохранено</div>}
      <div style={{display:'grid',gridTemplateColumns:'200px 1fr 1fr',gap:12,marginBottom:16}}>
        <div>
          <label style={S.lbl}>Дата *</label>
          <input type="date" value={date} onChange={e=>{setDate(e.target.value);setErrs({})}} style={{...S.inp,textAlign:'left',borderColor:errs.date?'#e53e3e':'#ddd'}}/>
          {errs.date&&<div style={{color:'#e53e3e',fontSize:11,marginTop:2}}>Обязательно</div>}
        </div>
        <div><label style={S.lbl}>Тип/Марка</label><input readOnly value={sample?.material_grade||''} style={{...S.inp,textAlign:'left',background:'#f5f7fa'}}/></div>
        <div><label style={S.lbl}>Изготовитель</label><input readOnly value={sample?.manufacturer||''} style={{...S.inp,textAlign:'left',background:'#f5f7fa'}}/></div>
      </div>
      <div style={S.sec}>
        <div style={S.secH}>1. Зерновой состав (просев через сита, %)</div>
        <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',fontSize:12,minWidth:'100%'}}>
          <thead><tr><th style={{...S.th,minWidth:100,textAlign:'left'}}>Размер</th>{FR.map(f=><th key={f} style={{...S.th,minWidth:55}}>{f}</th>)}</tr></thead>
          <tbody>
            <tr><td style={{...S.td,textAlign:'left',fontWeight:500}}>Нав. 1, %</td>{FR.map((_,i)=><td key={i} style={S.td}><Ni val={g.p1[i]} onChange={v=>setGv('p1',i,v)}/></td>)}</tr>
            {pc===2&&<tr><td style={{...S.td,textAlign:'left',fontWeight:500}}>Нав. 2, %</td>{FR.map((_,i)=><td key={i} style={S.td}><Ni val={g.p2[i]} onChange={v=>setGv('p2',i,v)}/></td>)}</tr>}
            <tr style={{background:'#f0f7ff'}}><td style={{...S.td,textAlign:'left',fontWeight:700,color:'#185fa5'}}>Ср., %</td>{gAvg.map((v,i)=><td key={i} style={{...S.td,fontWeight:700,color:'#185fa5'}}>{v||'-'}</td>)}</tr>
          </tbody>
        </table></div>
      </div>
      <div style={S.sec}>
        <div style={S.secH}>2. Содержание вяжущего (метод выжигания)</div>
        <table style={{borderCollapse:'collapse',fontSize:12}}>
          <thead><tr><th style={{...S.th,minWidth:180,textAlign:'left'}}>Показатель</th><th style={{...S.th,minWidth:120}}>Опр. 1</th>{pc===2&&<th style={{...S.th,minWidth:120}}>Опр. 2</th>}<th style={{...S.thB,minWidth:100}}>Средн.</th></tr></thead>
          <tbody>
            <tr><td style={{...S.td,textAlign:'left'}}>Масса до выжиг., г</td><td style={S.td}><Ni val={bin.b1} onChange={v=>setBin({...bin,b1:v})}/></td>{pc===2&&<td style={S.td}><Ni val={bin.b2} onChange={v=>setBin({...bin,b2:v})}/></td>}<td style={S.td}></td></tr>
            <tr><td style={{...S.td,textAlign:'left'}}>Масса после выжиг., г</td><td style={S.td}><Ni val={bin.a1} onChange={v=>setBin({...bin,a1:v})}/></td>{pc===2&&<td style={S.td}><Ni val={bin.a2} onChange={v=>setBin({...bin,a2:v})}/></td>}<td style={S.td}></td></tr>
            <tr style={{background:'#f0f7ff'}}><td style={{...S.td,textAlign:'left',fontWeight:700}}>Содержание, %</td><td style={S.tdR}>{bCalc().c1!==null?bCalc().c1.toFixed(2):'-'}</td>{pc===2&&<td style={S.tdR}>{bCalc().c2!==null?bCalc().c2.toFixed(2):'-'}</td>}<td style={{...S.tdR,background:'#e3f2fd',fontSize:14}}>{bCalc().av!==null?bCalc().av.toFixed(2):'-'}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={S.sec}>
        <div style={S.secH}>3. Объёмная плотность — гидростатика</div>
        <div style={{fontSize:11,color:'#888',marginBottom:8}}>&rho; = m&#x441;&#x443;&#x445; / (m&#x43d;&#x430;&#x441; &minus; m&#x432;&#x43e;&#x434;&#x430;)</div>
        <table style={{borderCollapse:'collapse',fontSize:12}}>
          <thead><tr><th style={{...S.th,minWidth:50}}>&#8470;</th><th style={{...S.th,minWidth:130}}>m &#x441;&#x443;&#x445;&#x43e;&#x433;&#x43e;, &#x433;</th><th style={{...S.th,minWidth:130}}>m &#x43d;&#x430;&#x441;&#x44b;&#x449;., &#x433;</th><th style={{...S.th,minWidth:130}}>m &#x432; &#x432;&#x43e;&#x434;&#x435;, &#x433;</th><th style={{...S.thB,minWidth:110}}>&rho;, &#x433;/&#x441;&#x43c;&sup3;</th></tr></thead>
          <tbody>
            {bulk.map((r,i)=><tr key={i}><td style={{...S.td,fontWeight:600}}>{i+1}</td><td style={S.td}><Ni val={r.dry} onChange={v=>setBulkV(i,'dry',v)}/></td><td style={S.td}><Ni val={r.sat} onChange={v=>setBulkV(i,'sat',v)}/></td><td style={S.td}><Ni val={r.water} onChange={v=>setBulkV(i,'water',v)}/></td><td style={S.tdR}>{bulkCalc(r)||'-'}</td></tr>)}
            <tr style={{background:'#e3f2fd'}}><td colSpan={4} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя:</td><td style={{...S.tdR,fontSize:14}}>{bulkAvg()||'-'}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={S.sec}>
        <div style={S.secH}>4. Максимальная плотность (метод А)</div>
        <div style={{fontSize:11,color:'#888',marginBottom:8}}>&rho;&#x43c;&#x430;&#x43a;&#x441; = m&#x43f;&#x440;&#x43e;&#x431; / ((m&#x43f;&#x438;&#x43a;+&#x432;&#x43e;&#x434;&#x430; &minus; m&#x43f;&#x438;&#x43a;) + m&#x43f;&#x440;&#x43e;&#x431; &minus; m&#x43f;&#x438;&#x43a;+&#x43f;&#x440;&#x43e;&#x431;+&#x432;&#x43e;&#x434;&#x430;)</div>
        <table style={{borderCollapse:'collapse',fontSize:12}}>
          <thead><tr><th style={{...S.th,minWidth:50}}>&#8470;</th><th style={{...S.th,minWidth:140}}>m &#x43f;&#x438;&#x43a;&#x43d;. &#x43f;&#x443;&#x441;&#x442;., &#x433;</th><th style={{...S.th,minWidth:140}}>m &#x43f;&#x438;&#x43a;&#x43d;.+&#x432;&#x43e;&#x434;&#x430;, &#x433;</th><th style={{...S.th,minWidth:140}}>m &#x43f;&#x440;&#x43e;&#x431;&#x44b;, &#x433;</th><th style={{...S.th,minWidth:150}}>m &#x43f;&#x438;&#x43a;&#x43d;.+&#x43f;&#x440;&#x43e;&#x431;+&#x432;&#x43e;&#x434;&#x430;, &#x433;</th><th style={{...S.thB,minWidth:110}}>&rho;&#x43c;&#x430;&#x43a;&#x441;, &#x433;/&#x441;&#x43c;&sup3;</th></tr></thead>
          <tbody>
            {maxd.map((r,i)=><tr key={i}><td style={{...S.td,fontWeight:600}}>{i+1}</td><td style={S.td}><Ni val={r.mpik} onChange={v=>setMaxdV(i,'mpik',v)}/></td><td style={S.td}><Ni val={r.mpikW} onChange={v=>setMaxdV(i,'mpikW',v)}/></td><td style={S.td}><Ni val={r.msamp} onChange={v=>setMaxdV(i,'msamp',v)}/></td><td style={S.td}><Ni val={r.mpikSW} onChange={v=>setMaxdV(i,'mpikSW',v)}/></td><td style={S.tdR}>{maxdCalc(r)||'-'}</td></tr>)}
            <tr style={{background:'#e3f2fd'}}><td colSpan={5} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя:</td><td style={{...S.tdR,fontSize:14}}>{maxdAvg()||'-'}</td></tr>
          </tbody>
        </table>
        {airVoids()!==null&&<div style={{marginTop:10,padding:'8px 14px',background:'#fff3e0',borderRadius:6,fontSize:14,fontWeight:700,color:'#e65100'}}>Воздушные пустоты: {airVoids()} %</div>}
      </div>
      <div style={S.sec}>
        <div style={S.secH}>5. Водостойкость</div>
        <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',fontSize:12,minWidth:'100%'}}>
          <thead><tr><th style={{...S.th,minWidth:40}}>&#8470;</th><th style={{...S.th,minWidth:120}}>m &#x441;&#x443;&#x445;, &#x433;</th><th style={{...S.th,minWidth:120}}>m &#x43d;&#x430;&#x441;., &#x433;</th><th style={{...S.th,minWidth:120}}>m &#x432; &#x432;&#x43e;&#x434;&#x435;, &#x433;</th><th style={{...S.thB,minWidth:100}}>&#x41e;&#x431;&#x44a;&#x451;&#x43c;, &#x441;&#x43c;&sup3;</th><th style={{...S.thB,minWidth:100}}>&rho;, &#x433;/&#x441;&#x43c;&sup3;</th></tr></thead>
          <tbody>
            {wres.map((r,i)=>{const c=wresCalc(r);return <tr key={i} style={{background:i%2?'#f9f9f9':'#fff'}}><td style={{...S.td,fontWeight:600}}>{i+1}</td><td style={S.td}><Ni val={r.dry} onChange={v=>setWresV(i,'dry',v)}/></td><td style={S.td}><Ni val={r.sat} onChange={v=>setWresV(i,'sat',v)}/></td><td style={S.td}><Ni val={r.water} onChange={v=>setWresV(i,'water',v)}/></td><td style={S.tdR}>{c.vol}</td><td style={S.tdR}>{c.rho}</td></tr>})}
            <tr style={{background:'#e3f2fd'}}><td colSpan={5} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя плотн.:</td><td style={{...S.tdR,fontSize:14}}>{wresAvg()||'-'}</td></tr>
          </tbody>
        </table></div>
      </div>
      <div style={S.sec}>
        <div style={S.secH}>6. Примечания и заключение</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={S.lbl}>Примечания</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...S.inp,textAlign:'left',resize:'vertical'}} placeholder="Условия..."/></div>
          <div><label style={S.lbl}>Заключение</label><textarea value={conclusion} onChange={e=>setConclusion(e.target.value)} rows={3} style={{...S.inp,textAlign:'left',resize:'vertical'}} placeholder="Соответствует/не соответствует..."/></div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,paddingTop:8}}>
        <button onClick={handleSave} disabled={saving} style={{padding:'10px 28px',background:saving?'#aaa':'#185fa5',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:600,cursor:saving?'default':'pointer'}}>{saving?'Сохраняю...':'Сохранить'}</button>
        <button onClick={onClose} style={{padding:'10px 18px',background:'transparent',color:'#666',border:'1px solid #ddd',borderRadius:6,fontSize:14,cursor:'pointer'}}>Закрыть</button>
      </div>
    </div>
  )
}
