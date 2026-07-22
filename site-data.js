/* ============================================================
   THE PINK CHRONICLES — site-data.js
   Pulls live data (episodes, community) from Supabase and
   renders it into the static page markup. If there's no data
   yet, the original "coming soon" markup is simply left alone.
   ============================================================ */
'use strict';

let PC_EPISODES = [];

/* ---------- helpers ---------- */
function pcFormatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return d; }
}

function pcYouTubeEmbed(url) {
  if (!url) return null;
  let id = null;
  const watch = url.match(/[?&]v=([^&]+)/);
  const short = url.match(/youtu\.be\/([^?&]+)/);
  const embed = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (watch) id = watch[1];
  else if (short) id = short[1];
  else if (embed) id = embed[1];
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function pcEsc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---------- fetch ---------- */
async function pcFetchEpisodes() {
  if (typeof supabaseClient === 'undefined') return [];
  const { data, error } = await supabaseClient
    .from('episodes')
    .select('*')
    .order('air_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('Error loading episodes:', error); return []; }
  return data || [];
}

/* ============================================================
   EPISODES PAGE
   ============================================================ */
async function pcRenderEpisodesPage() {
  const videoMain = document.getElementById('videoMain');
  if (!videoMain) return; // not on the episodes page

  PC_EPISODES = await pcFetchEpisodes();
  if (!PC_EPISODES.length) return; // keep the existing "coming soon" markup

  pcRenderFeatured(PC_EPISODES[0]);
  pcRenderQueue(PC_EPISODES.slice(1, 4));
  pcRenderEpisodeList(PC_EPISODES);
  pcUpdateTopicCounts(PC_EPISODES);
}

function pcRenderFeatured(ep) {
  const videoMain = document.getElementById('videoMain');
  const typeIcon = ep.type === 'video' ? 'fa-clapperboard' : 'fa-music';
  videoMain.innerHTML = `
    <div class="ep-empty-player" style="cursor:pointer;" onclick="playEpisode(${ep.id})">
      <div class="ep-empty-icon-ring">
        <i class="fa-solid fa-play"></i>
      </div>
      <p class="ep-empty-title">${pcEsc(ep.title)}</p>
      <p class="ep-empty-sub">${ep.description ? pcEsc(ep.description) : 'Tap play to listen or watch.'}</p>
      <div class="ep-empty-badges">
        <span class="ep-empty-badge"><i class="fa-solid ${typeIcon}"></i> ${ep.type === 'video' ? 'Video Episode' : 'Audio Episode'}</span>
        ${ep.topic ? `<span class="ep-empty-badge"><i class="fa-solid fa-tag"></i> ${pcEsc(ep.topic)}</span>` : ''}
        ${ep.duration ? `<span class="ep-empty-badge"><i class="fa-regular fa-clock"></i> ${pcEsc(ep.duration)}</span>` : ''}
      </div>
    </div>

    <div class="video-ep-info">
      <p class="video-ep-label-row">${ep.number ? 'EPISODE ' + pcEsc(ep.number) : 'FEATURED'}</p>
      <h3 class="video-ep-title-row">
        ${pcEsc(ep.title)}
        <i class="fa-regular fa-heart" aria-hidden="true"></i>
      </h3>
      <div class="video-ep-meta">
        ${ep.topic ? `<span><i class="fa-solid fa-tag" aria-hidden="true"></i> ${pcEsc(ep.topic)}</span>` : ''}
        <span><i class="fa-regular fa-calendar-days" aria-hidden="true"></i> ${pcFormatDate(ep.air_date) || 'New'}</span>
        ${ep.duration ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${pcEsc(ep.duration)}</span>` : ''}
      </div>
      <p class="video-ep-desc">${ep.description ? pcEsc(ep.description) : ''}</p>
      <div class="video-ep-actions">
        <button class="btn-play-ep" onclick="playEpisode(${ep.id})">
          <i class="fa-solid fa-play" aria-hidden="true"></i> PLAY EPISODE
        </button>
        <button class="btn-ghost-ep" onclick="pcShareEpisode(${ep.id})">
          <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> SHARE
        </button>
      </div>
    </div>`;
}

function pcRenderQueue(list) {
  const wrap = document.getElementById('queueItems');
  if (!wrap) return;
  if (!list.length) {
    wrap.innerHTML = `<p style="padding:14px;font-size:.8rem;color:var(--gray);">More episodes coming soon!</p>`;
    return;
  }
  wrap.innerHTML = list.map(ep => `
    <div class="queue-item" style="cursor:pointer;" onclick="playEpisode(${ep.id})">
      <div class="queue-thumb">EP<br>${ep.number || '—'}</div>
      <div class="queue-info">
        <div class="q-ep">EP. ${ep.number || '—'}</div>
        <div class="q-title">${pcEsc(ep.title)}</div>
      </div>
      <div class="queue-play-icon">
        <i class="fa-solid fa-play"></i>
      </div>
    </div>`).join('');
}

function pcRenderEpisodeList(list) {
  const wrap = document.getElementById('epListBody');
  if (!wrap) return;
  wrap.innerHTML = `<div class="ep-card-list">${list.map(ep => `
    <div class="ep-card" id="epCard-${ep.id}">
      <div class="ep-thumb">
        <div class="ep-thumb-label">EP<br>${ep.number || '—'}</div>
      </div>
      <button class="ep-play-btn" onclick="playEpisode(${ep.id})" aria-label="Play ${pcEsc(ep.title)}">
        <i class="fa-solid fa-play"></i>
      </button>
      <div class="ep-info">
        <div class="ep-number">EPISODE ${ep.number || '—'}${ep.topic ? ' · ' + pcEsc(ep.topic) : ''}</div>
        <div class="ep-name">${pcEsc(ep.title)} <i class="fa-solid fa-heart"></i></div>
        ${ep.description ? `<div class="ep-desc">${pcEsc(ep.description)}</div>` : ''}
        <div class="ep-meta">
          <span><i class="fa-regular fa-calendar-days"></i>${pcFormatDate(ep.air_date) || 'New'}</span>
          ${ep.duration ? `<span><i class="fa-regular fa-clock"></i>${pcEsc(ep.duration)}</span>` : ''}
        </div>
      </div>
      <div class="ep-actions">
        ${ep.duration ? `<span class="ep-duration">${pcEsc(ep.duration)}</span>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function pcUpdateTopicCounts(list) {
  const counts = {};
  list.forEach(ep => {
    if (!ep.topic) return;
    const key = ep.topic.trim().toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  });
  document.querySelectorAll('.topic-row').forEach(row => {
    const nameEl = row.querySelector('.topic-row-name');
    const countEl = row.querySelector('.topic-row-count');
    if (!nameEl || !countEl) return;
    const key = nameEl.textContent.trim().toLowerCase();
    if (counts[key]) countEl.textContent = counts[key];
  });
}

/* ============================================================
   PLAYBACK
   ============================================================ */
function playEpisode(id) {
  const ep = PC_EPISODES.find(e => e.id === id);
  if (!ep) return;
  if (ep.type === 'audio') playAudioEpisode(ep);
  else playVideoEpisode(ep);

  document.querySelectorAll('.ep-card').forEach(c => c.classList.remove('playing'));
  const card = document.getElementById('epCard-' + id);
  if (card) card.classList.add('playing');
}

/* ---- Audio ---- */
let pcAudioEl = null;
function playAudioEpisode(ep) {
  pcAudioEl = document.getElementById('audioEl');
  if (!ep.media_url) { alert('Audio file not available yet.'); return; }
  pcAudioEl.src = ep.media_url;
  pcAudioEl.play();
  document.getElementById('playerEpNum').textContent = ep.number ? 'EPISODE ' + ep.number : 'EPISODE';
  document.getElementById('playerTitle').textContent = ep.title;
  document.getElementById('audioPlayerBar').classList.add('visible');
  document.body.classList.add('player-open');
  setPlayIcon(true);

  pcAudioEl.ontimeupdate = () => {
    const pct = (pcAudioEl.currentTime / (pcAudioEl.duration || 1)) * 100;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('curTime').textContent = pcFormatTime(pcAudioEl.currentTime);
    document.getElementById('durTime').textContent = pcFormatTime(pcAudioEl.duration);
  };
  pcAudioEl.onended = () => setPlayIcon(false);
}
function pcFormatTime(t) {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function toggleAudioPlay() {
  if (!pcAudioEl) return;
  if (pcAudioEl.paused) { pcAudioEl.play(); setPlayIcon(true); }
  else { pcAudioEl.pause(); setPlayIcon(false); }
}
function setPlayIcon(playing) {
  const btn = document.getElementById('playPauseBtn');
  if (btn) btn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}
function audioSeek(sec) {
  if (pcAudioEl) pcAudioEl.currentTime = Math.max(0, pcAudioEl.currentTime + sec);
}
function seekClick(e) {
  if (!pcAudioEl || !isFinite(pcAudioEl.duration)) return;
  const track = document.getElementById('progressTrack');
  const rect = track.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  pcAudioEl.currentTime = pct * pcAudioEl.duration;
}
function setVolume(v) { if (pcAudioEl) pcAudioEl.volume = v; }
function closeAudioPlayer() {
  if (pcAudioEl) pcAudioEl.pause();
  document.getElementById('audioPlayerBar').classList.remove('visible');
  document.body.classList.remove('player-open');
}

/* ---- Video ---- */
function playVideoEpisode(ep) {
  const wrap = document.getElementById('vmPlayerWrap');
  const embed = pcYouTubeEmbed(ep.youtube_url);
  if (embed) {
    wrap.innerHTML = `<iframe class="ep-video-player" style="aspect-ratio:16/9;height:auto;" src="${embed}" title="${pcEsc(ep.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (ep.media_url) {
    wrap.innerHTML = `<video class="ep-video-player" src="${ep.media_url}" controls autoplay></video>`;
  } else {
    wrap.innerHTML = `<p style="padding:24px;text-align:center;color:var(--gray);">Video not available yet.</p>`;
  }
  document.getElementById('vmEpNum').textContent = ep.number ? 'EPISODE ' + ep.number : 'EPISODE';
  document.getElementById('vmTitle').textContent = ep.title;
  document.getElementById('vmDesc').textContent = ep.description || '';
  document.getElementById('vmMeta').innerHTML = `
    ${ep.duration ? `<span><i class="fa-regular fa-clock"></i> ${pcEsc(ep.duration)}</span>` : ''}
    ${ep.topic ? `<span><i class="fa-solid fa-tag"></i> ${pcEsc(ep.topic)}</span>` : ''}`;
  document.getElementById('videoModal').classList.add('open');
}
function closeVideoModal() {
  document.getElementById('videoModal').classList.remove('open');
  document.getElementById('vmPlayerWrap').innerHTML = '';
}
function handleVideoBackdrop(e) {
  if (e.target === document.getElementById('videoModal')) closeVideoModal();
}

function pcShareEpisode(id) {
  const ep = PC_EPISODES.find(e => e.id === id);
  if (!ep) return;
  const url = window.location.href.split('#')[0] + '#ep-' + id;
  if (navigator.share) navigator.share({ title: ep.title, url });
  else { navigator.clipboard.writeText(url); alert('Link copied!'); }
}

/* ============================================================
   INDEX PAGE — small "latest episode" nudge
   ============================================================ */
async function pcRenderIndexLatest() {
  const btn = document.getElementById('latestEpisodeBtn');
  if (!btn) return;
  const episodes = await pcFetchEpisodes();
  if (!episodes.length) return;
  const ep = episodes[0];
  btn.innerHTML = `<i class="fa-solid fa-headphones"></i> LISTEN: ${pcEsc(ep.title)}`;
}

/* ============================================================
   SITE SETTINGS SYNC — email, phone, social links
   Works across every page's footer, whatever its class naming,
   by matching on the visible label text and aria-labels rather
   than requiring specific IDs on every page.
   ============================================================ */
async function pcApplySettings() {
  if (typeof supabaseClient === 'undefined') return;
  const { data, error } = await supabaseClient.from('settings').select('*').eq('id', 1).single();
  if (error || !data) return;

  document.querySelectorAll('[class*="-label"]').forEach(labelEl => {
    if (!/(contact-label|ct-item-label)/.test(labelEl.className)) return;
    const valEl = labelEl.nextElementSibling;
    if (!valEl) return;
    const text = labelEl.textContent.trim().toUpperCase();
    if (text === 'EMAIL' && data.email) valEl.textContent = data.email;
    if (text === 'PHONE' && data.phone) valEl.textContent = data.phone;
  });

  const socialMap = {
    Instagram: data.instagram_url,
    TikTok:    data.tiktok_url,
    Spotify:   data.spotify_url,
    YouTube:   data.youtube_url
  };
  document.querySelectorAll('a[aria-label]').forEach(a => {
    const url = socialMap[a.getAttribute('aria-label')];
    if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  pcRenderEpisodesPage();
  pcRenderIndexLatest();
  pcApplySettings();
});