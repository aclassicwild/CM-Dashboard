const appEl = document.getElementById('app');

const appState = {
  data: null,
  selectedIndicator: 'dropout_girls',
  selectedPeriod: null,
  narrativeMode: 'template',
  highlightedDistricts: new Set(),
  filterChip: null
};

const palettes = {
  good: ['#166534', '#22c55e', '#86efac', '#d9f99d', '#f0fdf4'],
  bad: ['#fef2f2', '#fecdd3', '#fca5a5', '#f87171', '#b91c1c']
};

async function loadData() {
  const files = ['data/districts.json','data/indicator_catalog.json','data/observations.json','data/model_config.json'];
  const [districts, catalog, observations, modelConfig] = await Promise.all(files.map(f => fetch(f).then(r => r.json())));
  let precomputed = null;
  try {
    precomputed = await fetch('data/precomputed_narratives.json').then(r => r.json());
  } catch (e) {
    console.warn('Precomputed narratives not found, using templates');
  }
  appState.data = { districts, catalog, observations, modelConfig, precomputed };
  const periods = Array.from(new Set(observations.map(o => o.period))).sort();
  appState.selectedPeriod = periods[periods.length - 1];
}

function navigate(hash) {
  window.location.hash = hash;
}

function setupRouter() {
  window.addEventListener('hashchange', renderRoute);
  if (!window.location.hash) {
    navigate('#/home');
  } else {
    renderRoute();
  }
}

function renderRoute() {
  const hash = window.location.hash.slice(1);
  if (!hash || hash === '/home') return renderHome();
  if (hash.startsWith('/sector/education/indicator/')) {
    const indicatorId = hash.split('/').pop();
    appState.selectedIndicator = indicatorId;
    return renderIndicatorDetail(indicatorId);
  }
  if (hash.startsWith('/sector/education')) return renderEducation();
  return renderHome();
}

function renderHome() {
  appEl.innerHTML = `
    <div class="hero">
      <div class="breadcrumb">Home</div>
      <h1>Chief Minister's Office Dashboard</h1>
      <p>Click through Education → Indicator bucket → Dropout Rate (Girls) to see district hotspots, narratives, and a what-if simulator.</p>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="button" onclick="navigate('#/sector/education')">Start Education journey</button>
        <button class="button secondary" onclick="navigate('#/sector/education/indicator/dropout_girls')">Jump to Dropout (girls)</button>
      </div>
    </div>
    <div class="section">
      <div class="section-header"><h2>All sectors</h2><span class="badge">Concept demo</span></div>
      <div class="card-grid">
        ${['Education','Health','Agriculture','Social Protection'].map(sec => `
          <div class="card">
            <h3>${sec}</h3>
            <p>${sec==='Education' ? 'Attendance, learning, and equity' : 'Coming soon with connectors'}</p>
            ${sec==='Education' ? `<a class="button" href="#/sector/education">Open</a>` : `<span class="badge">Roadmap</span>`}
          </div>`).join('')}
      </div>
    </div>
  `;
}

function renderEducation() {
  const buckets = groupBy(appState.data.catalog, 'bucket');
  const bucketEntries = Object.entries(buckets);
  appEl.innerHTML = `
    <div class="breadcrumb">Home → Education</div>
    <div class="section-header"><h2>Education sector</h2><span class="badge">UDISE+ / NAS / PGI</span></div>
    <p>Pick an indicator bucket to drill down. The journey to Dropout Rate (Girls) shows the full hotspot and narrative flow.</p>
    <div class="card-grid">
      ${bucketEntries.map(([bucket, items]) => `
        <div class="card">
          <h3>${bucket}</h3>
          <p>${items.length} indicators</p>
          <div class="pills">${items.map(i => `<span class="pill ${i.indicatorId==='dropout_girls'?'active':''}" tabindex="0" onclick="navigate('#/sector/education/indicator/${i.indicatorId}')">${i.indicatorName}</span>`).join('')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderIndicatorDetail(indicatorId) {
  const data = appState.data;
  const indicator = data.catalog.find(i => i.indicatorId === indicatorId);
  if (!indicator) return renderEducation();

  const periods = Array.from(new Set(data.observations.filter(o => o.indicatorId===indicatorId).map(o => o.period))).sort();
  if (!appState.selectedPeriod || !periods.includes(appState.selectedPeriod)) appState.selectedPeriod = periods[periods.length-1];

  const stateSeries = data.observations.filter(o => o.indicatorId===indicatorId && o.geographyType==='state').sort((a,b)=>periods.indexOf(a.period)-periods.indexOf(b.period));
  const districtLatest = data.observations.filter(o => o.indicatorId===indicatorId && o.geographyType==='district' && o.period===appState.selectedPeriod);
  const latestStateValue = stateSeries.find(o=>o.period===appState.selectedPeriod)?.value;
  const prevPeriod = periods[periods.indexOf(appState.selectedPeriod)-1] || periods[0];
  const prevValue = stateSeries.find(o=>o.period===prevPeriod)?.value;
  const past2yIndex = Math.max(0, periods.indexOf(appState.selectedPeriod)-4);
  const past2yPeriod = periods[past2yIndex];
  const past2yValue = stateSeries.find(o=>o.period===past2yPeriod)?.value;
  const delta2y = latestStateValue && past2yValue ? +(latestStateValue - past2yValue).toFixed(1) : null;
  const deltaPrev = latestStateValue && prevValue ? +(latestStateValue - prevValue).toFixed(1) : null;

  const headlineDelta = delta2y !== null ? `${delta2y>0?'+':''}${delta2y}` : '–';
  const trendWord = delta2y>0 ? (indicator.directionality==='higher_is_better' ? 'improved' : 'worsened') : delta2y<0 ? (indicator.directionality==='higher_is_better' ? 'declined' : 'improved') : 'flat';

  const gridResult = renderHeatGrid(indicator, districtLatest, periods, past2yPeriod);
  const narrative = buildNarrative({indicator, stateSeries, period: appState.selectedPeriod, pastPeriod: past2yPeriod, districtLatest});
  const simBlock = buildSimulator(indicator, latestStateValue, delta2y);
  const focusDistricts = gridResult.rankings.slice(0,3).map(r=>r.districtName);

  appEl.innerHTML = `
    <div class="breadcrumb">Home → Education → ${indicator.bucket} → ${indicator.indicatorName}</div>
    <div class="hero">
      <h1>${indicator.indicatorName}</h1>
      <p>What changed, where it's worst/best, and what to do next. Time: <strong>${appState.selectedPeriod}</strong> · vs ${past2yPeriod}</p>
      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <div class="badge ${indicator.directionality==='lower_is_better'?'danger':'success'}">Direction: ${indicator.directionality.replace('_',' ')}</div>
        <div class="badge">Unit: ${indicator.unit}</div>
        <div class="badge">Source: ${indicator.sourceSystem}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Signal summary</h2>
        <label>Time: <select id="periodSelect">${periods.map(p=>`<option value="${p}" ${p===appState.selectedPeriod?'selected':''}>${p}</option>`).join('')}</select></label>
      </div>
      <div class="metric-cards">
        <div class="metric"><h4>State value</h4><p><strong>${latestStateValue ?? 'NA'}</strong> ${indicator.unit}</p></div>
        <div class="metric"><h4>Δ vs last quarter</h4><p>${deltaPrev ? `${deltaPrev>0?'+':''}${deltaPrev}`: 'NA'} ${indicator.unit}</p></div>
        <div class="metric"><h4>Δ vs 2 yrs</h4><p>${headlineDelta} ${indicator.unit} (${trendWord})</p></div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>District performance (selected indicator)</h2>
        <div class="legend">
          <span>Legend:</span>
          ${gridResult.legend.map(l=>`<div class="legend-swatch" style="background:${l.color}"></div><span>${l.label}</span>`).join(' ')}
        </div>
      </div>
      <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
        <div class="pills">
          <span class="pill ${appState.filterChip==='worst5'?'active':''}" onclick="applyChip('worst5')">Worst 5</span>
          <span class="pill ${appState.filterChip==='best5'?'active':''}" onclick="applyChip('best5')">Best 5</span>
          <span class="pill ${appState.filterChip===null?'active':''}" onclick="applyChip(null)">Clear</span>
        </div>
        <small class="muted">Heat-grid is a schematic proxy for district geography (demo).</small>
      </div>
      <div class="grid-wrapper">
        <div>
          ${gridResult.gridHtml}
        </div>
        <div>
          <div class="table-scroll">
            ${gridResult.tableHtml}
          </div>
        </div>
      </div>
    </div>

    <div class="section narrative">
      <div class="section-header">
        <h2>Auto narrative</h2>
        <div>
          <label>Narrative: <select id="narrativeMode">
            <option value="template" ${appState.narrativeMode==='template'?'selected':''}>Template</option>
            <option value="precomputed" ${appState.narrativeMode==='precomputed'?'selected':''}>Precomputed (if available)</option>
          </select></label>
        </div>
      </div>
      <h3>${narrative.headline}</h3>
      <p>${narrative.body}</p>
      <div class="drawer">
        <strong>Explain this</strong>
        <p>Inputs: State=${latestStateValue} ${indicator.unit}, Δ2y=${headlineDelta}, Worst=${gridResult.rankings[0].districtName}, Best=${gridResult.rankings.slice(-1)[0].districtName}</p>
        <p>Template knobs: directionality=${indicator.directionality}, deltaWord=${trendWord}, banding=quantiles.</p>
        <p>Simulator DEMO equation: ${appState.data.modelConfig[indicatorId]?.equation ?? 'Not configured'}. Coefficients: ${JSON.stringify(appState.data.modelConfig[indicatorId]?.coefficients ?? {})}</p>
      </div>
    </div>

    <div class="section simulator">
      <div class="section-header"><h2>What-if simulator</h2><span class="badge">Predictive impact (toy)</span></div>
      ${simBlock}
    </div>

    <div class="section">
      <div class="section-header"><h2>Recommended focus districts</h2><span class="badge">Auto-picked</span></div>
      <div class="pills">
        ${focusDistricts.map(d=>`<span class="pill">${d}</span>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('periodSelect').addEventListener('change', (e)=>{appState.selectedPeriod = e.target.value; renderIndicatorDetail(indicatorId);});
  document.getElementById('narrativeMode').addEventListener('change',(e)=>{appState.narrativeMode = e.target.value; renderIndicatorDetail(indicatorId);});
  attachGridHandlers(gridResult);

  if (indicatorId==='dropout_girls' && appState.filterChip===null && appState.highlightedDistricts.size===0) {
    applyChip('worst5');
  }
}

function renderHeatGrid(indicator, districtLatest, periods, past2yPeriod) {
  const direction = indicator.directionality;
  const values = districtLatest.map(d=>d.value);
  const bands = computeQuantileBands(values);
  const legend = ['Very Low','Low','Medium','High','Very High'].map((label, idx)=>({label, color: direction==='higher_is_better'?palettes.good[4-idx]:palettes.bad[idx]}));

  const rankings = districtLatest.map(obs=>{
    const bandIdx = assignBand(obs.value, bands);
    return {
      districtId: obs.geographyId,
      districtName: getDistrictName(obs.geographyId),
      value: obs.value,
      bandIdx,
      bandLabel: ['Very Low','Low','Medium','High','Very High'][bandIdx],
      pastValue: getObservationValue(obs.indicatorId, obs.geographyId, past2yPeriod),
      delta2y: obs.value - (getObservationValue(obs.indicatorId, obs.geographyId, past2yPeriod) ?? obs.value)
    };
  }).sort((a,b)=> direction==='higher_is_better' ? b.value - a.value : a.value - b.value);

  let filteredRankings = rankings;
  if (appState.filterChip==='worst5') filteredRankings = rankings.slice(0,5);
  if (appState.filterChip==='best5') filteredRankings = rankings.slice(-5);

  const gridHtml = `
    <div class="heat-grid">
      ${rankings.map((r, idx)=>{
        const colorPalette = direction==='higher_is_better' ? palettes.good.slice().reverse() : palettes.bad;
        const color = colorPalette[r.bandIdx];
        const isHighlighted = appState.highlightedDistricts.has(r.districtId) || filteredRankings.includes(r) || (appState.filterChip==='worst5' && rankings.indexOf(r)<5) || (appState.filterChip==='best5' && rankings.indexOf(r)>=rankings.length-5);
        return `<div class="grid-cell ${isHighlighted?'highlight':''}" style="background:${color};" tabindex="0" data-district="${r.districtId}">
          <div class="cell-name">${r.districtName}</div>
          <div class="cell-value">${r.value} ${indicator.unit}</div>
          <div class="tooltip">${r.districtName}<br/>${r.value} ${indicator.unit}<br/>Band: ${r.bandLabel}<br/>Δ2y: ${(r.delta2y>=0?'+':'')+r.delta2y.toFixed(1)}</div>
        </div>`;
      }).join('')}
    </div>
  `;

  const tableHtml = `
    <table class="table">
      <thead><tr><th>Rank</th><th>District</th><th>Value</th><th>Δ vs 2y</th><th>Status</th></tr></thead>
      <tbody>
        ${rankings.map((r, idx)=>{
          const bandClass = r.bandIdx>=3 ? 'bad' : r.bandIdx===2 ? 'mid' : 'good';
          const visible = !appState.highlightedDistricts.size || appState.highlightedDistricts.has(r.districtId) || filteredRankings.includes(r);
          return `<tr class="${appState.highlightedDistricts.has(r.districtId)?'highlight':''}" data-district-row="${r.districtId}" style="display:${visible?'table-row':'none'}">
            <td>${idx+1}</td>
            <td>${r.districtName}</td>
            <td>${r.value}</td>
            <td>${(r.delta2y>=0?'+':'')+r.delta2y.toFixed(1)}</td>
            <td><span class="status-chip ${bandClass}">${r.bandLabel}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  return {gridHtml, tableHtml, legend, rankings};
}

function computeQuantileBands(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const q = [0.2,0.4,0.6,0.8].map(p=>sorted[Math.floor(p*(sorted.length-1))]);
  return q;
}

function assignBand(value, bands) {
  if (value <= bands[0]) return 0;
  if (value <= bands[1]) return 1;
  if (value <= bands[2]) return 2;
  if (value <= bands[3]) return 3;
  return 4;
}

function getDistrictName(id) {
  return appState.data.districts.find(d=>d.id===id)?.shortName || id;
}

function getObservationValue(indicatorId, geoId, period) {
  return appState.data.observations.find(o=>o.indicatorId===indicatorId && o.geographyId===geoId && o.period===period)?.value;
}

function buildNarrative({indicator, stateSeries, period, pastPeriod, districtLatest}) {
  const preKey = `${period}_MH`;
  if (appState.narrativeMode==='precomputed' && appState.data.precomputed?.[indicator.indicatorId]?.[preKey]) {
    const story = appState.data.precomputed[indicator.indicatorId][preKey];
    return {headline: story.headline, body: `${story.body} Focus districts: ${story.calloutDistricts.map(getDistrictName).join(', ')}. Next steps: ${story.actions.join('; ')}`};
  }

  const current = stateSeries.find(s=>s.period===period)?.value;
  const past = stateSeries.find(s=>s.period===pastPeriod)?.value;
  const delta = current && past ? +(current-past).toFixed(1) : 0;
  const sorted = districtLatest.sort((a,b)=> indicator.directionality==='higher_is_better'? b.value-a.value : a.value-b.value);
  const worst = sorted.slice(0,3).map(o=>getDistrictName(o.geographyId));
  const best = sorted.slice(-3).map(o=>getDistrictName(o.geographyId));
  const directionWord = indicator.directionality==='higher_is_better' ? (delta>=0?'improved':'declined') : (delta>=0?'worsened':'improved');
  const headline = `${indicator.indicatorName} ${directionWord} by ${delta} ${indicator.unit} since ${pastPeriod}`;
  const likelyDrivers = indicator.directionality==='lower_is_better' ? 'teacher gaps, transition shocks, and hygiene barriers' : 'classroom support and materials readiness';
  const body = `Current level is ${current} ${indicator.unit}. ${indicator.directionality==='lower_is_better'?'Lower is better; ':'Higher is better; '}worst districts: ${worst.join(', ')}; best pockets: ${best.join(', ')}. Likely drivers: ${likelyDrivers}. Recommended levers: strengthen attendance tracking, repair toilets, and expand travel stipends.`;
  return {headline, body};
}

function buildSimulator(indicator, currentValue, delta2y) {
  const config = appState.data.modelConfig[indicator.indicatorId];
  if (!config) return '<div class="alert">Simulator not configured for this indicator.</div>';
  const inputs = {...config.defaultInputs};
  const compute = (vars)=>{
    const {baseline, teacher_vacancy, toilet_gap, scholarship_coverage} = config.coefficients;
    return +(baseline + teacher_vacancy*vars.teacher_vacancy + toilet_gap*vars.toilet_gap - scholarship_coverage*vars.scholarship_coverage/10).toFixed(2);
  };
  const predicted = compute(inputs);
  const improveBy = currentValue ? +(currentValue - predicted).toFixed(2) : null;
  const form = `
    <div class="sim-controls">
      ${Object.keys(inputs).map(key=>{
        const [min,max] = config.bounds[key];
        return `<label>${key.replace('_',' ')} (% or count)<input type="range" min="${min}" max="${max}" value="${inputs[key]}" step="1" data-sim-key="${key}"><span>${inputs[key]}</span></label>`;
      }).join('')}
    </div>
    <div class="sim-output" id="simOutput">
      Predicted dropout (demo): <strong>${predicted}%</strong>. If achieved, change vs current ${currentValue ?? 'n/a'} would be <strong>${improveBy ?? 'n/a'} pp</strong>.
    </div>
  `;
  setTimeout(()=>{
    document.querySelectorAll('input[data-sim-key]').forEach(input=>{
      input.addEventListener('input', ()=>{
        const key = input.dataset.simKey;
        const val = Number(input.value);
        input.nextElementSibling.textContent = val;
        inputs[key]=val;
        const nextPred = compute(inputs);
        const delta = currentValue ? +(currentValue - nextPred).toFixed(2) : null;
        document.getElementById('simOutput').innerHTML = `Predicted dropout (demo): <strong>${nextPred}%</strong>. Expected improvement vs current: <strong>${delta ?? 'n/a'} pp</strong>.`;
      });
    });
  }, 50);
  return form;
}

function attachGridHandlers(gridResult) {
  document.querySelectorAll('.grid-cell').forEach(cell=>{
    cell.addEventListener('click', ()=>{
      const id = cell.dataset.district;
      if (appState.highlightedDistricts.has(id)) {
        appState.highlightedDistricts.delete(id);
      } else {
        appState.highlightedDistricts.clear();
        appState.highlightedDistricts.add(id);
      }
      renderIndicatorDetail(appState.selectedIndicator);
      const row = document.querySelector(`[data-district-row="${id}"]`);
      if (row) row.scrollIntoView({behavior:'smooth', block:'center'});
    });
    cell.addEventListener('keyup', (e)=>{ if (e.key==='Enter' || e.key===' ') cell.click(); });
  });
}

function applyChip(type) {
  appState.filterChip = type;
  if (type===null) appState.highlightedDistricts.clear();
  if (type==='worst5') {
    appState.highlightedDistricts = new Set(renderHeatGrid(appState.data.catalog.find(c=>c.indicatorId===appState.selectedIndicator), appState.data.observations.filter(o=>o.indicatorId===appState.selectedIndicator && o.geographyType==='district' && o.period===appState.selectedPeriod), [], '').rankings.slice(0,5).map(r=>r.districtId));
  }
  if (type==='best5') {
    const rankings = renderHeatGrid(appState.data.catalog.find(c=>c.indicatorId===appState.selectedIndicator), appState.data.observations.filter(o=>o.indicatorId===appState.selectedIndicator && o.geographyType==='district' && o.period===appState.selectedPeriod), [], '').rankings;
    appState.highlightedDistricts = new Set(rankings.slice(-5).map(r=>r.districtId));
  }
  renderIndicatorDetail(appState.selectedIndicator);
}

function groupBy(arr, key) {
  return arr.reduce((acc,item)=>{
    acc[item[key]] = acc[item[key]] || [];
    acc[item[key]].push(item);
    return acc;
  },{});
}

(async function init(){
  await loadData();
  setupRouter();
})();
