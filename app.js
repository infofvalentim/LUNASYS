// ═══════════════════════════════════════════════════
// LUNASYS — app.js
// Toda a lógica da aplicação em um único arquivo
// ═══════════════════════════════════════════════════

'use strict';

// ─── Usuários ──────────────────────────────────────
const USERS = [
  { id:'1', email:'admin@rondolog.com',        password:'admin123',    name:'Administrador', role:'ADMIN'    },
  { id:'2', email:'gerente@rondolog.com',       password:'gerente123',  name:'Gerente',       role:'MANAGER'  },
  { id:'3', email:'operador@rondolog.com',      password:'operador123', name:'Operador',       role:'OPERATOR' },
  { id:'4', email:'visualizador@rondolog.com',  password:'viewer123',   name:'Visualizador',  role:'VIEWER'   },
];

const PERMISSIONS = {
  ADMIN:    ['vehicles.write','vehicles.delete','nc.read','nc.write','nc.delete'],
  MANAGER:  ['vehicles.write','nc.read','nc.write'],
  OPERATOR: ['vehicles.write'],
  VIEWER:   [],
};

// ─── Tipos de NC ───────────────────────────────────
const NC_TYPES = {
  inicio_sem_ok:      'Início sem OK GS',
  nao_informado:      'Início Não Informado',
  dados_incorretos:   'SM Dados Incorretos',
  movimento_indevido: 'Movimento Indevido',
  isca_problema:      'Isca com Problema',
  interacao_cliente:  'Interação do Cliente',
  fim_nao_informado:  'Fim Não Informado',
  sm_atrasada:        'SM Enviada Atrasada',
  fora_romaneio:      'Fora do Romaneio',
  outros:             'Outros',
};

const NC_PATTERNS = [
  { type:'inicio_sem_ok',      p:['sem aguardar a mensagem ok gs','inicio de viagem sem aguardar'] },
  { type:'nao_informado',      p:['inicio de viagem não informado','inicio não informado'] },
  { type:'dados_incorretos',   p:['sm com dados incorretos','dados incorretos'] },
  { type:'movimento_indevido', p:['movimento indevido'] },
  { type:'isca_problema',      p:['isca com problema'] },
  { type:'interacao_cliente',  p:['interação do cliente','detectado interação'] },
  { type:'fim_nao_informado',  p:['fim de viagem não informado'] },
  { type:'sm_atrasada',        p:['sm enviada após','sm atrasada'] },
  { type:'fora_romaneio',      p:['fora do romaneio'] },
];

// ─── Estado global ─────────────────────────────────
const State = {
  user:     null,
  vehicles: [],
  ncs:      [],
  theme:    'light',

  save() {
    localStorage.setItem('rl_vehicles', JSON.stringify(this.vehicles));
    localStorage.setItem('rl_ncs',      JSON.stringify(this.ncs));
    localStorage.setItem('rl_theme',    this.theme);
  },

  load() {
    this.vehicles = JSON.parse(localStorage.getItem('rl_vehicles') || '[]');
    this.ncs      = JSON.parse(localStorage.getItem('rl_ncs')      || '[]');
    this.theme    = localStorage.getItem('rl_theme') || 'light';
    const u = localStorage.getItem('rl_user');
    this.user = u ? JSON.parse(u) : null;
  },

  saveUser() {
    if (this.user) localStorage.setItem('rl_user', JSON.stringify(this.user));
    else           localStorage.removeItem('rl_user');
  },
};

// ─── Helpers ───────────────────────────────────────
function can(permission) {
  if (!State.user) return false;
  return (PERMISSIONS[State.user.role] || []).includes(permission);
}

function calcStatus(vigencia, statusChecklist) {
  const s = (statusChecklist || '').toUpperCase();
  if (s === 'OK')      return 'OK';
  if (s === 'VENCIDO') return 'VENCIDO';
  return 'PENDENTE';
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date((parseFloat(s) - 25569) * 86400000);
    return isNaN(d) ? null : d;
  }
  if (s.includes('/')) {
    const [dp] = s.split(' ');
    const [d, m, y] = dp.split('/');
    const dt = new Date(+y, +m - 1, +d);
    return isNaN(dt) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

function fmtDate(v) {
  const d = parseDate(v);
  if (!d) return '-';
  return d.toLocaleDateString('pt-BR');
}

function fmtDateTime(v) {
  const d = parseDate(v);
  if (!d) return '-';
  return d.toLocaleString('pt-BR');
}

function toInputDate(v) {
  const d = parseDate(v);
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function classifyNC(desc) {
  if (!desc) return 'outros';
  const low = desc.toLowerCase();
  for (const { type, p } of NC_PATTERNS) {
    if (p.some(x => low.includes(x))) return type;
  }
  return 'outros';
}

function normStatus(raw) {
  const s = (raw || '').toLowerCase();
  if (/válid|valido|aprovado|ok/.test(s))  return 'OK';
  if (/vencido|expirado/.test(s))          return 'VENCIDO';
  return 'PENDENTE';
}

function getField(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]).trim();
  }
  return '';
}

function today() { return new Date().toISOString().split('T')[0]; }

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Toast ─────────────────────────────────────────
function toast(msg, type = 'info') {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  el.innerHTML = `<span>${icons[type]||''}</span><span>${esc(msg)}</span>
    <button onclick="this.parentElement.remove()">×</button>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── App controller ────────────────────────────────
const App = {
  init() {
    State.load();
    if (State.theme === 'dark') document.documentElement.classList.add('dark');
    if (State.user) this.showApp();
    else            this.showLogin();

    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const pass  = document.getElementById('loginPassword').value;
      const found = USERS.find(u => u.email === email && u.password === pass);
      if (!found) {
        document.getElementById('loginError').classList.remove('hidden');
        return;
      }
      const { password: _, ...user } = found;
      State.user = user;
      State.saveUser();
      this.showApp();
    });
  },

  showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    const u = State.user;
    document.getElementById('userName').textContent   = u.name;
    document.getElementById('roleBadge').textContent  = u.role;
    document.getElementById('roleBadge').className    = `role-badge role-${u.role.toLowerCase()}`;

    // Show/hide NC tabs based on role
    const canNC = can('nc.read');
    document.getElementById('tabNC').style.display   = canNC ? '' : 'none';
    document.getElementById('tabDash').style.display = canNC ? '' : 'none';

    // Show/hide write buttons
    if (!can('vehicles.write')) {
      document.getElementById('btnNovoVeiculo').style.display = 'none';
      document.getElementById('btnImportFrota').style.display = 'none';
    }
    if (!can('vehicles.delete')) document.getElementById('btnClearFrota').style.display = 'none';
    if (!can('nc.write'))        document.getElementById('btnImportNC').style.display   = 'none';
    if (!can('nc.delete'))       document.getElementById('btnClearNC').style.display    = 'none';

    Frota.render();
  },

  logout() {
    State.user = null;
    State.saveUser();
    this.showLogin();
  },

  showTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelector(`[data-tab="${name}"]`).classList.add('active');
    document.getElementById(`tab${name.charAt(0).toUpperCase()+name.slice(1)}`).classList.remove('hidden');
    if (name === 'dashboard') Dashboard.render();
  },

  toggleTheme() {
    State.theme = State.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', State.theme === 'dark');
    document.querySelector('[onclick="App.toggleTheme()"]').textContent = State.theme === 'dark' ? '☀️' : '🌙';
    State.save();
  },
};

// ─── FROTA ─────────────────────────────────────────
const Frota = {
  sortCol: null,
  sortDir: 'asc',
  editing: null,  // placa being edited, or null for new

  filtered() {
    const status = document.getElementById('frotaStatus').value;
    const date   = document.getElementById('frotaDate').value;
    const search = document.getElementById('frotaSearch').value.toLowerCase();

    return State.vehicles.filter(v => {
      if (status !== 'all' && v.statusGeral !== status) return false;
      if (date   && v.vigenciaChecklist !== date)       return false;
      if (search && !v.placa.toLowerCase().includes(search)) return false;
      return true;
    });
  },

  filter() { this.render(); },

  sort(col) {
    this.sortDir = this.sortCol === col && this.sortDir === 'asc' ? 'desc' : 'asc';
    this.sortCol = col;
    this.render();
  },

  render() {
    let data = this.filtered();

    if (this.sortCol) {
      data = [...data].sort((a, b) => {
        const av = String(a[this.sortCol] || '');
        const bv = String(b[this.sortCol] || '');
        return this.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    // Cards
    const v  = State.vehicles;
    const ok = v.filter(x => x.statusGeral === 'OK').length;
    const pe = v.filter(x => x.statusGeral === 'PENDENTE').length;
    const ex = v.filter(x => x.statusGeral === 'VENCIDO').length;
    document.getElementById('frotaCards').innerHTML = `
      ${card(v.length,'Total','veículos','default')}
      ${card(ok,'OK','em conformidade','success')}
      ${card(pe,'Pendentes','sem informação','warning')}
      ${card(ex,'Vencidos','fora da validade','danger')}
    `;

    // Table
    const tbody = document.getElementById('frotaBody');
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Nenhum veículo encontrado.</td></tr>`;
    } else {
      tbody.innerHTML = data.map(v => {
        const badgeCls = { OK:'badge-success', PENDENTE:'badge-warning', VENCIDO:'badge-danger' }[v.statusGeral] || 'badge-secondary';
        const rowCls   = { PENDENTE:'row-pending', VENCIDO:'row-expired' }[v.statusGeral] || '';
        const canEdit  = can('vehicles.write');
        const canDel   = can('vehicles.delete');
        return `<tr class="${rowCls}">
          <td><span class="plate">${esc(v.placa)}</span></td>
          <td>${fmtDate(v.vigenciaChecklist)}</td>
          <td>${esc(v.statusChecklist||'-')}</td>
          <td><span class="badge ${badgeCls}">${esc(v.statusGeral||'-')}</span></td>
          <td>
            ${canEdit ? `<button class="btn btn-sm btn-warning" onclick="Frota.openModal('${esc(v.placa)}')">Editar</button>` : ''}
            ${canDel  ? `<button class="btn btn-sm btn-danger"  onclick="Frota.delete('${esc(v.placa)}')">Excluir</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    document.getElementById('frotaFooter').textContent =
      `${v.length} veículos · ${data.length} filtrados`;
  },

  openModal(placa = null) {
    this.editing = placa;
    const isNew  = !placa;
    document.getElementById('vehicleModalTitle').textContent = isNew ? 'Novo Veículo' : `Editar — ${placa}`;
    document.getElementById('mPlacaErr').classList.add('hidden');
    document.getElementById('mVigenciaErr').classList.add('hidden');
    document.getElementById('mStatusErr').classList.add('hidden');

    if (isNew) {
      document.getElementById('mPlaca').value   = '';
      document.getElementById('mVigencia').value = '';
      document.getElementById('mStatus').value   = '';
      document.getElementById('mPlaca').disabled = false;
    } else {
      const v = State.vehicles.find(x => x.placa === placa);
      document.getElementById('mPlaca').value    = v.placa;
      document.getElementById('mVigencia').value = toInputDate(v.vigenciaChecklist);
      document.getElementById('mStatus').value   = v.statusChecklist;
      document.getElementById('mPlaca').disabled = true;
    }
    document.getElementById('vehicleModal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('vehicleModal').classList.add('hidden');
  },

  saveModal(e) {
    e.preventDefault();
    const placa    = document.getElementById('mPlaca').value.trim().toUpperCase();
    const vigencia = document.getElementById('mVigencia').value;
    const status   = document.getElementById('mStatus').value;

    let ok = true;
    if (!placa)   { document.getElementById('mPlacaErr').classList.remove('hidden');    ok = false; }
    if (!vigencia){ document.getElementById('mVigenciaErr').classList.remove('hidden'); ok = false; }
    if (!status)  { document.getElementById('mStatusErr').classList.remove('hidden');   ok = false; }
    if (!ok) return;

    const vehicle = { placa, vigenciaChecklist: vigencia, statusChecklist: status,
                      statusGeral: calcStatus(vigencia, status), updatedAt: new Date().toISOString() };

    if (this.editing) {
      State.vehicles = State.vehicles.map(v => v.placa === this.editing ? vehicle : v);
    } else {
      if (State.vehicles.find(v => v.placa === placa)) {
        toast(`Placa ${placa} já existe.`, 'warning');
        return;
      }
      State.vehicles.push(vehicle);
    }
    State.save();
    this.closeModal();
    this.render();
    toast(`✅ Veículo ${placa} salvo`,'success');
  },

  delete(placa) {
    if (!confirm(`🗑️ Excluir veículo ${placa}?`)) return;
    State.vehicles = State.vehicles.filter(v => v.placa !== placa);
    State.save();
    this.render();
    toast(`✅ ${placa} excluído`,'success');
  },

  clearAll() {
    if (!confirm('🗑️ Limpar todos os veículos?')) return;
    State.vehicles = [];
    State.save();
    this.render();
    toast('Dados limpos','info');
  },

  async import(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb   = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type:'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const list = rows.map(row => {
        const placa = getField(row, ['Veículo','Veiculo','Placa','PLACA','VEÍCULO']);
        if (!placa) return null;
        const statusRaw   = getField(row, ['Status','STATUS','Status Checklist']);
        const validadeRaw = getField(row, ['Validade','Vencimento','Validade Checklist']);
        const dataRaw     = getField(row, ['Data Realização','Data Realizacao','Data']);
        const statusChecklist = normStatus(statusRaw);
        let vigenciaChecklist = toInputDate(validadeRaw);
        if (!vigenciaChecklist && dataRaw) {
          const d = parseDate(dataRaw);
          if (d) { d.setDate(d.getDate()+30); vigenciaChecklist = d.toISOString().split('T')[0]; }
        }
        return { placa: placa.toUpperCase().trim(), vigenciaChecklist, statusChecklist,
                 statusGeral: calcStatus(vigenciaChecklist, statusChecklist) };
      }).filter(Boolean);

      if (!list.length) { toast('Nenhum veículo válido encontrado','warning'); return; }
      State.vehicles = list;
      State.save();
      this.render();
      toast(`✅ ${list.length} veículos importados`,'success');
    } catch(err) {
      toast(`❌ ${err.message}`,'error');
    } finally {
      e.target.value = '';
    }
  },

  exportXLS() {
    const data = this.filtered().map(v => ({
      'PLACA': v.placa, 'VIGÊNCIA': fmtDate(v.vigenciaChecklist),
      'STATUS CHECKLIST': v.statusChecklist||'', 'STATUS GERAL': v.statusGeral||'',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Frota');
    XLSX.writeFile(wb, `rondolog_frota_${today()}.xlsx`);
  },

  exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'CHECKLIST DE FROTA');
    doc.autoTable({
      startY: 38,
      head: [['PLACA','VIGÊNCIA','STATUS CHECKLIST','STATUS GERAL']],
      body: this.filtered().map(v => [v.placa, fmtDate(v.vigenciaChecklist), v.statusChecklist||'-', v.statusGeral||'-']),
      styles: { fontSize:8 }, headStyles: { fillColor:[0,0,0] },
    });
    pdfFooter(doc);
    doc.save(`rondolog_frota_${today()}.pdf`);
  },
};

// ─── NC ────────────────────────────────────────────
const NC = {
  sortCol: null,
  sortDir: 'asc',

  filtered() {
    const type    = document.getElementById('ncType').value;
    const vehicle = document.getElementById('ncVehicle').value.toLowerCase();
    const driver  = document.getElementById('ncDriver').value.toLowerCase();
    const date    = document.getElementById('ncDate').value;

    return State.ncs.filter(nc => {
      if (type !== 'all' && nc.tipoNC !== type) return false;
      if (vehicle && !(nc.veiculo||'').toLowerCase().includes(vehicle)) return false;
      if (driver  && !(nc.nomeCondutor||'').toLowerCase().includes(driver)) return false;
      if (date    && !(nc.dataOcorrencia||'').startsWith(date)) return false;
      return true;
    });
  },

  filter() { this.render(); },

  sort(col) {
    this.sortDir = this.sortCol === col && this.sortDir === 'asc' ? 'desc' : 'asc';
    this.sortCol = col;
    this.render();
  },

  render() {
    let data = this.filtered();
    if (this.sortCol) {
      data = [...data].sort((a, b) => {
        const av = String(a[this.sortCol]||'');
        const bv = String(b[this.sortCol]||'');
        return this.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    const n  = State.ncs;
    const td = today();
    const hoje = n.filter(nc => (nc.dataOcorrencia||'').startsWith(td)).length;
    const veics = new Set(n.map(nc => nc.veiculo).filter(Boolean)).size;
    const mots  = new Set(n.map(nc => nc.nomeCondutor).filter(Boolean)).size;

    document.getElementById('ncCards').innerHTML = `
      ${card(n.length, 'Total NCs',       'não conformidades', 'default')}
      ${card(hoje,     'NCs Hoje',         'registros no dia',  'danger')}
      ${card(veics,    'Veículos com NC',  'placas diferentes', 'warning')}
      ${card(mots,     'Motoristas',       'envolvidos em NCs', 'success')}
    `;

    const tbody = document.getElementById('ncBody');
    if (n.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nenhuma NC carregada. Use "Importar Planilha" para começar.</td></tr>`;
    } else if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nenhuma NC com os filtros aplicados.</td></tr>`;
    } else {
      tbody.innerHTML = data.map(nc => {
        const desc = (nc.naoConformidade||'').slice(0,55) + ((nc.naoConformidade||'').length>55?'…':'');
        const canDel = can('nc.delete');
        return `<tr>
          <td>${esc(nc.viagem||'-')}</td>
          <td><span class="plate">${esc(nc.veiculo||'-')}</span></td>
          <td>${esc(nc.nomeCondutor||'-')}</td>
          <td>
            <span class="nc-text">${esc(desc)}</span>
            <span class="nc-tag">${esc(NC_TYPES[nc.tipoNC]||'Outros')}</span>
          </td>
          <td>${fmtDateTime(nc.dataOcorrencia)}</td>
          <td>
            <div class="actions">
              <button class="btn btn-sm btn-secondary" onclick="NC.openDetail('${esc(nc.id)}')">👁️ Ver</button>
              ${canDel ? `<button class="btn btn-sm btn-danger" onclick="NC.delete('${esc(nc.id)}')">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    document.getElementById('ncFooter').textContent = `${n.length} NCs · ${data.length} filtradas`;
  },

  openDetail(id) {
    const nc = State.ncs.find(x => x.id === id);
    if (!nc) return;
    document.getElementById('ncModalContent').innerHTML = `
      <div class="detail-grid">
        <div class="detail-row"><span class="detail-label">Viagem</span><span>${esc(nc.viagem||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">Veículo</span><span class="plate">${esc(nc.veiculo||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">Motorista</span><span>${esc(nc.nomeCondutor||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">CPF</span><span>${esc(nc.cpfCondutor||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">Origem</span><span>${esc(nc.origem||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">Destino</span><span>${esc(nc.destino||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">Data</span><span>${fmtDateTime(nc.dataOcorrencia)}</span></div>
        <div class="detail-row"><span class="detail-label">Embarcador</span><span>${esc(nc.embarcador||'-')}</span></div>
      </div>
      <div class="detail-block">
        <span class="detail-label">Não Conformidade</span>
        <p style="margin-top:6px">${esc(nc.naoConformidade||'-')}</p>
        <span class="nc-tag" style="margin-top:8px;display:inline-block">${esc(NC_TYPES[nc.tipoNC]||'Outros')}</span>
      </div>
      <div class="detail-block detail-muted">
        <span class="detail-label">Importação</span>
        <p style="margin-top:4px;font-size:12px;color:var(--text3)">
          Arquivo: ${esc(nc.arquivoOrigem||'-')} · Linha ${esc(nc.linhaOrigem||'-')} · Por: ${esc(nc.importadoPor||'-')}
        </p>
      </div>
    `;
    document.getElementById('ncModal').classList.remove('hidden');
  },

  closeModal() { document.getElementById('ncModal').classList.add('hidden'); },

  delete(id) {
    if (!confirm('🗑️ Excluir esta NC?')) return;
    State.ncs = State.ncs.filter(nc => nc.id !== id);
    State.save();
    this.render();
    toast('✅ NC excluída','success');
  },

  clearAll() {
    if (!confirm('🗑️ Limpar todas as NCs?')) return;
    State.ncs = [];
    State.save();
    this.render();
    toast('NCs limpas','info');
  },

  async import(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb   = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type:'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const list = rows.map((row, i) => {
        const veiculo         = getField(row, ['Veículo','Veiculo']).toUpperCase();
        const naoConformidade = getField(row, ['Não Conformidade','Nao Conformidade']);
        if (!veiculo || !naoConformidade) return null;
        const rawDate = getField(row, ['Data Ocorrencia','Data Ocorrência']);
        const d = parseDate(rawDate);
        const dataOcorrencia = d ? d.toISOString().split('T')[0] : '';
        return {
          id:             `nc_${Date.now()}_${i}`,
          viagem:         getField(row, ['Viagem']),
          cliente:        getField(row, ['Cliente']),
          embarcador:     getField(row, ['Embarcador']),
          veiculo,
          cpfCondutor:    getField(row, ['CPF Condutor']),
          nomeCondutor:   getField(row, ['Nome Condutor']),
          origem:         getField(row, ['Origem']),
          destino:        getField(row, ['Destino']),
          naoConformidade,
          dataOcorrencia,
          tipoNC:         classifyNC(naoConformidade),
          importadoEm:    today(),
          arquivoOrigem:  file.name,
          linhaOrigem:    i+1,
          importadoPor:   State.user?.name || 'Sistema',
        };
      }).filter(Boolean);

      if (!list.length) { toast('Nenhuma NC válida encontrada','warning'); return; }
      State.ncs = list;
      State.save();
      this.render();
      toast(`✅ ${list.length} NCs importadas`,'success');
    } catch(err) {
      toast(`❌ ${err.message}`,'error');
    } finally {
      e.target.value = '';
    }
  },

  exportXLS() {
    const data = this.filtered().map(nc => ({
      'VIAGEM': nc.viagem||'', 'VEÍCULO': nc.veiculo||'',
      'MOTORISTA': nc.nomeCondutor||'', 'NÃO CONFORMIDADE': nc.naoConformidade||'',
      'TIPO': NC_TYPES[nc.tipoNC]||'Outros', 'DATA': fmtDateTime(nc.dataOcorrencia),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NC');
    XLSX.writeFile(wb, `rondolog_nc_${today()}.xlsx`);
  },

  exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'NÃO CONFORMIDADES');
    doc.autoTable({
      startY: 38,
      head: [['VIAGEM','VEÍCULO','MOTORISTA','TIPO','DATA']],
      body: this.filtered().map(nc => [
        nc.viagem||'-', nc.veiculo||'-', nc.nomeCondutor||'-',
        NC_TYPES[nc.tipoNC]||'Outros', fmtDateTime(nc.dataOcorrencia),
      ]),
      styles: { fontSize:8 }, headStyles: { fillColor:[200,0,0] },
    });
    pdfFooter(doc);
    doc.save(`rondolog_nc_${today()}.pdf`);
  },
};

// ─── DASHBOARD ─────────────────────────────────────
const Dashboard = {
  days: 30,
  charts: {},

  setPeriod(days, btn) {
    this.days = days;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.render();
  },

  filtered() {
    if (!this.days) return State.ncs;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.days);
    return State.ncs.filter(nc => {
      const d = parseDate(nc.dataOcorrencia);
      return d && d >= cutoff;
    });
  },

  render() {
    const data = this.filtered();
    const all  = State.ncs;

    if (!all.length) {
      document.getElementById('dashEmpty').classList.remove('hidden');
      document.querySelector('.charts').style.display = 'none';
      document.getElementById('dashMetrics').innerHTML = '';
      return;
    }

    document.getElementById('dashEmpty').classList.add('hidden');
    document.querySelector('.charts').style.display = '';

    // Metrics
    const avgDaily = this.days ? (data.length / Math.max(this.days,1)).toFixed(1) : '-';
    const byVehicle = countBy(data, nc => nc.veiculo);
    const byDriver  = countBy(data, nc => nc.nomeCondutor);
    const topV = topN(byVehicle, 1)[0];
    const topD = topN(byDriver,  1)[0];

    document.getElementById('dashMetrics').innerHTML = `
      <div class="metric"><div class="metric-value">${data.length}</div><div class="metric-label">Total de NCs</div></div>
      <div class="metric"><div class="metric-value">${avgDaily}</div><div class="metric-label">Média diária</div></div>
      <div class="metric"><div class="metric-value">${topV?.[0]||'-'}</div><div class="metric-label">Veículo c/ mais NCs</div><div class="metric-sub">${topV?`${topV[1]} ocorrências`:''}</div></div>
      <div class="metric"><div class="metric-value">${(topD?.[0]||'-').split(' ')[0]}</div><div class="metric-label">Motorista c/ mais NCs</div><div class="metric-sub">${topD?`${topD[1]} ocorrências`:''}</div></div>
    `;

    const COLORS = ['#e53e3e','#3182ce','#38a169','#d69e2e','#805ad5','#00b5d8','#ed8936','#d53f8c'];

    // Tipo
    const byType = countBy(data, nc => nc.tipoNC||'outros');
    this.mkChart('chartTipo','doughnut',
      Object.keys(byType).map(k => NC_TYPES[k]||k),
      Object.values(byType), COLORS,
      { plugins:{ legend:{ position:'right', labels:{ font:{size:10} } } } }
    );

    // Evolução
    const byDay = {};
    data.forEach(nc => {
      const d = parseDate(nc.dataOcorrencia);
      if (!d) return;
      const k = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
      byDay[k] = (byDay[k]||0) + 1;
    });
    this.mkChart('chartEvolucao','line',
      Object.keys(byDay), Object.values(byDay),
      { borderColor:'#3182ce', backgroundColor:'rgba(49,130,206,.1)', fill:true, tension:.3 },
      { scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
    );

    // Top veículos
    const tv = topN(byVehicle, 10);
    this.mkChart('chartVeiculos','bar',
      tv.map(([k])=>k), tv.map(([,v])=>v), '#e53e3e',
      { indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
    );

    // Top motoristas
    const td2 = topN(byDriver, 10);
    this.mkChart('chartMotoristas','bar',
      td2.map(([k])=>(k||'').split(' ')[0]), td2.map(([,v])=>v), '#805ad5',
      { indexAxis:'y', scales:{ x:{ beginAtZero:true } } }
    );

    // Dia da semana
    const sem = [0,0,0,0,0,0,0];
    data.forEach(nc => { const d=parseDate(nc.dataOcorrencia); if(d) sem[d.getDay()]++; });
    this.mkChart('chartSemana','bar',
      ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], sem, COLORS,
      { scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
    );
  },

  mkChart(id, type, labels, data, colorOrDataset, extraOpts={}) {
    if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; }
    const ctx = document.getElementById(id).getContext('2d');
    const dataset = typeof colorOrDataset === 'string' || Array.isArray(colorOrDataset)
      ? { data, backgroundColor: colorOrDataset, borderWidth:1 }
      : { data, ...colorOrDataset };
    this.charts[id] = new Chart(ctx, {
      type,
      data: { labels, datasets:[dataset] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, ...extraOpts },
    });
  },

  exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    pdfHeader(doc, 'DASHBOARD DE ANÁLISE');
    let y = 42;
    const data = this.filtered();
    doc.setFontSize(11);
    doc.text(`Período: ${this.days ? `Últimos ${this.days} dias` : 'Todo o período'}`, 20, y); y+=8;
    doc.text(`Total de NCs: ${data.length}`, 20, y); y+=8;
    const byType = countBy(data, nc => nc.tipoNC||'outros');
    doc.text('Por tipo:', 20, y); y+=6;
    Object.entries(byType).forEach(([k,v]) => {
      doc.setFontSize(9);
      doc.text(`  ${NC_TYPES[k]||k}: ${v}`, 20, y); y+=5;
    });
    pdfFooter(doc);
    doc.save(`rondolog_dashboard_${today()}.pdf`);
  },
};

// ─── Helpers para cards e PDF ───────────────────────
function card(value, label, sub, mod) {
  return `<div class="card card-${mod}">
    <div class="card-value">${value}</div>
    <div class="card-label">${label}</div>
    <div class="card-sub">${sub}</div>
  </div>`;
}

function countBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const k = fn(item)||'Desconhecido';
    acc[k] = (acc[k]||0)+1;
    return acc;
  }, {});
}

function topN(obj, n) {
  return Object.entries(obj).sort(([,a],[,b])=>b-a).slice(0,n);
}

function pdfHeader(doc, title) {
  doc.setFontSize(14);
  doc.text(`LUNASYS — ${title}`, 105, 14, { align:'center' });
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} · Usuário: ${State.user?.name||'-'}`, 105, 22, { align:'center' });
  doc.setTextColor(0);
}

function pdfFooter(doc) {
  const n = doc.internal.getNumberOfPages();
  for (let i=1;i<=n;i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Pág. ${i}/${n} — LUNASYS`, 105, 285, { align:'center' });
  }
}

// ─── Start ─────────────────────────────────────────
App.init();
