const express = require('express')
const fetch = require('node-fetch')
const path = require('path')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, 'public')))

const cache = {}
const CACHE_TTL = 20 // sekuntteja

function getCached(key) {
	const entry = cache[key]
	if (!entry) return null
	if ((Date.now() - entry.ts) / 1000 > CACHE_TTL) {
		delete cache[key]
		return null
	}
	return entry.data
}

function setCached(key, data) {
	cache[key] = { ts: Date.now(), data }
}

// Tässä tehdään proxyt Football Data API:in
const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || ''

async function proxyFootballData(pathSegment) {
	const url = `${FOOTBALL_DATA_API}${pathSegment}`
	const cached = getCached(url)
	if (cached) return cached
	const headers = {}
	if (API_KEY) headers['X-Auth-Token'] = API_KEY
	const res = await fetch(url, { headers })
	if (!res.ok) {
		const text = await res.text()
		console.warn('Upstream error', res.status, text)
		const err = new Error(`Upstream ${res.status}: ${text}`)
		err.status = res.status
		throw err
	}
	const data = await res.json()
	setCached(url, data)
	return data
}

// Tämä hakee ottelut pilkkomalla ison päivämäärävälin pienempiin osiin
async function fetchMatchesRangeCompetition(competitionId, dateFrom, dateTo) {
	const from = new Date(dateFrom)
	const to = new Date(dateTo)
	if (isNaN(from) || isNaN(to) || from > to) {
		const e = new Error('Invalid dateFrom/dateTo')
		e.status = 400
		throw e
	}
	const dayMs = 24 * 60 * 60 * 1000
	const maxChunkDays = 14
	const accum = []
	for (let start = new Date(from); start <= to; start = new Date(start.getTime() + maxChunkDays * dayMs)) {
		const chunkFrom = new Date(start)
		const chunkTo = new Date(Math.min(start.getTime() + (maxChunkDays - 1) * dayMs, to.getTime()))
		const f = chunkFrom.toISOString().slice(0,10)
		const t = chunkTo.toISOString().slice(0,10)
		const q = `/competitions/${competitionId}/matches?dateFrom=${encodeURIComponent(f)}&dateTo=${encodeURIComponent(t)}`
		const data = await proxyFootballData(q)
		if (data && data.matches && data.matches.length) accum.push(...data.matches)
	}
	// dedupe
	const seen = new Set()
	const unique = []
	for (const m of accum) {
		if (!m || !m.id) continue
		if (seen.has(m.id)) continue
		seen.add(m.id)
		unique.push(m)
	}
	return { matches: unique }
}

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.get('/api/key', (req, res) => {
	const hasKey = !!API_KEY
	const masked = hasKey ? `set (length ${API_KEY.length})` : 'not set'
	res.json({ hasKey, info: masked })
})

// Tämä hakee vain nykyisen mestarien liigan tiedot (eli competition id 2001)
const CHAMPIONS_ID = '2001'

app.get('/api/champions/matches', async (req, res) => {
	try {
		const dateFrom = req.query.dateFrom
		const dateTo = req.query.dateTo
		let q = `/competitions/${CHAMPIONS_ID}/matches`
		const params = []
		if (dateFrom) params.push(`dateFrom=${encodeURIComponent(dateFrom)}`)
		if (dateTo) params.push(`dateTo=${encodeURIComponent(dateTo)}`)
		if (params.length) q += `?${params.join('&')}`
		const data = await proxyFootballData(q)
		res.json(data)
	} catch (err) {
		res.status(err.status || 500).json({ error: err.message })
	}
})

app.get('/api/champions/standings', async (req, res) => {
	try {
		const data = await proxyFootballData(`/competitions/${CHAMPIONS_ID}/standings`)
		res.json(data)
	} catch (err) {
		res.status(err.status || 500).json({ error: err.message })
	}
})

app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.listen(PORT, () => {
	console.log(`Port ${PORT}`)
	if (!API_KEY) console.warn('API ei löydy')
})