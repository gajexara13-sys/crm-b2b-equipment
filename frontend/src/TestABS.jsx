import React,{useState,useEffect} from 'react'
import axios from 'axios'
import { useConfirm } from './ConfirmDialog'
const api=axios.create({baseURL:'/api'})
api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization=`Bearer ${t}`;return c})

// Сита по ГОСТ 33029-2014 (убывание) + поддон; 5.6 мм исключён
const FR=['45.0','31.5','22.4','16.0','11.2','8.0','4.0','2.0','1.0','0.5','0.25','0.125','0.063']
const SIEVES=[...FR,'поддон'] // 14 элементов
const N=SIEVES.length

const S={
  inp:{padding:'5px 6px',border:'1px solid var(--inp-border)',borderRadius:4,fontSize:12,width:'100%',boxSizing:'border-box',textAlign:'center'},
  inpE:{padding:'5px 6px',border:'2px solid #e53e3e',borderRadius:4,fontSize:12,width:'100%',boxSizing:'border-box',textAlign:'center',background:'#fff5f5'},
  th:{padding:'6px 6px',background:'#1a3a5c',color:'#fff',fontSize:11,fontWeight:600,textAlign:'center',whiteSpace:'nowrap'},
  thB:{padding:'6px 6px',background:'#2e6da4',color:'#fff',fontSize:11,fontWeight:600,textAlign:'center',whiteSpace:'nowrap'},
  thG:{padding:'6px 6px',background:'#1a4a8a',color:'#fff',fontSize:11,fontWeight:600,textAlign:'center',whiteSpace:'nowrap'},
  td:{padding:'4px 5px',fontSize:12,borderBottom:'1px solid #eee',textAlign:'center'},
  tdR:{padding:'4px 5px',fontSize:12,borderBottom:'1px solid #eee',textAlign:'center',fontWeight:700,color:'var(--primary)'},
  tdG:{padding:'4px 5px',fontSize:12,borderBottom:'1px solid #eee',textAlign:'center',fontWeight:400,color:'var(--text)'},
  sec:{background:'var(--surface)',borderRadius:8,padding:'1rem',marginBottom:'1rem',border:'1px solid var(--border)'},
  secH:{fontSize:11,fontWeight:700,color:'var(--primary)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'},
  lbl:{display:'block',fontSize:11,color:'#666',marginBottom:3,fontWeight:500}
}
const fv=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n}
const fmt=(v,d=2)=>v===null||v===undefined?'-':Number(v).toFixed(d)
const str=v=>v==null?'':String(v)

function Ni({val,onChange,w}){
  return <input type="text" inputMode="decimal" value={val}
    onChange={e=>onChange(e.target.value)}
    style={{...S.inp,width:w||'100%'}}
    placeholder="-"/>
}

// Расчёт зернового состава для одной навески
function calcGrain(masses,m0str){
  const m0=fv(m0str)
  if(!m0||m0<=0) return Array(N).fill({part:null,full:null,pass:null})
  let cum=0
  return masses.map((m,i)=>{
    const g=fv(m)
    const part=g!==null?(g/m0*100):null
    if(part!==null) cum+=part
    const full=part!==null?cum:null
    const isPoddons=i===N-1
    const pass=full!==null?(isPoddons?null:100-full):null
    return{part,full,pass}
  })
}

// Контроль потери массы (%)
function massLoss(masses,m0str){
  const m0=fv(m0str)
  if(!m0||m0<=0) return null
  const s=masses.reduce((a,m)=>{const v=fv(m);return v!==null?a+v:a},0)
  return Math.abs(s-m0)/m0*100
}

const emptyBulk=()=>Array(3).fill(null).map(()=>({dry:'',sat:'',water:''}))
const emptyMaxd=()=>Array(2).fill(null).map(()=>({mpik:'',mpikW:'',msamp:'',mpikSW:''}))
const emptyWres=()=>Array(6).fill(null).map(()=>({dry:'',sat:'',water:''}))

export default function TestABS({sampleId,testId,takenSampleIds=[],onClose}){
  const confirm = useConfirm()
  const isEdit=!!testId
  const [sample,setSample]=useState(null)
  const [allSamples,setAllSamples]=useState([])
  const [pickedSampleId,setPickedSampleId]=useState(sampleId||null)
  const [gost,setGost]=useState('58401')
  const [pc,setPc]=useState(2)
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [errs,setErrs]=useState({})
  const [saved,setSaved]=useState(false)
  const [saving,setSaving]=useState(false)
  const [protocolId,setProtocolId]=useState(null)
  const [loading,setLoading]=useState(isEdit)
  const [isDirty,setIsDirty]=useState(false)
  const markDirty=()=>{ setIsDirty(true); window.__formIsDirty=true }

  const handleClose=async()=>{
    if(isDirty&&!saved){
      const ok=await confirm({title:'Несохранённые изменения',message:'Выйти без сохранения?'})
      if(!ok) return
    }
    window.__formIsDirty=false
    onClose()
  }

  const downloadProtocol=async(id)=>{
    const token=localStorage.getItem('token')
    try{
      const res=await fetch(`/api/protocols/${id}/generate`,{headers:{Authorization:`Bearer ${token}`}})
      if(!res.ok){let msg='Ошибка генерации';try{const j=await res.json();msg=j.detail||msg}catch{}alert(msg);return}
      const blob=await res.blob()
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url;a.download=`protocol_${id}.xlsx`;a.click();URL.revokeObjectURL(url)
    }catch(e){alert('Ошибка: '+e.message)}
  }

  // ---- Зерновой состав ----
  const [g,setG]=useState({m0_1:'',m0_2:'',p1:Array(N).fill(''),p2:Array(N).fill('')})
  const setGv=(par,i,v)=>{markDirty();setG(p=>({...p,[par]:p[par].map((x,j)=>j===i?v:x)}))}
  const setGm=(k,v)=>{markDirty();setG(p=>({...p,[k]:v}))}

  const rows1=calcGrain(g.p1,g.m0_1)
  const rows2=calcGrain(g.p2,g.m0_2)
  const loss1=massLoss(g.p1,g.m0_1)
  const loss2=massLoss(g.p2,g.m0_2)

  // Средний проход (для отчёта): среднее по двум навескам
  const avgPass=SIEVES.map((_,i)=>{
    const a=rows1[i].pass,b=rows2[i].pass
    if(pc===1) return a
    if(a!==null&&b!==null) return (a+b)/2
    return a??b
  })

  // ---- Вяжущее ----
  const [bin,setBin]=useState({b1:'',a1:'',b2:'',a2:''})
  const bCalc=()=>{
    const b1=fv(bin.b1),a1=fv(bin.a1),b2=fv(bin.b2),a2=fv(bin.a2)
    const c1=(b1&&a1&&b1>0)?((b1-a1)/b1*100):null
    const c2=(b2&&a2&&b2>0)?((b2-a2)/b2*100):null
    const av=pc===1?c1:(c1!==null&&c2!==null?(c1+c2)/2:c1)
    return{c1,c2,av}
  }

  // ---- Объёмная плотность ----
  const [bulk,setBulk]=useState(emptyBulk())
  const setBulkV=(i,k,v)=>{markDirty();setBulk(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))}
  const bulkCalc=r=>{const d=fv(r.dry),s=fv(r.sat),w=fv(r.water);return(d!==null&&s!==null&&w!==null&&(s-w)>0)?(d/(s-w)).toFixed(3):null}
  const bulkAvg=()=>{const vs=bulk.map(r=>fv(bulkCalc(r))).filter(v=>v!==null);return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null}

  // ---- Максимальная плотность ----
  const [maxd,setMaxd]=useState(emptyMaxd())
  const setMaxdV=(i,k,v)=>{markDirty();setMaxd(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))}
  const maxdCalc=r=>{
    const mp=fv(r.mpik),mw=fv(r.mpikW),ms=fv(r.msamp),msw=fv(r.mpikSW)
    if(mp!==null&&mw!==null&&ms!==null&&msw!==null){const den=(mw-mp)+ms-msw;return den>0?(ms/den).toFixed(3):null}
    return null
  }
  const maxdAvg=()=>{const vs=[maxdCalc(maxd[0]),maxdCalc(maxd[1])].filter(v=>v!==null).map(Number);return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null}
  const airVoids=()=>{const rb=fv(bulkAvg()),rm=fv(maxdAvg());return(rb!==null&&rm!==null&&rm>0)?((1-rb/rm)*100).toFixed(1):null}

  // ---- Водостойкость ----
  const [wres,setWres]=useState(emptyWres())
  const setWresV=(i,k,v)=>{markDirty();setWres(p=>p.map((r,j)=>j===i?{...r,[k]:v}:r))}
  const wresCalc=r=>{const d=fv(r.dry),s=fv(r.sat),w=fv(r.water);if(d!==null&&s!==null&&w!==null&&(s-w)>0){const vol=s-w;return{vol:vol.toFixed(1),rho:(d/vol).toFixed(3)}}; return{vol:'-',rho:'-'}}
  const wresAvg=()=>{const vs=wres.map(r=>fv(wresCalc(r).rho)).filter(v=>v!==null);return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(3):null}

  const [notes,setNotes]=useState('')
  const [conclusion,setConclusion]=useState('')

  useEffect(()=>{ return ()=>{ window.__formIsDirty=false } },[])

  useEffect(()=>{
    const sid=sampleId
    if(sid) api.get(`/samples/${sid}`).then(r=>setSample(r.data)).catch(()=>{})
    if(!isEdit) api.get('/samples').then(r=>setAllSamples(r.data)).catch(()=>{})
  },[sampleId])

  useEffect(()=>{
    if(!testId){setLoading(false);return}
    setLoading(true)
    Promise.all([
      api.get(`/tests/${testId}`),
      api.get('/protocols').catch(()=>({data:[]})),
    ]).then(([testRes,protRes])=>{
      const t=testRes.data
      // Находим протокол для этого испытания
      const prot=(protRes.data||[]).find(p=>p.test_id===testId)
      if(prot){setProtocolId(prot.id);setConclusion(prot.conclusion||'')}
      setGost(t.test_type?.includes('58406')?'58406':'58401')
      if(t.tested_at) setDate(t.tested_at)

      const gc=t.grain_composition||{}
      // Определяем формат: новый (есть p1_grams) или старый (только проходы)
      if(gc.p1_grams){
        const hasP2=Array.isArray(gc.p2_grams)&&gc.p2_grams.some(v=>v!==null&&v!=='')
        setPc(hasP2?2:1)
        // Ремаппинг по имени сита — если набор сит изменился (убрали 5.6), данные встанут правильно
        const remap=(grams,fractions)=>{
          if(!fractions||!grams) return Array(N).fill('')
          return SIEVES.map(s=>{const i=(fractions).indexOf(s);return i>=0?str(grams[i]):''})
        }
        setG({
          m0_1:str(gc.m0_1),
          m0_2:str(gc.m0_2),
          p1:remap(gc.p1_grams,gc.fractions),
          p2:remap(gc.p2_grams,gc.fractions),
        })
      } else if(Array.isArray(gc.p1)){
        // Старый формат — заполняем как есть, граммы пустые
        const hasP2=Array.isArray(gc.p2)&&gc.p2.some(v=>v!==null&&v!=='')
        setPc(hasP2?2:1)
        setG({m0_1:'',m0_2:'',p1:Array(N).fill(''),p2:Array(N).fill('')})
      }

      const bc=t.binder_content||{}
      setBin({b1:str(bc.b1),a1:str(bc.a1),b2:str(bc.b2),a2:str(bc.a2)})

      const bd=t.bulk_density||{}
      const bSamp=(bd.samples||[]).slice(0,3)
      while(bSamp.length<3) bSamp.push({dry:'',sat:'',water:''})
      setBulk(bSamp.map(s=>({dry:str(s.dry),sat:str(s.sat),water:str(s.water)})))

      const md=t.max_density||{}
      const mSamp=(md.samples||[]).slice(0,2)
      while(mSamp.length<2) mSamp.push({mpik:'',mpikW:'',msamp:'',mpikSW:''})
      setMaxd(mSamp.map(s=>({mpik:str(s.mpik),mpikW:str(s.mpikW),msamp:str(s.msamp),mpikSW:str(s.mpikSW)})))

      const wr=t.water_resistance||{}
      const wSamp=(wr.samples||[]).slice(0,6)
      while(wSamp.length<6) wSamp.push({dry:'',sat:'',water:''})
      setWres(wSamp.map(s=>({dry:str(s.dry),sat:str(s.sat),water:str(s.water)})))

      setNotes(t.notes||'')
      if(t.sample_id){
        setPickedSampleId(t.sample_id)
        api.get(`/samples/${t.sample_id}`).then(r2=>setSample(r2.data)).catch(()=>{})
      }
      // В режиме редактирования сразу помечаем форму — чтобы уход без сохранения всегда спрашивал
      setIsDirty(true); window.__formIsDirty=true
    }).catch(()=>{}).finally(()=>setLoading(false))
  },[testId])

  const fmtErr=e=>{
    const d=e.response?.data?.detail
    if(typeof d==='string')return d
    if(Array.isArray(d))return d.map(x=>x.msg||JSON.stringify(x)).join('; ')
    return e.message||'Ошибка сохранения'
  }

  const handleSave=async()=>{
    const sid=pickedSampleId||(sample?.id)
    if(!sid){alert('Выберите пробу.');return}
    if(!date){setErrs({date:true});alert('Заполните дату испытаний');return}

    // Предупреждение при превышении потери массы
    const l1=loss1,l2=loss2
    if(l1!==null&&l1>1){
      const ok=await confirm({
        title:'Контроль массы (навеска 1)',
        message:`Потеря массы ${l1.toFixed(2)}% > 1% (ГОСТ 33029-2014 допускает ≤ 1%).\nПродолжить сохранение?`,
        confirmText:'Сохранить',
      })
      if(!ok) return
    }
    if(pc===2&&l2!==null&&l2>1){
      const ok=await confirm({
        title:'Контроль массы (навеска 2)',
        message:`Потеря массы ${l2.toFixed(2)}% > 1%.\nПродолжить сохранение?`,
        confirmText:'Сохранить',
      })
      if(!ok) return
    }

    setSaving(true);setSaved(false)
    try{
      const bc=bCalc()
      const payload={
        sample_id:sid,test_type:`gost_${gost}`,tested_at:date,notes,status:'done',
        grain_composition:{
          fractions:SIEVES,
          m0_1:fv(g.m0_1),m0_2:pc===2?fv(g.m0_2):null,
          p1_grams:g.p1.map(v=>fv(v)),
          p2_grams:pc===2?g.p2.map(v=>fv(v)):null,
          p1:rows1.map(r=>r.pass),
          p2:pc===2?rows2.map(r=>r.pass):null,
          avg:avgPass,
        },
        binder_content:{...bin,c1:bc.c1,c2:bc.c2,avg:bc.av},
        bulk_density:{samples:bulk.map(r=>({...r,rho:bulkCalc(r)})),avg:bulkAvg()},
        max_density:{samples:maxd.map(r=>({...r,rho:maxdCalc(r)})),avg:maxdAvg()},
        air_voids:airVoids(),
        water_resistance:{samples:wres.map(r=>({...r,...wresCalc(r)})),avg:wresAvg()}
      }
      let testRes
      if(isEdit){
        testRes=await api.put(`/tests/${testId}`,payload)
        // Обновляем заключение в протоколе если он есть
        if(protocolId){
          try{ await api.put(`/protocols/${protocolId}`,{conclusion:conclusion||null}) }
          catch(pe){ console.warn('Не удалось обновить заключение протокола:',pe) }
        }
      } else {
        testRes=await api.post('/tests',payload)
        try{
          const protRes=await api.post('/protocols',{sample_id:sid,test_id:testRes.data.id,conclusion:conclusion||null})
          setProtocolId(protRes.data.id)
        }catch(pe){console.warn('Протокол не создан:',pe)}
      }
      setSaved(true)
      setIsDirty(false)
      window.__formIsDirty=false
    }catch(e){alert('Ошибка: '+fmtErr(e))}
    finally{setSaving(false)}
  }

  if(loading) return <div style={{padding:'2rem',textAlign:'center',color:'var(--text3)'}}>Загрузка данных испытания...</div>

  const lossWarn=(loss,label)=>{
    if(loss===null) return null
    const ok=loss<=1
    return(
      <span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:ok?'#dcfce7':'#fee2e2',color:ok?'#166534':'#dc2626',fontWeight:600,marginLeft:8}}>
        {label} потеря: {loss.toFixed(2)}% {ok?'✓':'⚠ >1%'}
      </span>
    )
  }

  const freeSamples=allSamples.filter(s=>!takenSampleIds.includes(s.id))

  return(
    <div style={{fontFamily:'-apple-system,sans-serif',color:'var(--text)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottom:'2px solid #e8ecf5'}}>
        <div>
          <h2 style={{margin:0,fontSize:16,fontWeight:700}}>
            {isEdit?`Редактирование карточки #${testId}`:'Карточка испытаний АБС / ЩМАС'}
          </h2>
          {isEdit&&sample&&<div style={{fontSize:12,color:'#666',marginTop:4}}>Проба: {sample.lab_number} — {sample.material_name}</div>}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button type="button" onClick={()=>void handleClose()}
            style={{padding:'6px 14px',background:'transparent',color:'var(--text3)',border:'1px solid var(--border)',borderRadius:6,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            ← Назад
          </button>
          <select value={gost} onChange={e=>{markDirty();setGost(e.target.value)}} style={{padding:'6px 10px',borderRadius:6,border:'1px solid var(--inp-border)',fontSize:13}}>
            <option value="58401">ГОСТ 58401</option>
            <option value="58406">ГОСТ 58406</option>
          </select>
          <select value={pc} onChange={e=>{markDirty();setPc(+e.target.value)}} style={{padding:'6px 10px',borderRadius:6,border:'1px solid var(--inp-border)',fontSize:13}}>
            <option value={2}>2 паралл.</option>
            <option value={1}>1 опред.</option>
          </select>
        </div>
      </div>

      {/* Выбор пробы (только при создании новой карточки) */}
      {!isEdit&&(
        <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'14px 16px',marginBottom:18}}>
          <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:6}}>Проба *</label>
          {freeSamples.length===0
            ? <div style={{fontSize:13,color:'var(--text4)',padding:'6px 0'}}>Нет свободных проб (все уже имеют карточку испытания)</div>
            : <select
                value={pickedSampleId||''}
                onChange={e=>{markDirty();setPickedSampleId(+e.target.value||null)}}
                style={{width:'100%',padding:'8px 10px',borderRadius:6,border:pickedSampleId?'1px solid #bfdbfe':'1px solid #f87171',fontSize:13,background:'#fff'}}>
                <option value="">— выберите пробу —</option>
                {freeSamples.map(s=>(
                  <option key={s.id} value={s.id}>
                    {s.lab_number}{s.material_name?` — ${s.material_name}`:s.material_type?` — ${s.material_type}`:''}
                  </option>
                ))}
              </select>
          }
        </div>
      )}

      {/* Остальная форма — только когда проба выбрана */}
      {(isEdit||pickedSampleId)&&<>

      {saved&&(
        <div style={{background:'#e8f5e9',color:'#2e7d32',padding:'10px 14px',borderRadius:6,marginBottom:12,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span>{isEdit?'✓ Изменения сохранены':'✓ Испытание сохранено'}</span>
          {protocolId&&(
            <button type="button" onClick={()=>downloadProtocol(protocolId)}
              style={{padding:'6px 16px',background:'#185fa5',color:'#fff',borderRadius:6,fontSize:13,fontWeight:600,border:'none',cursor:'pointer'}}>
              Скачать протокол .xlsx
            </button>
          )}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'200px 1fr 1fr',gap:12,marginBottom:16}}>
        <div>
          <label style={S.lbl}>Дата *</label>
          <input type="date" value={date} onChange={e=>{markDirty();setDate(e.target.value);setErrs({})}}
            style={{...S.inp,textAlign:'left',borderColor:errs.date?'#e53e3e':'#ddd'}}/>
          {errs.date&&<div style={{color:'#e53e3e',fontSize:11,marginTop:2}}>Обязательно</div>}
        </div>
        <div><label style={S.lbl}>Тип/Марка</label><input readOnly value={sample?.material_grade||''} style={{...S.inp,textAlign:'left',background:'#f5f7fa'}}/></div>
        <div><label style={S.lbl}>Изготовитель</label><input readOnly value={sample?.manufacturer||''} style={{...S.inp,textAlign:'left',background:'#f5f7fa'}}/></div>
      </div>

      {/* === 1. Зерновой состав === */}
      <div style={S.sec}>
        <div style={{marginBottom:10}}>
          <div style={S.secH}>1. Зерновой состав по ГОСТ 33029-2014</div>
        </div>

        {/* Начальные массы */}
        <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{...S.lbl,marginBottom:0,whiteSpace:'nowrap'}}>Нач. масса нав. 1, г:</label>
            <input type="text" inputMode="decimal" value={g.m0_1}
              onChange={e=>{markDirty();setG(p=>({...p,m0_1:e.target.value}))}}
              style={{...S.inp,width:90}} placeholder="0.0"/>
          </div>
          {pc===2&&(
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <label style={{...S.lbl,marginBottom:0,whiteSpace:'nowrap'}}>Нач. масса нав. 2, г:</label>
              <input type="text" inputMode="decimal" value={g.m0_2}
                onChange={e=>{markDirty();setG(p=>({...p,m0_2:e.target.value}))}}
                style={{...S.inp,width:90}} placeholder="0.0"/>
            </div>
          )}
        </div>

        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:12,width:'100%',tableLayout:'fixed',minWidth:860}}>
            <colgroup>
              <col style={{width:140}}/>
              {SIEVES.map((_,i)=><col key={i}/>)}
              <col style={{width:62}}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{...S.th,textAlign:'left',position:'sticky',left:0,zIndex:1}}>Показатель</th>
                {SIEVES.map(s=>(
                  <th key={s} style={S.th}>{s}</th>
                ))}
                <th style={S.thB}>Σ</th>
              </tr>
            </thead>
            <tbody>
              {/* --- Навеска 1 --- */}
              <tr style={{background:'#f8faff'}}>
                <td style={{...S.td,textAlign:'left',fontWeight:700,color:'#1a3a5c',background:'#eef2fb',position:'sticky',left:0}}>Навеска 1, г</td>
                {SIEVES.map((_,i)=>(
                  <td key={i} style={S.td}>
                    <Ni val={g.p1[i]} onChange={v=>setGv('p1',i,v)} w="100%"/>
                  </td>
                ))}
                <td style={{...S.tdR,background:'#dbeafe',verticalAlign:'middle',lineHeight:1.3}}>
                  <div>{(()=>{const s=g.p1.reduce((a,v)=>{const n=fv(v);return n!==null?a+n:a},0);return s>0?s.toFixed(1):'-'})()}</div>
                  {loss1!==null&&<div style={{fontSize:10,fontWeight:400,color:loss1>1?'#dc2626':'#16a34a',marginTop:1}}>{loss1.toFixed(2)}%</div>}
                </td>
              </tr>
              <tr>
                <td style={{...S.td,textAlign:'left',paddingLeft:8,color:'var(--text2)',background:'#f9fafb',position:'sticky',left:0,whiteSpace:'nowrap'}}>Частный остаток, %</td>
                {rows1.map((r,i)=><td key={i} style={{...S.tdR,fontWeight:400}}>{fmt(r.part)}</td>)}
                <td style={S.td}/>
              </tr>
              <tr style={{background:'#fafafa'}}>
                <td style={{...S.td,textAlign:'left',paddingLeft:8,color:'var(--text2)',background:'#f9fafb',position:'sticky',left:0,whiteSpace:'nowrap'}}>Полный остаток, %</td>
                {rows1.map((r,i)=><td key={i} style={{...S.tdR,fontWeight:400}}>{fmt(r.full)}</td>)}
                <td style={S.td}/>
              </tr>
              <tr style={{background:'#eff6ff'}}>
                <td style={{...S.td,textAlign:'left',paddingLeft:8,fontWeight:400,color:'var(--text)',background:'#dbeafe',position:'sticky',left:0,whiteSpace:'nowrap'}}>Полный проход, %</td>
                {rows1.map((r,i)=>(
                  <td key={i} style={{...S.tdG,background:'#eff6ff',color:'var(--primary)',fontWeight:700}}>
                    {i===N-1?'—':fmt(r.pass)}
                  </td>
                ))}
                <td style={S.td}/>
              </tr>

              {/* --- Навеска 2 --- */}
              {pc===2&&<>
                <tr style={{background:'#f8faff'}}>
                  <td style={{...S.td,textAlign:'left',fontWeight:700,color:'#163a5c',background:'#e8f0fb',position:'sticky',left:0}}>Навеска 2, г</td>
                  {SIEVES.map((_,i)=>(
                    <td key={i} style={S.td}>
                      <Ni val={g.p2[i]} onChange={v=>setGv('p2',i,v)} w="100%"/>
                    </td>
                  ))}
                  <td style={{...S.tdR,background:'#dbeafe',verticalAlign:'middle',lineHeight:1.3}}>
                    <div>{(()=>{const s=g.p2.reduce((a,v)=>{const n=fv(v);return n!==null?a+n:a},0);return s>0?s.toFixed(1):'-'})()}</div>
                    {loss2!==null&&<div style={{fontSize:10,fontWeight:400,color:loss2>1?'#dc2626':'#16a34a',marginTop:1}}>{loss2.toFixed(2)}%</div>}
                  </td>
                </tr>
                <tr>
                  <td style={{...S.td,textAlign:'left',paddingLeft:8,color:'var(--text2)',background:'#f9fafb',position:'sticky',left:0,whiteSpace:'nowrap'}}>Частный остаток, %</td>
                  {rows2.map((r,i)=><td key={i} style={{...S.tdR,color:'var(--text2)',fontWeight:400}}>{fmt(r.part)}</td>)}
                  <td style={S.td}/>
                </tr>
                <tr style={{background:'#fafafa'}}>
                  <td style={{...S.td,textAlign:'left',paddingLeft:8,color:'var(--text2)',background:'#f9fafb',position:'sticky',left:0,whiteSpace:'nowrap'}}>Полный остаток, %</td>
                  {rows2.map((r,i)=><td key={i} style={{...S.tdR,color:'var(--text2)',fontWeight:400}}>{fmt(r.full)}</td>)}
                  <td style={S.td}/>
                </tr>
                <tr style={{background:'#eff6ff'}}>
                  <td style={{...S.td,textAlign:'left',paddingLeft:8,fontWeight:400,color:'var(--text)',background:'#dbeafe',position:'sticky',left:0,whiteSpace:'nowrap'}}>Полный проход, %</td>
                  {rows2.map((r,i)=>(
                    <td key={i} style={{...S.tdG,background:'#eff6ff',color:'var(--primary)',fontWeight:700}}>
                      {i===N-1?'—':fmt(r.pass)}
                    </td>
                  ))}
                  <td style={S.td}/>
                </tr>
              </>}

              {/* --- Средний проход --- */}
              <tr style={{background:'#dbeafe'}}>
                <td style={{...S.td,textAlign:'left',fontWeight:700,color:'#1a3a5c',background:'#bfdbfe',position:'sticky',left:0,whiteSpace:'nowrap'}}>Средний проход, %</td>
                {avgPass.map((v,i)=>(
                  <td key={i} style={{...S.tdG,background:'#dbeafe',color:'#1a3a5c',fontWeight:700}}>
                    {i===N-1?'—':(v!==null?v.toFixed(1):'-')}
                  </td>
                ))}
                <td style={S.td}/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* === 2. Вяжущее === */}
      <div style={S.sec}>
        <div style={S.secH}>2. Содержание вяжущего (метод выжигания)</div>
        <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,minWidth:520}}>
          <thead><tr>
            <th style={{...S.th,minWidth:180,textAlign:'left'}}>Показатель</th>
            <th style={{...S.th,minWidth:120}}>Опр. 1</th>
            {pc===2&&<th style={{...S.th,minWidth:120}}>Опр. 2</th>}
            <th style={{...S.thB,minWidth:100}}>Средн.</th>
          </tr></thead>
          <tbody>
            <tr>
              <td style={{...S.td,textAlign:'left'}}>Масса до выжиг., г</td>
              <td style={S.td}><Ni val={bin.b1} onChange={v=>{markDirty();setBin({...bin,b1:v})}}/></td>
              {pc===2&&<td style={S.td}><Ni val={bin.b2} onChange={v=>{markDirty();setBin({...bin,b2:v})}}/></td>}
              <td style={S.td}/>
            </tr>
            <tr>
              <td style={{...S.td,textAlign:'left'}}>Масса после выжиг., г</td>
              <td style={S.td}><Ni val={bin.a1} onChange={v=>{markDirty();setBin({...bin,a1:v})}}/></td>
              {pc===2&&<td style={S.td}><Ni val={bin.a2} onChange={v=>{markDirty();setBin({...bin,a2:v})}}/></td>}
              <td style={S.td}/>
            </tr>
            <tr style={{background:'#f0f7ff'}}>
              <td style={{...S.td,textAlign:'left',fontWeight:700}}>Содержание, %</td>
              <td style={S.tdR}>{bCalc().c1!==null?bCalc().c1.toFixed(2):'-'}</td>
              {pc===2&&<td style={S.tdR}>{bCalc().c2!==null?bCalc().c2.toFixed(2):'-'}</td>}
              <td style={{...S.tdR,background:'#e3f2fd',fontSize:14}}>{bCalc().av!==null?bCalc().av.toFixed(2):'-'}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* === 3. Объёмная плотность === */}
      <div style={S.sec}>
        <div style={S.secH}>3. Объёмная плотность — гидростатика</div>
        <div style={{fontSize:11,color:'var(--text4)',marginBottom:8}}>&rho; = m&#x441;&#x443;&#x445; / (m&#x43d;&#x430;&#x441; &minus; m&#x432;&#x43e;&#x434;&#x430;)</div>
        <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,minWidth:560}}>
          <thead><tr>
            <th style={{...S.th,minWidth:50}}>&#8470;</th>
            <th style={{...S.th,minWidth:130}}>m сухого, г</th>
            <th style={{...S.th,minWidth:130}}>m насыщ., г</th>
            <th style={{...S.th,minWidth:130}}>m в воде, г</th>
            <th style={{...S.thB,minWidth:110}}>&rho;, г/см³</th>
          </tr></thead>
          <tbody>
            {bulk.map((r,i)=>(
              <tr key={i}>
                <td style={{...S.td,fontWeight:600}}>{i+1}</td>
                <td style={S.td}><Ni val={r.dry} onChange={v=>setBulkV(i,'dry',v)}/></td>
                <td style={S.td}><Ni val={r.sat} onChange={v=>setBulkV(i,'sat',v)}/></td>
                <td style={S.td}><Ni val={r.water} onChange={v=>setBulkV(i,'water',v)}/></td>
                <td style={S.tdR}>{bulkCalc(r)||'-'}</td>
              </tr>
            ))}
            <tr style={{background:'#e3f2fd'}}>
              <td colSpan={4} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя:</td>
              <td style={{...S.tdR,fontSize:14}}>{bulkAvg()||'-'}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* === 4. Максимальная плотность === */}
      <div style={S.sec}>
        <div style={S.secH}>4. Максимальная плотность (метод А)</div>
        <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,minWidth:740}}>
          <thead><tr>
            <th style={{...S.th,minWidth:50}}>&#8470;</th>
            <th style={{...S.th,minWidth:140}}>m пикн. пуст., г</th>
            <th style={{...S.th,minWidth:140}}>m пикн.+вода, г</th>
            <th style={{...S.th,minWidth:140}}>m пробы, г</th>
            <th style={{...S.th,minWidth:150}}>m пикн.+проб+вода, г</th>
            <th style={{...S.thB,minWidth:110}}>&rho;макс, г/см³</th>
          </tr></thead>
          <tbody>
            {maxd.map((r,i)=>(
              <tr key={i}>
                <td style={{...S.td,fontWeight:600}}>{i+1}</td>
                <td style={S.td}><Ni val={r.mpik} onChange={v=>setMaxdV(i,'mpik',v)}/></td>
                <td style={S.td}><Ni val={r.mpikW} onChange={v=>setMaxdV(i,'mpikW',v)}/></td>
                <td style={S.td}><Ni val={r.msamp} onChange={v=>setMaxdV(i,'msamp',v)}/></td>
                <td style={S.td}><Ni val={r.mpikSW} onChange={v=>setMaxdV(i,'mpikSW',v)}/></td>
                <td style={S.tdR}>{maxdCalc(r)||'-'}</td>
              </tr>
            ))}
            <tr style={{background:'#e3f2fd'}}>
              <td colSpan={5} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя:</td>
              <td style={{...S.tdR,fontSize:14}}>{maxdAvg()||'-'}</td>
            </tr>
          </tbody>
        </table>
        </div>
        {airVoids()!==null&&<div style={{marginTop:10,padding:'8px 14px',background:'#fff3e0',borderRadius:6,fontSize:14,fontWeight:700,color:'#e65100'}}>Воздушные пустоты: {airVoids()} %</div>}
      </div>

      {/* === 5. Водостойкость === */}
      <div style={S.sec}>
        <div style={S.secH}>5. Водостойкость</div>
        <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',fontSize:12,minWidth:560}}>
          <thead><tr>
            <th style={{...S.th,minWidth:40}}>&#8470;</th>
            <th style={{...S.th,minWidth:120}}>m сух, г</th>
            <th style={{...S.th,minWidth:120}}>m нас., г</th>
            <th style={{...S.th,minWidth:120}}>m в воде, г</th>
            <th style={{...S.thB,minWidth:100}}>Объём, см³</th>
            <th style={{...S.thB,minWidth:100}}>&rho;, г/см³</th>
          </tr></thead>
          <tbody>
            {wres.map((r,i)=>{
              const c=wresCalc(r)
              return(
                <tr key={i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                  <td style={{...S.td,fontWeight:600}}>{i+1}</td>
                  <td style={S.td}><Ni val={r.dry} onChange={v=>setWresV(i,'dry',v)}/></td>
                  <td style={S.td}><Ni val={r.sat} onChange={v=>setWresV(i,'sat',v)}/></td>
                  <td style={S.td}><Ni val={r.water} onChange={v=>setWresV(i,'water',v)}/></td>
                  <td style={S.tdR}>{c.vol}</td>
                  <td style={S.tdR}>{c.rho}</td>
                </tr>
              )
            })}
            <tr style={{background:'#e3f2fd'}}>
              <td colSpan={5} style={{...S.td,textAlign:'right',fontWeight:700}}>Средняя плотн.:</td>
              <td style={{...S.tdR,fontSize:14}}>{wresAvg()||'-'}</td>
            </tr>
          </tbody>
        </table></div>
      </div>

      {/* === 6. Примечания === */}
      <div style={S.sec}>
        <div style={S.secH}>6. Примечания и заключение</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={S.lbl}>Примечания</label><textarea value={notes} onChange={e=>{markDirty();setNotes(e.target.value)}} rows={3} style={{...S.inp,textAlign:'left',resize:'vertical'}} placeholder="Условия..."/></div>
          <div><label style={S.lbl}>Заключение</label><textarea value={conclusion} onChange={e=>{markDirty();setConclusion(e.target.value)}} rows={3} style={{...S.inp,textAlign:'left',resize:'vertical'}} placeholder="Соответствует/не соответствует..."/></div>
        </div>
      </div>

      <div style={{display:'flex',gap:10,paddingTop:8}}>
        <button type="button" onClick={()=>void handleSave()} disabled={saving}
          style={{padding:'10px 28px',background:saving?'#aaa':'#185fa5',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:600,cursor:saving?'default':'pointer'}}>
          {saving?'Сохраняю...':(isEdit?'Сохранить изменения':'Сохранить')}
        </button>
        <button type="button" onClick={()=>void handleClose()} style={{padding:'10px 18px',background:'transparent',color:'#666',border:'1px solid var(--inp-border)',borderRadius:6,fontSize:14,cursor:'pointer'}}>Закрыть</button>
      </div>

      </>}
    </div>
  )
}
