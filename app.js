'use strict';

const USERS = [
  { id:'1', email:'info.fvalentim@gmail.com', password:'Tatubo11a',   name:'Fernando Valentim', role:'ADMIN'   },
  { id:'2', email:'gerente@lunasys.com',       password:'gerente123',  name:'Gerente',           role:'MANAGER' },
  { id:'3', email:'operador@lunasys.com',      password:'operador123', name:'Operador',           role:'OPERATOR'},
];

const PERMISSIONS = {
  ADMIN:   ['vehicles.write','vehicles.delete','nc.read','nc.write','nc.delete'],
  MANAGER: ['vehicles.write','nc.read','nc.write'],
  OPERATOR:['vehicles.write'],
  VIEWER:  [],
};

const NC_TYPES = {
  inicio_sem_ok:'Início sem OK GS', nao_informado:'Início Não Informado',
  dados_incorretos:'SM Dados Incorretos', movimento_indevido:'Movimento Indevido',
  isca_problema:'Isca com Problema', interacao_cliente:'Interação do Cliente',
  fim_nao_informado:'Fim Não Informado', sm_atrasada:'SM Enviada Atrasada',
  fora_romaneio:'Fora do Romaneio', outros:'Outros',
};

const NC_PATTERNS = [
  {type:'inicio_sem_ok',      p:['sem aguardar a mensagem ok gs','inicio de viagem sem aguardar']},
  {type:'nao_informado',      p:['inicio de viagem não informado','inicio não informado']},
  {type:'dados_incorretos',   p:['sm com dados incorretos','dados incorretos']},
  {type:'movimento_indevido', p:['movimento indevido']},
  {type:'isca_problema',      p:['isca com problema']},
  {type:'interacao_cliente',  p:['interação do cliente','detectado interação']},
  {type:'fim_nao_informado',  p:['fim de viagem não informado']},
  {type:'sm_atrasada',        p:['sm enviada após','sm atrasada']},
  {type:'fora_romaneio',      p:['fora do romaneio']},
];

const State = {
  user:null, vehicles:[], ncs:[], theme:'light',
  save(){
    localStorage.setItem('rl_vehicles',JSON.stringify(this.vehicles));
    localStorage.setItem('rl_ncs',JSON.stringify(this.ncs));
    localStorage.setItem('rl_theme',this.theme);
  },
  load(){
    this.vehicles=JSON.parse(localStorage.getItem('rl_vehicles')||'[]');
    this.ncs=JSON.parse(localStorage.getItem('rl_ncs')||'[]');
    this.theme=localStorage.getItem('rl_theme')||'light';
    const u=localStorage.getItem('rl_user');
    this.user=u?JSON.parse(u):null;
  },
  saveUser(){
    if(this.user) localStorage.setItem('rl_user',JSON.stringify(this.user));
    else          localStorage.removeItem('rl_user');
  },
};

function can(p){ return !!(State.user&&(PERMISSIONS[State.user.role]||[]).includes(p)); }

function calcStatus(vig,sc){
  const s=(sc||'').toUpperCase();
  if(s==='OK') return 'OK';
  if(s==='VENCIDO') return 'VENCIDO';
  return 'PENDENTE';
}

function parseDate(v){
  if(!v) return null;
  const s=String(v).trim();
  if(/^\d+(\.\d+)?$/.test(s)){const d=new Date((parseFloat(s)-25569)*86400000);return isNaN(d)?null:d;}
  if(s.includes('/')){const[dp]=s.split(' ');const[d,m,y]=dp.split('/');const dt=new Date(+y,+m-1,+d);return isNaN(dt)?null:dt;}
  const dt=new Date(s);return isNaN(dt)?null:dt;
}

function fmtDate(v){const d=parseDate(v);return d?d.toLocaleDateString('pt-BR'):'-';}
function fmtDateTime(v){const d=parseDate(v);return d?d.toLocaleString('pt-BR'):'-';}
function toInputDate(v){const d=parseDate(v);return d?d.toISOString().split('T')[0]:'';}

function daysFromToday(v){
  const d=parseDate(v);
  if(!d) return null;
  return Math.floor((d.getTime()-Date.now())/86400000);
}

function classifyNC(desc){
  if(!desc) return 'outros';
  const low=desc.toLowerCase();
  for(const{type,p}of NC_PATTERNS){if(p.some(x=>low.includes(x))) return type;}
  return 'outros';
}

function normStatus(raw){
  const s=(raw||'').toLowerCase();
  if(/válid|valido|aprovado|ok/.test(s)) return 'OK';
  if(/vencido|expirado/.test(s))         return 'VENCIDO';
  return 'PENDENTE';
}

function getField(row,keys){
  for(const k of keys){if(row[k]!==undefined&&row[k]!==null&&row[k]!=='') return String(row[k]).trim();}
  return '';
}

function today(){return new Date().toISOString().split('T')[0];}

function esc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function countBy(arr,fn){
  return arr.reduce((acc,item)=>{const k=fn(item)||'?';acc[k]=(acc[k]||0)+1;return acc;},{});
}
function topN(obj,n){return Object.entries(obj).sort(([,a],[,b])=>b-a).slice(0,n);}

function toast(msg,type='info'){
  const stack=document.getElementById('toastStack');
  const el=document.createElement('div');
  el.className='toast toast-'+type;
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  el.innerHTML='<span>'+(icons[type]||'')+'</span><span>'+esc(msg)+'</span><button onclick="this.parentElement.remove()">×</button>';
  stack.appendChild(el);
  setTimeout(()=>el.remove(),4500);
}

const App={
  init(){
    State.load();
    if(State.theme==='dark') document.documentElement.classList.add('dark');
    if(State.user) this.showApp();
    else           this.showLogin();
    document.getElementById('loginForm').addEventListener('submit',e=>{
      e.preventDefault();
      const email=document.getElementById('loginEmail').value.trim();
      const pass=document.getElementById('loginPassword').value;
      const found=USERS.find(u=>u.email===email&&u.password===pass);
      if(!found){
        document.getElementById('loginError').classList.remove('hidden');
        return;
      }
      const{password:_,...user}=found;
      State.user=user; State.saveUser(); this.showApp();
    });
  },
  showLogin(){
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },
  showApp(){
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const u=State.user;
    document.getElementById('userName').textContent=u.name;
    document.getElementById('roleBadge').textContent=u.role;
    document.getElementById('roleBadge').className='role-badge role-'+u.role.toLowerCase();
    const canNC=can('nc.read');
    document.getElementById('tabNC').style.display=canNC?'':'none';
    document.getElementById('tabDash').style.display=canNC?'':'none';
    if(!can('vehicles.write')){['btnNovoVeiculo','btnImportFrota'].forEach(id=>document.getElementById(id).style.display='none');}
    if(!can('vehicles.delete')) document.getElementById('btnClearFrota').style.display='none';
    if(!can('nc.write'))         document.getElementById('btnImportNC').style.display='none';
    if(!can('nc.delete'))        document.getElementById('btnClearNC').style.display='none';
    Frota.render();
  },
  logout(){State.user=null;State.saveUser();location.reload();},
  showTab(name){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t=>t.classList.add('hidden'));
    document.querySelector('[data-tab="'+name+'"]').classList.add('active');
    document.getElementById('tab'+name.charAt(0).toUpperCase()+name.slice(1)).classList.remove('hidden');
    if(name==='dashboard') Dashboard.render();
    if(name==='frota') Frota.render();
  },
  toggleTheme(){
    State.theme=State.theme==='dark'?'light':'dark';
    document.documentElement.classList.toggle('dark',State.theme==='dark');
    document.querySelector('[onclick="App.toggleTheme()"]').textContent=State.theme==='dark'?'☀️':'🌙';
    State.save();
  },
};

const Frota={
  sortCol:null, sortDir:'asc',

  filtered(){
    const status=document.getElementById('frotaStatus').value;
    const date=document.getElementById('frotaDate').value;
    const search=document.getElementById('frotaSearch').value.toLowerCase();
    return State.vehicles.filter(v=>{
      if(status==='A_VENCER'){
        // veículos com validade entre hoje e +3 dias
        if(!v.vigenciaChecklist) return false;
        const diff=daysFromToday(v.vigenciaChecklist);
        if(diff===null) return false;
        return diff>=0 && diff<=3;
      }
      if(status!=='all'&&v.statusGeral!==status) return false;
      if(date&&v.vigenciaChecklist!==date) return false;
      if(search&&!(v.placa||'').toLowerCase().includes(search)) return false;
      return true;
    });
  },

  filter(){this.render();},

  sort(col){
    this.sortDir=this.sortCol===col&&this.sortDir==='asc'?'desc':'asc';
    this.sortCol=col; this.render();
  },

  render(){
    const v=State.vehicles;
    const ok=v.filter(x=>x.statusGeral==='OK').length;
    const pe=v.filter(x=>x.statusGeral==='PENDENTE').length;
    const ex=v.filter(x=>x.statusGeral==='VENCIDO').length;

    // Alert banner
    const banner=document.getElementById('alertBanner');
    const avencer=v.filter(x=>{
      if(!x.vigenciaChecklist) return false;
      const diff=daysFromToday(x.vigenciaChecklist);
      return diff!==null&&diff>=0&&diff<=3;
    }).length;

    if(ex>0||avencer>0){
      let msg='';
      if(ex>0) msg+='<span style="margin-right:16px">🔴 <strong>'+ex+' vencido'+(ex>1?'s':'')+'</strong> <button class="alert-btn" onclick="document.getElementById(\'frotaStatus\').value=\'VENCIDO\';Frota.filter()">Ver →</button></span>';
      if(avencer>0) msg+='<span>🟠 <strong>'+avencer+' vence'+(avencer>1?'m':'')+' em até 3 dias</strong> <button class="alert-btn alert-btn-orange" onclick="document.getElementById(\'frotaStatus\').value=\'A_VENCER\';Frota.filter()">Ver →</button></span>';
      banner.innerHTML='<span class="alert-icon">⚠️</span>'+msg;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    // Cards
    document.getElementById('frotaCards').innerHTML=
      mkCard(v.length,'Total de Veículos','registros','default','🚛')+
      mkCard(ok,'Checklists OK','em conformidade','success','✅')+
      mkCard(pe,'Pendentes','com defeito','warning','⚠️')+
      mkCardVencido(ex);

    // Table
    let data=this.filtered();
    if(this.sortCol){
      const ord={VENCIDO:0,PENDENTE:1,OK:2};
      data=[...data].sort((a,b)=>{
        if(this.sortCol==='statusGeral'){
          const diff=(ord[a.statusGeral]??3)-(ord[b.statusGeral]??3);
          return this.sortDir==='asc'?diff:-diff;
        }
        const av=String(a[this.sortCol]||''),bv=String(b[this.sortCol]||'');
        return this.sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
      });
    } else {
      // Default: vencidos primeiro
      const ord={VENCIDO:0,PENDENTE:1,OK:2};
      data=[...data].sort((a,b)=>(ord[a.statusGeral]??3)-(ord[b.statusGeral]??3));
    }

    const tbody=document.getElementById('frotaBody');
    if(data.length===0){
      tbody.innerHTML='<tr><td colspan="9" class="table-empty">Nenhum veículo encontrado.</td></tr>';
    } else {
      tbody.innerHTML=data.map(v=>{
        const isExp=v.statusGeral==='VENCIDO';
        const isPen=v.statusGeral==='PENDENTE';
        const rowCls=isExp?'row-expired':isPen?'row-pending':'';

        let daysCell='-';
        if(v.vigenciaChecklist){
          const diff=daysFromToday(v.vigenciaChecklist);
          if(diff===null) daysCell='-';
          else if(diff<0) daysCell='<span class="days-badge days-overdue">Vencido há '+Math.abs(diff)+'d</span>';
          else if(diff<8) daysCell='<span class="days-badge days-soon">Vence em '+diff+'d</span>';
          else            daysCell='<span class="days-badge days-ok">'+diff+'d restantes</span>';
        } else if(isExp){
          daysCell='<span class="days-badge days-overdue">Vencido</span>';
        }

        const defBadge=(v.dispositivosDefeito||0)>0
          ?'<span class="def-badge">'+v.dispositivosDefeito+' defeito'+(v.dispositivosDefeito>1?'s':'')+'</span>'
          :'<span class="ok-badge">✓</span>';

        const statusIcon=isExp?'🔴':isPen?'🟡':'🟢';

        return '<tr class="'+rowCls+'">'
          +'<td><span class="plate">'+esc(v.placa)+'</span></td>'
          +'<td><span class="type-tag">'+esc(v.tipo||'-')+'</span></td>'
          +'<td><span class="prop-tag prop-'+(v.propriedade||'').toLowerCase()+'">'+esc(v.propriedade||'-')+'</span></td>'
          +'<td class="date-cell">'+esc(v.dataRealizacao||'-')+'</td>'
          +'<td class="date-cell">'+(v.vigenciaChecklist?fmtDate(v.vigenciaChecklist):esc(v.validadeRaw||'-'))+'</td>'
          +'<td>'+daysCell+'</td>'
          +'<td>'+statusIcon+' <span class="st-text st-'+(v.statusGeral||'').toLowerCase()+'">'+esc(v.statusChecklist||'-')+'</span></td>'
          +'<td>'+defBadge+'</td>'
          +'<td><div class="row-actions">'
          +'<button class="icon-btn" onclick="Frota.openDetail(\''+esc(v.placa)+'\')" title="Ver detalhes">👁</button>'
          +(isExp||isPen?'<button class="icon-btn icon-btn-renew" onclick="Frota.openRenewModal(\''+esc(v.placa)+'\')" title="Renovar validade">🔄</button>':'')
          +(can('vehicles.delete')?'<button class="icon-btn icon-btn-del" onclick="Frota.delete(\''+esc(v.placa)+'\')" title="Excluir">🗑</button>':'')
          +'</div></td></tr>';
      }).join('');
    }

    document.getElementById('frotaFooter').textContent=v.length+' registros · '+data.length+' exibidos';
  },

  openRenewModal(placa){
    const v=State.vehicles.find(x=>x.placa===placa);
    if(!v) return;
    this._renewPlaca=placa;
    const ago=v.vigenciaChecklist?daysFromToday(v.vigenciaChecklist):null;
    let info='';
    if(ago!==null&&ago<0) info='Vencido há '+Math.abs(ago)+' dia'+(Math.abs(ago)>1?'s':'')+'.';
    else if(ago!==null)    info='Vence em '+ago+' dia'+(ago!==1?'s':'')+'. ';
    else if(ago!==null)    info='Vence em '+ago+' dia'+(ago!==1?'s':'')+'.';
    document.getElementById('renewModalDesc').textContent=
      'Placa: '+placa+(info?' — '+info:'');
    document.getElementById('renewDate').value='';
    document.getElementById('renewDateErr').classList.add('hidden');
    document.getElementById('renewStatus').value='OK';
    document.getElementById('renewModal').classList.remove('hidden');
  },

  closeRenewModal(){
    document.getElementById('renewModal').classList.add('hidden');
    this._renewPlaca=null;
  },

  saveRenew(){
    const placa=this._renewPlaca;
    const newDate=document.getElementById('renewDate').value;
    const newStatus=document.getElementById('renewStatus').value;
    if(!newDate){
      document.getElementById('renewDateErr').classList.remove('hidden');
      return;
    }
    State.vehicles=State.vehicles.map(v=>{
      if(v.placa!==placa) return v;
      return{
        ...v,
        vigenciaChecklist:newDate,
        statusChecklist:newStatus,
        statusGeral:calcStatus(newDate,newStatus),
        updatedAt:new Date().toISOString(),
      };
    });
    State.save();
    this.closeRenewModal();
    this.render();
    toast('✅ Validade de '+placa+' renovada para '+fmtDate(newDate),'success');
  },

  openDetail(placa){
    const v=State.vehicles.find(x=>x.placa===placa);
    if(!v) return;
    const devs=v.dispositivos||[];
    const okDevs=devs.filter(d=>(d.situacao||'').toLowerCase()==='ok');
    const badDevs=devs.filter(d=>(d.situacao||'').toLowerCase()!=='ok');

    let daysHtml='';
    if(v.vigenciaChecklist){
      const diff=daysFromToday(v.vigenciaChecklist);
      if(diff!==null){
        if(diff<0) daysHtml='<span class="days-badge days-overdue">⚠️ Vencido há '+Math.abs(diff)+' dia'+(Math.abs(diff)>1?'s':'')+'</span>';
        else if(diff<8) daysHtml='<span class="days-badge days-soon">⚡ Vence em '+diff+' dia'+(diff>1?'s':'')+'</span>';
        else daysHtml='<span class="days-badge days-ok">✓ Válido por mais '+diff+' dias</span>';
      }
    }

    document.getElementById('vehicleModalTitle').textContent=v.placa+' — Detalhes do Checklist';
    document.getElementById('vehicleModalContent').innerHTML=
      '<div class="detail-grid">'
      +'<div class="detail-row"><span class="detail-label">Placa</span><span class="plate">'+esc(v.placa)+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Tipo</span><span>'+esc(v.tipo||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Propriedade</span><span>'+esc(v.propriedade||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Status</span><span>'+(daysHtml||('<span class="st-text st-'+(v.statusGeral||'').toLowerCase()+'">'+esc(v.statusChecklist||'-')+'</span>'))+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Data Realização</span><span>'+esc(v.dataRealizacao||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Validade</span><span>'+(v.vigenciaChecklist?fmtDate(v.vigenciaChecklist):esc(v.validadeRaw||'-'))+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Responsável</span><span>'+esc(v.responsavel||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Operador</span><span>'+esc(v.operador||'-')+'</span></div>'
      +'</div>'
      +(badDevs.length>0?'<div class="detail-block detail-danger"><span class="detail-label">⚠️ Com defeito ('+badDevs.length+')</span><div class="device-tags">'+badDevs.map(d=>'<span class="device-tag device-bad">'+esc(d.dispositivo)+'</span>').join('')+'</div></div>':'')
      +'<div class="detail-block detail-ok"><span class="detail-label">✅ Aprovados ('+okDevs.length+')</span><div class="device-tags">'+okDevs.map(d=>'<span class="device-tag device-good">'+esc(d.dispositivo)+'</span>').join('')+'</div></div>';

    document.getElementById('vehicleModalForm').classList.add('hidden');
    document.getElementById('vehicleModalContent').classList.remove('hidden');
    document.getElementById('vehicleModalActions').style.display='flex';
    document.getElementById('vehicleModal').classList.remove('hidden');
  },

  openModal(placa=null){
    this.editing=placa;
    const isNew=!placa;
    document.getElementById('vehicleModalTitle').textContent=isNew?'Novo Veículo':'Editar — '+placa;
    ['mPlacaErr','mVigenciaErr','mStatusErr'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('vehicleModalContent').classList.add('hidden');
    document.getElementById('vehicleModalForm').classList.remove('hidden');
    document.getElementById('vehicleModalActions').style.display='none';
    if(isNew){
      document.getElementById('mPlaca').value=''; document.getElementById('mPlaca').disabled=false;
      document.getElementById('mVigencia').value=''; document.getElementById('mStatus').value='';
    } else {
      const v=State.vehicles.find(x=>x.placa===placa);
      document.getElementById('mPlaca').value=v.placa; document.getElementById('mPlaca').disabled=true;
      document.getElementById('mVigencia').value=toInputDate(v.vigenciaChecklist);
      document.getElementById('mStatus').value=v.statusChecklist;
    }
    document.getElementById('vehicleModal').classList.remove('hidden');
  },

  closeModal(){
    document.getElementById('vehicleModal').classList.add('hidden');
    document.getElementById('vehicleModalContent').classList.add('hidden');
    document.getElementById('vehicleModalForm').classList.remove('hidden');
    document.getElementById('vehicleModalActions').style.display='none';
  },

  saveModal(e){
    e.preventDefault();
    const placa=document.getElementById('mPlaca').value.trim().toUpperCase();
    const vigencia=document.getElementById('mVigencia').value;
    const status=document.getElementById('mStatus').value;
    let ok=true;
    if(!placa)    {document.getElementById('mPlacaErr').classList.remove('hidden');    ok=false;}
    if(!vigencia) {document.getElementById('mVigenciaErr').classList.remove('hidden'); ok=false;}
    if(!status)   {document.getElementById('mStatusErr').classList.remove('hidden');   ok=false;}
    if(!ok) return;
    const vehicle={placa,vigenciaChecklist:vigencia,statusChecklist:status,statusGeral:calcStatus(vigencia,status),updatedAt:new Date().toISOString()};
    if(this.editing){State.vehicles=State.vehicles.map(v=>v.placa===this.editing?vehicle:v);}
    else{
      if(State.vehicles.find(v=>v.placa===placa)){toast('Placa '+placa+' já existe.','warning');return;}
      State.vehicles.push(vehicle);
    }
    State.save(); this.closeModal(); this.render();
    toast('✅ Veículo '+placa+' salvo','success');
  },

  delete(placa){
    if(!confirm('🗑️ Excluir veículo '+placa+'?')) return;
    State.vehicles=State.vehicles.filter(v=>v.placa!==placa);
    State.save(); this.render(); toast('✅ '+placa+' excluído','success');
  },

  clearAll(){
    if(!confirm('🗑️ Limpar todos os veículos?')) return;
    State.vehicles=[]; State.save(); this.render(); toast('Dados limpos','info');
  },

  async import(e){
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rawRows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      const list=parseChecklistPlanilha(rawRows);
      if(!list.length){toast('Nenhum veículo válido encontrado','warning');return;}
      const placas=new Set(list.map(v=>v.placa));
      State.vehicles=[...State.vehicles.filter(v=>!placas.has(v.placa)),...list];
      State.save(); this.render(); toast('✅ '+list.length+' registros importados','success');
    }catch(err){toast('❌ '+err.message,'error');}
    finally{e.target.value='';}
  },

  exportXLS(){
    const data=this.filtered().map(v=>({
      'PLACA':v.placa,'TIPO':v.tipo||'','PROPRIEDADE':v.propriedade||'',
      'DATA REALIZAÇÃO':v.dataRealizacao||'',
      'VALIDADE':v.vigenciaChecklist?fmtDate(v.vigenciaChecklist):(v.validadeRaw||''),
      'STATUS':v.statusChecklist||'','DEFEITOS':v.dispositivosDefeito||0,
    }));
    const ws=XLSX.utils.json_to_sheet(data);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Checklist');
    XLSX.writeFile(wb,'lunasys_checklist_'+today()+'.xlsx');
  },

  exportPDF(){
    const{jsPDF}=window.jspdf; const doc=new jsPDF('landscape');
    pdfHeader(doc,'CHECKLIST DE FROTA');
    doc.autoTable({startY:38,
      head:[['PLACA','TIPO','PROP.','DATA REALIZAÇÃO','VALIDADE','STATUS','DEF.']],
      body:this.filtered().map(v=>[v.placa,v.tipo||'-',v.propriedade||'-',v.dataRealizacao||'-',
        v.vigenciaChecklist?fmtDate(v.vigenciaChecklist):(v.validadeRaw||'-'),v.statusChecklist||'-',v.dispositivosDefeito||0]),
      styles:{fontSize:7},headStyles:{fillColor:[15,23,42]},
      didParseCell(d){if(d.section==='body'&&d.column.index===5){
        if(d.cell.raw==='VENCIDO') d.cell.styles.textColor=[220,38,38];
        else if(d.cell.raw==='OK') d.cell.styles.textColor=[22,163,74];
      }},
    });
    pdfFooter(doc); doc.save('lunasys_checklist_'+today()+'.pdf');
  },

  exportVencidosPDF(){
    const vencidos=State.vehicles.filter(v=>v.statusGeral==='VENCIDO');
    if(!vencidos.length){toast('Nenhum vencido encontrado','info');return;}
    const{jsPDF}=window.jspdf; const doc=new jsPDF('landscape');
    pdfHeader(doc,'CHECKLISTS VENCIDOS — AÇÃO NECESSÁRIA');
    doc.autoTable({startY:38,
      head:[['PLACA','TIPO','PROPRIEDADE','DATA REALIZAÇÃO','STATUS','RESPONSÁVEL','DEFEITOS']],
      body:vencidos.map(v=>[v.placa,v.tipo||'-',v.propriedade||'-',v.dataRealizacao||'-',v.statusChecklist||'-',v.responsavel||'-',v.dispositivosDefeito||0]),
      styles:{fontSize:7},headStyles:{fillColor:[220,38,38]},
    });
    pdfFooter(doc); doc.save('lunasys_vencidos_'+today()+'.pdf');
    toast('📋 Relatório de '+vencidos.length+' vencidos exportado','success');
  },
};

const NC={
  sortCol:null,sortDir:'asc',
  filtered(){
    const type=document.getElementById('ncType').value;
    const vehicle=document.getElementById('ncVehicle').value.toLowerCase();
    const driver=document.getElementById('ncDriver').value.toLowerCase();
    const date=document.getElementById('ncDate').value;
    return State.ncs.filter(nc=>{
      if(type!=='all'&&nc.tipoNC!==type) return false;
      if(vehicle&&!(nc.veiculo||'').toLowerCase().includes(vehicle)) return false;
      if(driver&&!(nc.nomeCondutor||'').toLowerCase().includes(driver)) return false;
      if(date&&!(nc.dataOcorrencia||'').startsWith(date)) return false;
      return true;
    });
  },
  filter(){this.render();},
  sort(col){this.sortDir=this.sortCol===col&&this.sortDir==='asc'?'desc':'asc';this.sortCol=col;this.render();},
  render(){
    let data=this.filtered();
    if(this.sortCol){data=[...data].sort((a,b)=>{const av=String(a[this.sortCol]||''),bv=String(b[this.sortCol]||'');return this.sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);});}
    const n=State.ncs,td=today();
    const hoje=n.filter(nc=>(nc.dataOcorrencia||'').startsWith(td)).length;
    const veics=new Set(n.map(nc=>nc.veiculo).filter(Boolean)).size;
    const mots=new Set(n.map(nc=>nc.nomeCondutor).filter(Boolean)).size;
    document.getElementById('ncCards').innerHTML=
      mkCard(n.length,'Total NCs','não conformidades','default','🚨')+
      mkCard(hoje,'NCs Hoje','registros no dia','danger','📅')+
      mkCard(veics,'Veículos com NC','placas diferentes','warning','🚛')+
      mkCard(mots,'Motoristas','envolvidos em NCs','info','👤');
    const tbody=document.getElementById('ncBody');
    if(n.length===0){tbody.innerHTML='<tr><td colspan="6" class="table-empty">Nenhuma NC carregada. Use "Importar Planilha" para começar.</td></tr>';}
    else if(data.length===0){tbody.innerHTML='<tr><td colspan="6" class="table-empty">Nenhuma NC com os filtros aplicados.</td></tr>';}
    else{tbody.innerHTML=data.map(nc=>{
      const desc=(nc.naoConformidade||'').slice(0,55)+((nc.naoConformidade||'').length>55?'…':'');
      return '<tr>'
        +'<td>'+esc(nc.viagem||'-')+'</td>'
        +'<td><span class="plate">'+esc(nc.veiculo||'-')+'</span></td>'
        +'<td>'+esc(nc.nomeCondutor||'-')+'</td>'
        +'<td><span class="nc-text">'+esc(desc)+'</span><span class="nc-tag">'+esc(NC_TYPES[nc.tipoNC]||'Outros')+'</span></td>'
        +'<td class="date-cell">'+fmtDateTime(nc.dataOcorrencia)+'</td>'
        +'<td><div class="row-actions">'
        +'<button class="icon-btn" onclick="NC.openDetail(\''+esc(nc.id)+'\')" title="Ver">👁</button>'
        +(can('nc.delete')?'<button class="icon-btn icon-btn-del" onclick="NC.delete(\''+esc(nc.id)+'\')" title="Excluir">🗑</button>':'')
        +'</div></td></tr>';
    }).join('');}
    document.getElementById('ncFooter').textContent=n.length+' NCs · '+data.length+' filtradas';
  },
  openDetail(id){
    const nc=State.ncs.find(x=>x.id===id); if(!nc) return;
    document.getElementById('ncModalContent').innerHTML=
      '<div class="detail-grid">'
      +'<div class="detail-row"><span class="detail-label">Viagem</span><span>'+esc(nc.viagem||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Veículo</span><span class="plate">'+esc(nc.veiculo||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Motorista</span><span>'+esc(nc.nomeCondutor||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">CPF</span><span>'+esc(nc.cpfCondutor||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Origem</span><span>'+esc(nc.origem||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Destino</span><span>'+esc(nc.destino||'-')+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Data</span><span>'+fmtDateTime(nc.dataOcorrencia)+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">Embarcador</span><span>'+esc(nc.embarcador||'-')+'</span></div>'
      +'</div>'
      +'<div class="detail-block"><span class="detail-label">Não Conformidade</span><p style="margin-top:6px;line-height:1.6">'+esc(nc.naoConformidade||'-')+'</p><span class="nc-tag" style="margin-top:8px;display:inline-block">'+esc(NC_TYPES[nc.tipoNC]||'Outros')+'</span></div>'
      +'<div class="detail-block detail-muted"><span class="detail-label">Importação</span><p style="margin-top:4px;font-size:12px;color:var(--text3)">Arquivo: '+esc(nc.arquivoOrigem||'-')+' · Linha '+esc(nc.linhaOrigem||'-')+' · Por: '+esc(nc.importadoPor||'-')+'</p></div>';
    document.getElementById('ncModal').classList.remove('hidden');
  },
  closeModal(){document.getElementById('ncModal').classList.add('hidden');},
  delete(id){
    if(!confirm('🗑️ Excluir esta NC?')) return;
    State.ncs=State.ncs.filter(nc=>nc.id!==id);
    State.save(); this.render(); toast('✅ NC excluída','success');
  },
  clearAll(){
    if(!confirm('🗑️ Limpar todas as NCs?')) return;
    State.ncs=[]; State.save(); this.render(); toast('NCs limpas','info');
  },
  async import(e){
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const list=rows.map((row,i)=>{
        const veiculo=getField(row,['Veículo','Veiculo']).toUpperCase();
        const naoConformidade=getField(row,['Não Conformidade','Nao Conformidade']);
        if(!veiculo||!naoConformidade) return null;
        const d=parseDate(getField(row,['Data Ocorrencia','Data Ocorrência']));
        return{id:'nc_'+Date.now()+'_'+i,viagem:getField(row,['Viagem']),cliente:getField(row,['Cliente']),
          embarcador:getField(row,['Embarcador']),veiculo,cpfCondutor:getField(row,['CPF Condutor']),
          nomeCondutor:getField(row,['Nome Condutor']),origem:getField(row,['Origem']),destino:getField(row,['Destino']),
          naoConformidade,dataOcorrencia:d?d.toISOString().split('T')[0]:'',tipoNC:classifyNC(naoConformidade),
          importadoEm:today(),arquivoOrigem:file.name,linhaOrigem:i+1,importadoPor:State.user?.name||'Sistema'};
      }).filter(Boolean);
      if(!list.length){toast('Nenhuma NC válida encontrada','warning');return;}
      State.ncs=list; State.save(); this.render(); toast('✅ '+list.length+' NCs importadas','success');
    }catch(err){toast('❌ '+err.message,'error');}
    finally{e.target.value='';}
  },
  exportXLS(){
    const data=this.filtered().map(nc=>({'VIAGEM':nc.viagem||'','VEÍCULO':nc.veiculo||'','MOTORISTA':nc.nomeCondutor||'','NÃO CONFORMIDADE':nc.naoConformidade||'','TIPO':NC_TYPES[nc.tipoNC]||'Outros','DATA':fmtDateTime(nc.dataOcorrencia)}));
    const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'NC'); XLSX.writeFile(wb,'lunasys_nc_'+today()+'.xlsx');
  },
  exportPDF(){
    const{jsPDF}=window.jspdf; const doc=new jsPDF('landscape');
    pdfHeader(doc,'NÃO CONFORMIDADES');
    doc.autoTable({startY:38,head:[['VIAGEM','VEÍCULO','MOTORISTA','TIPO','DATA']],
      body:this.filtered().map(nc=>[nc.viagem||'-',nc.veiculo||'-',nc.nomeCondutor||'-',NC_TYPES[nc.tipoNC]||'Outros',fmtDateTime(nc.dataOcorrencia)]),
      styles:{fontSize:8},headStyles:{fillColor:[15,23,42]}});
    pdfFooter(doc); doc.save('lunasys_nc_'+today()+'.pdf');
  },
};

const Dashboard={
  days:30, charts:{},
  setPeriod(days,btn){
    this.days=days;
    document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); this.render();
  },
  filtered(){
    if(!this.days) return State.ncs;
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-this.days);
    return State.ncs.filter(nc=>{const d=parseDate(nc.dataOcorrencia);return d&&d>=cutoff;});
  },
  render(){
    const data=this.filtered(), all=State.ncs;
    if(!all.length){
      document.getElementById('dashEmpty').classList.remove('hidden');
      document.getElementById('dashContent').classList.add('hidden'); return;
    }
    document.getElementById('dashEmpty').classList.add('hidden');
    document.getElementById('dashContent').classList.remove('hidden');

    const avgDaily=this.days?(data.length/Math.max(this.days,1)).toFixed(1):'-';
    const byVehicle=countBy(data,nc=>nc.veiculo);
    const byDriver=countBy(data,nc=>nc.nomeCondutor);
    const topV=topN(byVehicle,1)[0],topD=topN(byDriver,1)[0];

    document.getElementById('dashMetrics').innerHTML=
      dashMetric(data.length,'Total NCs','no período selecionado','#ef4444')+
      dashMetric(avgDaily,'Média Diária','NCs por dia','#f97316')+
      dashMetric(topV?.[0]||'-','Veículo Crítico',topV?topV[1]+' ocorrências':'nenhum','#8b5cf6')+
      dashMetric((topD?.[0]||'-').split(' ')[0],'Motorista Crítico',topD?topD[1]+' ocorrências':'nenhum','#0ea5e9');

    const isDark=document.documentElement.classList.contains('dark');
    const tc=isDark?'#94a3b8':'#64748b';
    const gc=isDark?'rgba(148,163,184,0.08)':'rgba(0,0,0,0.05)';
    const COLORS=['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1'];

    const tt={backgroundColor:isDark?'#1e293b':'#ffffff',titleColor:isDark?'#e2e8f0':'#0f172a',bodyColor:isDark?'#94a3b8':'#475569',borderColor:isDark?'#334155':'#e2e8f0',borderWidth:1,padding:12,cornerRadius:8};
    const sc={ticks:{color:tc,font:{size:11}},grid:{color:gc}};
    const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tt},scales:{x:sc,y:{...sc,beginAtZero:true}}};

    // Tipo doughnut
    const byType=countBy(data,nc=>nc.tipoNC||'outros');
    this.mk('chartTipo','doughnut',Object.keys(byType).map(k=>NC_TYPES[k]||k),Object.values(byType),COLORS,
      {responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{color:tc,font:{size:11},boxWidth:10,padding:12}},tooltip:tt}});

    // Evolução line
    const byDay={};
    data.forEach(nc=>{const d=parseDate(nc.dataOcorrencia);if(!d)return;const k=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});byDay[k]=(byDay[k]||0)+1;});
    this.mkLine('chartEvolucao',Object.keys(byDay),Object.values(byDay),base);

    // Top veículos bar horizontal
    const tv=topN(byVehicle,10);
    this.mk('chartVeiculos','bar',tv.map(([k])=>k),tv.map(([,v])=>v),COLORS.slice(0,tv.length),
      {...base,indexAxis:'y',scales:{x:{...sc,beginAtZero:true},y:sc}});

    // Top motoristas bar horizontal
    const td2=topN(byDriver,10);
    this.mk('chartMotoristas','bar',td2.map(([k])=>(k||'').split(' ')[0]),td2.map(([,v])=>v),
      td2.map((_,i)=>COLORS[i%COLORS.length]),
      {...base,indexAxis:'y',scales:{x:{...sc,beginAtZero:true},y:sc}});

    // Dia da semana
    const sem=[0,0,0,0,0,0,0];
    data.forEach(nc=>{const d=parseDate(nc.dataOcorrencia);if(d)sem[d.getDay()]++;});
    const maxSem=Math.max(...sem);
    this.mk('chartSemana','bar',['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],sem,
      sem.map(v=>v===maxSem&&v>0?'#ef4444':'#3b82f6'),{...base});
  },
  mk(id,type,labels,data,colors,opts){
    if(this.charts[id]){this.charts[id].destroy();delete this.charts[id];}
    const ctx=document.getElementById(id).getContext('2d');
    const ds={data,backgroundColor:colors,borderWidth:0,borderRadius:type==='bar'?4:0};
    this.charts[id]=new Chart(ctx,{type,data:{labels,datasets:[ds]},options:opts});
  },
  mkLine(id,labels,data,opts){
    if(this.charts[id]){this.charts[id].destroy();delete this.charts[id];}
    const ctx=document.getElementById(id).getContext('2d');
    const ds={data,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',fill:true,tension:0.4,borderWidth:2,pointRadius:3,pointBackgroundColor:'#3b82f6'};
    this.charts[id]=new Chart(ctx,{type:'line',data:{labels,datasets:[ds]},options:opts});
  },
  exportPDF(){
    const{jsPDF}=window.jspdf; const doc=new jsPDF();
    pdfHeader(doc,'DASHBOARD DE ANÁLISE');
    let y=42; const data=this.filtered();
    doc.setFontSize(11);
    doc.text('Período: '+(this.days?'Últimos '+this.days+' dias':'Todo o período'),20,y);y+=8;
    doc.text('Total de NCs: '+data.length,20,y);y+=8;
    const byType=countBy(data,nc=>nc.tipoNC||'outros');
    doc.text('Por tipo:',20,y);y+=6;
    Object.entries(byType).forEach(([k,v])=>{doc.setFontSize(9);doc.text('  '+(NC_TYPES[k]||k)+': '+v,20,y);y+=5;});
    pdfFooter(doc); doc.save('lunasys_dashboard_'+today()+'.pdf');
  },
};

function mkCard(value,label,sub,mod,icon){
  return '<div class="card card-'+mod+'">'
    +'<div class="card-icon">'+icon+'</div>'
    +'<div class="card-value">'+value+'</div>'
    +'<div class="card-label">'+label+'</div>'
    +'<div class="card-sub">'+sub+'</div>'
    +'</div>';
}

function mkCardVencido(count){
  const cls='card card-danger'+(count>0?' card-pulse':'');
  const onclick=count>0?' onclick="document.getElementById(\'frotaStatus\').value=\'VENCIDO\';Frota.filter()" style="cursor:pointer"':'';
  return '<div class="'+cls+'"'+onclick+'>'
    +'<div class="card-icon">'+(count>0?'🔴':'✅')+'</div>'
    +'<div class="card-value">'+count+'</div>'
    +'<div class="card-label">Vencidos</div>'
    +'<div class="card-sub">'+(count>0?'clique para ver':'todos em dia')+'</div>'
    +'</div>';
}

function dashMetric(value,label,sub,color){
  return '<div class="dash-metric" style="border-top:3px solid '+color+'">'
    +'<div class="dash-metric-value" style="color:'+color+'">'+value+'</div>'
    +'<div class="dash-metric-label">'+label+'</div>'
    +'<div class="dash-metric-sub">'+sub+'</div>'
    +'</div>';
}

function pdfHeader(doc,title){
  const w=doc.internal.pageSize.width;
  doc.setFillColor(15,23,42); doc.rect(0,0,w,28,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(14);
  doc.text('LUNASYS — '+title,w/2,12,{align:'center'});
  doc.setFontSize(8); doc.setTextColor(148,163,184);
  doc.text('Gerado em: '+new Date().toLocaleString('pt-BR')+' · Usuário: '+(State.user?.name||'-'),w/2,22,{align:'center'});
  doc.setTextColor(0,0,0);
}

function pdfFooter(doc){
  const n=doc.internal.getNumberOfPages(), w=doc.internal.pageSize.width, h=doc.internal.pageSize.height;
  for(let i=1;i<=n;i++){
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text('LUNASYS Logística · Pág. '+i+'/'+n,w/2,h-8,{align:'center'});
  }
}

function parseChecklistPlanilha(rows){
  const records=[];
  let current=null, devices=[];
  function finalize(){
    if(!current) return;
    current.dispositivos=devices.slice();
    current.totalDispositivos=devices.length;
    current.dispositivosOk=devices.filter(d=>(d.situacao||'').toLowerCase()==='ok').length;
    current.dispositivosDefeito=devices.filter(d=>(d.situacao||'').toLowerCase()!=='ok').length;
    const val=(current.validadeRaw||'').trim();
    let sc,vc;
    if(/vencido/i.test(val)){sc='VENCIDO';vc='';}
    else if(/não ok|nao ok/i.test(val)){sc='PENDENTE';vc='';}
    else if(/ok até embarque|ok ate embarque/i.test(val)){sc='OK';vc='';}
    else{
      const m=val.match(/(\d{2}\/\d{2}\/\d{4})/);
      if(m){const d=parseDate(m[1]);vc=d?d.toISOString().split('T')[0]:'';sc=current.dispositivosDefeito>0?'PENDENTE':'OK';}
      else{sc='PENDENTE';vc='';}
    }
    if(current.dispositivosDefeito>0&&sc==='OK') sc='PENDENTE';
    current.statusChecklist=sc; current.vigenciaChecklist=vc;
    current.statusGeral=calcStatus(vc,sc);
    records.push(current);
  }
  for(const row of rows){
    const a=row[0]!=null?String(row[0]).trim():'';
    const b=row[1]!=null?String(row[1]).trim():'';
    if(/^ve[íi]culo\s*:/i.test(a)){
      finalize(); current={tipo:'Veículo',placa:a.replace(/^ve[íi]culo\s*:\s*/i,'').trim().toUpperCase(),propriedade:b}; devices=[];
    } else if(/^carreta\s*:/i.test(a)){
      finalize(); current={tipo:'Carreta',placa:a.replace(/^carreta\s*:\s*/i,'').trim().toUpperCase(),propriedade:b}; devices=[];
    } else if(!current){
      continue;
    } else if(/^data da realiza/i.test(a)){
      current.dataRealizacao=a.replace(/^data da realiza[çc][ãa]o\s*:\s*/i,'').trim();
      current.validadeRaw=b.replace(/^validade\s*:\s*/i,'').trim();
    } else if(/^respons[aá]vel\s*:/i.test(a)){
      current.responsavel=a.replace(/^respons[aá]vel\s*:\s*/i,'').trim(); current.cpf=b;
    } else if(/^operador\s*:/i.test(a)){
      current.operador=a.replace(/^operador\s*:\s*/i,'').trim();
    } else if(a&&b&&!/^dispositivos\s+avaliados/i.test(a)){
      const sit=b.toLowerCase();
      if(sit==='ok'||sit==='defeito') devices.push({dispositivo:a,situacao:b});
    }
  }
  finalize();
  return records;
}

App.init();
