// Frontend osat

function renderMatches(container,matches){container.innerHTML='';if(!matches||!matches.length){container.innerHTML='<div class="muted">No matches found for the selected date(s) or filters.</div>';return}matches.sort((a,b)=>new Date(a.utcDate||a.date||0)-new Date(b.utcDate||b.date||0));for(const m of matches){const div=document.createElement('div');div.className='match';const home=m.homeTeam?m.homeTeam.name:'TBD';const away=m.awayTeam?m.awayTeam.name:'TBD';const score=m.score&&m.score.fullTime?`${m.score.fullTime.home??'-'} - ${m.score.fullTime.away??'-'}`:' - ';const time=(m.utcDate||m.date||'').replace('T',' ').slice(0,16);div.innerHTML=`<div><div style="font-weight:700">${home} <span class="muted">vs</span> ${away}</div><div class="muted">${time} • ${m.venue||''}</div></div><div style="text-align:right"><div class="score">${score}</div><div class="muted">${m.status}</div></div>`;container.appendChild(div)}}

let lastLoadedMatches = []
async function loadStandings() {
  const container = document.getElementById('standings')
  container.textContent = 'Loading standings...'
  try {
    const res = await axios.get('/api/champions/standings')
    const data = res.data
    renderStandings(container, data)
  } catch (err) {
    container.textContent = 'Failed loading standings'
  }
}

// Näyttää sarjataulukot
function renderStandings(container, data) {
  container.innerHTML = ''
  if (!data || !data.standings) {
    container.textContent = 'No standings available'
    return
  }
  data.standings.forEach(group => {
    const h = document.createElement('div')
    h.innerHTML = `<h4>${group.type || ''} ${group.group || ''}</h4>`
    const table = document.createElement('table')
    table.style.borderCollapse = 'collapse'
    table.innerHTML = '<tr><th>Pos</th><th>Team</th><th>Pts</th><th>W</th><th>D</th><th>L</th></tr>'
    group.table.forEach(row => {
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${row.position}</td><td>${row.team.name}</td><td>${row.points}</td><td>${row.won}</td><td>${row.draw}</td><td>${row.lost}</td>`
      table.appendChild(tr)
    })
    h.appendChild(table)
    container.appendChild(h)
  })
}

async function loadDay(date){
  const matchesDiv = document.getElementById('matches');
  matchesDiv.textContent = 'Loading...';
  try {
    const d = date || document.getElementById('datePicker').value || new Date().toISOString().slice(0,10);
    const res = await axios.get(`/api/champions/matches?dateFrom=${d}&dateTo=${d}`);
    const matches = res.data.matches || [];

    // Mapataan ja suodatetaan vain ne ottelut, jotka todella ovat valittuna päivänä
    const exact = (matches || []).map(m => {
      const dt = new Date(m.utcDate || m.date || null);
      return Object.assign({_isoDate: isNaN(dt) ? null : dt.toISOString().slice(0,10)}, m);
    }).filter(m => m._isoDate === d);

    lastLoadedMatches = exact;

    if (!exact || exact.length === 0) {
      // Näytetään vain tämä viesti — EI haeta muita päiviä automaattisesti
      matchesDiv.innerHTML = '<div class="muted">No competitions on a selected date. Change date or select "Load all"</div>';
    } else {
      renderMatches(matchesDiv, exact);
    }
  } catch (err) {
    matchesDiv.innerHTML = '<div class="muted">Error loading day: '+(err.message||err)+'</div>';
  }
}

// Hakee ja viimeisimmät ottelut
async function fetchRecent(days=30){const matchesDiv=document.getElementById('matches');matchesDiv.textContent='Loading recent matches...';try{const to=new Date(),from=new Date();from.setDate(to.getDate()-days);const f=from.toISOString().slice(0,10),t=to.toISOString().slice(0,10);const res=await axios.get(`/api/champions/matches?dateFrom=${f}&dateTo=${t}`);const recent=res.data.matches||[];lastLoadedMatches=recent;if(!recent||!recent.length)matchesDiv.innerHTML='<div class="muted">No recent matches found.</div>';else renderMatches(matchesDiv,recent)}catch(err){let text=err.message||String(err);if(err.response&&err.response.data)try{text=typeof err.response.data==='string'?err.response.data:JSON.stringify(err.response.data)}catch(e){}matchesDiv.innerHTML='<div class="muted">Error loading recent matches: '+text+'</div>'}}

async function loadRange(from, to) {
  const matchesDiv = document.getElementById('matches')
  matchesDiv.textContent = 'Loading...'
  try {
    const dateFrom = from || document.getElementById('dateFrom').value
    const dateTo = to || document.getElementById('dateTo').value
    if (!dateFrom || !dateTo) {
      matchesDiv.innerHTML = '<div class="muted">Please provide both From and To dates (or use Load All).</div>'
      return
    }
    if (dateFrom > dateTo) {
      matchesDiv.innerHTML = '<div class="muted">From date cannot be after To date.</div>'
      return
    }
  const res = await axios.get(`/api/champions/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`)
    const matches = res.data.matches || []
    lastLoadedMatches = matches
    if (!matches || matches.length === 0) {
      matchesDiv.innerHTML = '<div class="muted">No matches found for that range. Try expanding the range or click "Load All".</div>'
    } else {
      renderMatches(matchesDiv, matches)
    }
  } catch (err) {
    matchesDiv.innerHTML = '<div class="muted">Error loading range: ' + (err.message || err) + '</div>'
  }
}

// Lataa kaikki ottelut
async function loadAll(){await fetchRecent(30)}

function applyClubFilter() {
  const club = document.getElementById('club').value.trim().toLowerCase()
  const container = document.getElementById('matches')
  if (!club) {
    renderMatches(container, lastLoadedMatches)
    return
  }
  const filtered = lastLoadedMatches.filter(m => {
    const home = (m.homeTeam && m.homeTeam.name || '').toLowerCase()
    const away = (m.awayTeam && m.awayTeam.name || '').toLowerCase()
    return home.includes(club) || away.includes(club)
  })
  renderMatches(container, filtered)
}

document.getElementById('loadDay').addEventListener('click', () => loadDay())
document.getElementById('loadRange').addEventListener('click', () => loadRange())
document.getElementById('loadAll').addEventListener('click', () => loadAll())
document.getElementById('club').addEventListener('input', applyClubFilter)
document.getElementById('clear').addEventListener('click', () => {
  document.getElementById('club').value = ''
  document.getElementById('datePicker').value = ''
  document.getElementById('dateFrom').value = ''
  document.getElementById('dateTo').value = ''
  lastLoadedMatches = []
  renderMatches(document.getElementById('matches'), lastLoadedMatches)
})

loadAll()
loadStandings()
